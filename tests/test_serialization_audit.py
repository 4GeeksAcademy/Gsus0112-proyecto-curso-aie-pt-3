"""Suite de verificación integral para la Auditoría de Serialización del Backend (`docs/serialization-audit.md`)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlsplit

import anyio.to_thread
import pytest
import starlette.concurrency
from sqlmodel import create_engine

import services.api.database as db_module
from services.api.main import app, export_results
from services.api.security import create_password_reset_token
from tests.conftest import run_async


@pytest.fixture(autouse=True)
def _inline_threadpool(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ejecuta funciones síncronas de FastAPI/Starlette en línea sin hilos ni socketpair."""

    async def _sync_inline(func: Any, *args: Any, **_kwargs: Any) -> Any:
        return func(*args)

    async def _starlette_inline(func: Any, *args: Any, **kwargs: Any) -> Any:
        return func(*args, **kwargs)

    monkeypatch.setattr(anyio.to_thread, "run_sync", _sync_inline)
    monkeypatch.setattr(starlette.concurrency, "run_in_threadpool", _starlette_inline)


def _asgi_request(
    method: str,
    url: str,
    *,
    json_body: Any = None,
    form_body: dict[str, str] | None = None,
    raw_body: bytes | None = None,
    content_type: str | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, bytes, dict[str, str]]:
    """Ejecuta una petición HTTP completa contra la aplicación ASGI de FastAPI sin abrir sockets."""
    parsed = urlsplit(url)
    req_headers: list[tuple[bytes, bytes]] = [
        (b"host", b"testserver"),
    ]
    if headers:
        for k, v in headers.items():
            req_headers.append((k.lower().encode("latin-1"), v.encode("latin-1")))

    if json_body is not None:
        body_bytes = json.dumps(json_body).encode("utf-8")
        req_headers.append((b"content-type", b"application/json"))
    elif form_body is not None:
        body_bytes = urlencode(form_body).encode("utf-8")
        req_headers.append((b"content-type", b"application/x-www-form-urlencoded"))
    elif raw_body is not None:
        body_bytes = raw_body
        if content_type:
            req_headers.append((b"content-type", content_type.encode("latin-1")))
    else:
        body_bytes = b""

    req_headers.append((b"content-length", str(len(body_bytes)).encode("ascii")))

    scope: dict[str, Any] = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": parsed.path,
        "raw_path": parsed.path.encode("ascii"),
        "query_string": parsed.query.encode("ascii"),
        "headers": req_headers,
        "client": ("127.0.0.1", 50000),
        "server": ("testserver", 80),
    }

    sent_request = False
    status_code = 500
    res_headers: dict[str, str] = {}
    chunks: list[bytes] = []

    async def receive() -> dict[str, Any]:
        nonlocal sent_request
        if not sent_request:
            sent_request = True
            return {"type": "http.request", "body": body_bytes, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message: dict[str, Any]) -> None:
        nonlocal status_code
        if message["type"] == "http.response.start":
            status_code = int(message["status"])
            for raw_k, raw_v in message.get("headers", []):
                res_headers[raw_k.decode("latin-1").lower()] = raw_v.decode("latin-1")
        elif message["type"] == "http.response.body":
            chunks.append(message.get("body", b""))

    run_async(app(scope, receive, send))
    return status_code, b"".join(chunks), res_headers


def _asgi_json(
    method: str,
    url: str,
    *,
    json_body: Any = None,
    form_body: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, Any]:
    status_code, raw, _ = _asgi_request(
        method,
        url,
        json_body=json_body,
        form_body=form_body,
        headers=headers,
    )
    return status_code, json.loads(raw.decode("utf-8")) if raw else None


def test_every_endpoint_declares_explicit_schema_in_openapi_and_separates_input_output() -> None:
    """Verifica que los 31 endpoints tengan contrato explícito en OpenAPI (/docs) sin diccionarios libres."""
    openapi = app.openapi()
    paths = openapi["paths"]

    total_operations = 0
    for path, methods in paths.items():
        for method, operation in methods.items():
            total_operations += 1
            responses = operation["responses"]

            # Endpoints 204 No Content: no deben declarar cuerpo de respuesta
            if "204" in responses:
                assert "content" not in responses["204"], (
                    f"{method.upper()} {path} devuelve 204 pero expone cuerpo en OpenAPI"
                )
                continue

            # Endpoint de exportación CSV: debe documentar text/csv sin forzar JSON libre
            if path == "/api/incidents/results/export":
                content = responses["200"]["content"]
                assert "text/csv" in content
                continue

            # Todos los demás endpoints deben tener un response_model explícito ($ref o array de $ref)
            success_code = "201" if "201" in responses else "200"
            json_schema = responses[success_code]["content"]["application/json"]["schema"]
            has_explicit_ref = "$ref" in json_schema or (
                json_schema.get("type") == "array"
                and "$ref" in json_schema.get("items", {})
            )
            assert has_explicit_ref, (
                f"{method.upper()} {path} carece de response_model tipado explícito: {json_schema}"
            )

            # Verificar que ningún requestBody JSON reutilice un esquema *Response o *DB
            req_body = operation.get("requestBody", {})
            json_req = req_body.get("content", {}).get("application/json", {}).get("schema", {})
            if "$ref" in json_req:
                ref_name = json_req["$ref"].rsplit("/", 1)[-1]
                assert not ref_name.endswith(("Response", "DB", "ListItem")), (
                    f"{method.upper()} {path} reutiliza un esquema de salida/BD como entrada: {ref_name}"
                )

    assert total_operations == 31


def test_auth_and_registration_never_expose_passwords_tokens_or_unauthenticated_email(
    seeded_user: dict[str, Any],
    mock_mailer: Any,
) -> None:
    """Verifica que registro, login y forgot/reset jamás devuelvan hashed_password ni email; GET /auth/me sí incluye email."""
    # 1. Registro público (POST /users): no debe reenviar email ni hashed_password
    reg_status, reg_body = _asgi_json(
        "POST",
        "/users",
        json_body={
            "email": "nuevo.operador@trackflow.com",
            "password": "ClaveSegura2026!",
            "name": "Operador Norte",
        },
    )
    assert reg_status == 201
    assert set(reg_body.keys()) == {"id", "is_active", "role", "created_at"}
    assert "email" not in reg_body
    assert "hashed_password" not in reg_body

    # Rechaza inyección de campos internos en el registro (extra="forbid")
    hack_status, _ = _asgi_json(
        "POST",
        "/users",
        json_body={
            "email": "otro@trackflow.com",
            "password": "ClaveSegura2026!",
            "hashed_password": "inyectado",
        },
    )
    assert hack_status == 422

    # 2. Login (POST /auth/login): solo access_token y token_type
    login_status, login_body = _asgi_json(
        "POST",
        "/auth/login",
        form_body={"username": seeded_user["email"], "password": seeded_user["password"]},
    )
    assert login_status == 200
    assert set(login_body.keys()) == {"access_token", "token_type"}
    assert "email" not in login_body
    assert "hashed_password" not in login_body

    # 3. Forgot & Reset password: solo detail, sin email ni token
    forgot_status, forgot_body = _asgi_json(
        "POST", "/auth/forgot-password", json_body={"email": seeded_user["email"]}
    )
    assert forgot_status == 200
    assert set(forgot_body.keys()) == {"detail"}
    assert "email" not in forgot_body

    reset_token = create_password_reset_token(seeded_user["id"])
    reset_status, reset_body = _asgi_json(
        "POST",
        "/auth/reset-password",
        json_body={"token": reset_token, "new_password": "NuevaPassword99!"},
    )
    assert reset_status == 200
    assert set(reset_body.keys()) == {"detail"}
    assert "email" not in reset_body
    assert "token" not in reset_body

    # 4. GET /auth/me autenticado: expone email propio para la vista de perfil, sin claves internas
    headers = {"Authorization": f"Bearer {seeded_user['token']}"}
    me_status, me_body = _asgi_json("GET", "/auth/me", headers=headers)
    assert me_status == 200
    assert set(me_body.keys()) == {"email", "role", "name", "phone", "address"}
    assert me_body["email"] == seeded_user["email"]
    assert "hashed_password" not in me_body
    assert "id" not in me_body
    assert "user_id" not in me_body


def test_profiles_users_and_suppliers_enforce_lightweight_lists_and_hide_internal_fks(
    seeded_user: dict[str, Any],
) -> None:
    """Comprueba la ocultación de id/user_id en /profiles/me y las proyecciones ligeras en /users y /api/suppliers."""
    headers = {"Authorization": f"Bearer {seeded_user['token']}"}

    # /profiles/me: nunca expone id ni user_id, y rechaza escritura de user_id
    prof_status, prof_body = _asgi_json("GET", "/profiles/me", headers=headers)
    assert prof_status == 200
    assert set(prof_body.keys()) == {"name", "phone", "address"}

    prof_hack_status, _ = _asgi_json(
        "PUT",
        "/profiles/me",
        headers=headers,
        json_body={"name": "Intento", "user_id": 999},
    )
    assert prof_hack_status == 422

    # GET /users (listado sin created_at) vs GET /users/{id} (detalle con created_at)
    _, users_list = _asgi_json("GET", "/users", headers=headers)
    assert len(users_list) >= 1
    assert set(users_list[0].keys()) == {"id", "email", "is_active", "role"}
    assert "created_at" not in users_list[0]

    _, user_detail = _asgi_json("GET", f"/users/{seeded_user['id']}", headers=headers)
    assert set(user_detail.keys()) == {
        "id",
        "email",
        "is_active",
        "role",
        "created_at",
    }

    # POST + GET /api/suppliers (listado sin updated_at) vs GET /api/suppliers/{id} (detalle con updated_at)
    sup_status, sup_created = _asgi_json(
        "POST",
        "/api/suppliers",
        headers=headers,
        json_body={
            "name": "TransPirineos Express",
            "country": "ES",
            "categories": ["last mile delivery"],
            "rate_per_shipment": 6.25,
            "currency": "EUR",
            "service_zone": "Aragón",
            "contact_email": "ops@transpirineos.es",
            "notes": None,
            "status": "active",
        },
    )
    assert sup_status == 201
    sup_id = sup_created["id"]
    assert "updated_at" in sup_created

    _, sup_list = _asgi_json("GET", "/api/suppliers", headers=headers)
    assert len(sup_list) == 1
    assert "updated_at" not in sup_list[0]

    _, sup_detail = _asgi_json("GET", f"/api/suppliers/{sup_id}", headers=headers)
    assert "updated_at" in sup_detail


def test_inventory_and_incidents_list_projections_fk_deduplication_and_strict_inputs(
    seeded_user: dict[str, Any],
    monkeypatch: Any,
    tmp_path: Path,
) -> None:
    """Valida SKUListItem, eliminación de FK duplicada sku_id en órdenes y recorte de over-fetching en incidencias."""
    inv_db = tmp_path / "audit_inventory.sqlite"
    test_engine = create_engine(f"sqlite:///{inv_db}")
    monkeypatch.setattr(db_module, "engine", test_engine)
    db_module.create_inventory_tables(test_engine)

    headers = {"Authorization": f"Bearer {seeded_user['token']}"}

    # Crear SKU + orden de entrada
    sku_status, sku_body = _asgi_json(
        "POST",
        "/inventory/products",
        headers=headers,
        json_body={
            "name": "Chaqueta impermeable",
            "sku": "FSH-JKT-01",
            "client_name": "NordicWear",
            "category": "fashion",
            "warehouse": "ZGZ",
        },
    )
    assert sku_status == 201
    sku_id = sku_body["id"]
    assert "stock_by_warehouse" in sku_body

    # Rechazar inyección de user_uuid en orden de entrada
    forbid_status, _ = _asgi_json(
        "POST",
        "/inventory/orders/inbound",
        headers=headers,
        json_body={
            "sku_id": sku_id,
            "quantity": 15,
            "reference": "PO-AUDIT-01",
            "warehouse": "ZGZ",
            "user_uuid": "spoofed-uuid",
        },
    )
    assert forbid_status == 422

    ok_in_status, _ = _asgi_json(
        "POST",
        "/inventory/orders/inbound",
        headers=headers,
        json_body={
            "sku_id": sku_id,
            "quantity": 15,
            "reference": "PO-AUDIT-01",
            "warehouse": "ZGZ",
        },
    )
    assert ok_in_status == 201

    # GET /inventory/products devuelve SKUListItem plano sin stock_by_warehouse
    _, prod_list = _asgi_json("GET", "/inventory/products")
    assert len(prod_list) == 1
    assert "stock_by_warehouse" not in prod_list[0]
    assert prod_list[0]["current_stock"] == 15

    # GET /inventory/products/{id} sí incluye stock_by_warehouse
    _, prod_detail = _asgi_json("GET", f"/inventory/products/{sku_id}")
    assert prod_detail["stock_by_warehouse"] == {"LA": 0, "ZGZ": 15}

    # GET /inventory/orders omite la FK duplicada sku_id y sku.warehouse redundante
    _, orders_list = _asgi_json("GET", "/inventory/orders")
    assert len(orders_list) == 1
    order_item = orders_list[0]
    assert "sku_id" not in order_item
    assert set(order_item["sku"].keys()) == {
        "id",
        "name",
        "sku",
        "client_name",
        "category",
    }

    # /api/incidents: rechaza campos de solo lectura en POST, omite updated_at en listado y filtra analyze
    bad_inc_status, _ = _asgi_json(
        "POST",
        "/api/incidents",
        json_body={
            "id": 999,
            "title": "Fallo en cinta",
            "description": "Parada imprevista en clasificador.",
            "category": "inventory_discrepancy",
            "origin": "internal",
            "branch": "zaragoza_warehouse",
        },
    )
    assert bad_inc_status == 400

    ok_inc_status, ok_inc_body = _asgi_json(
        "POST",
        "/api/incidents",
        json_body={
            "title": "Fallo en cinta",
            "description": "Parada imprevista en clasificador.",
            "category": "inventory_discrepancy",
            "origin": "internal",
            "branch": "zaragoza_warehouse",
        },
    )
    assert ok_inc_status == 201
    inc_id = ok_inc_body["id"]
    assert "updated_at" in ok_inc_body
    assert "source_ref" not in ok_inc_body

    _, inc_list = _asgi_json("GET", "/api/incidents")
    assert len(inc_list) == 1
    assert "updated_at" not in inc_list[0]
    assert "source_ref" not in inc_list[0]

    _, inc_detail = _asgi_json("GET", f"/api/incidents/{inc_id}")
    assert "updated_at" in inc_detail

    boundary = "----TrackFlowAuditBoundary"
    csv_text = (
        "country,carrier,tracking_number,category,description,customer_email,status,satisfaction_score\r\n"
        "ES,SEUR,TRK12345678,DAMAGE,Embalaje dañado en tránsito,cliente@ejemplo.es,CLOSED,4\r\n"
    )
    multipart_body = (
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="file"; filename="lote.csv"\r\n'
        "Content-Type: text/csv\r\n\r\n"
        f"{csv_text}\r\n"
        f"--{boundary}--\r\n"
    ).encode("utf-8")
    analyze_status, raw_analyze, _ = _asgi_request(
        "POST",
        "/api/incidents/analyze",
        raw_body=multipart_body,
        content_type=f"multipart/form-data; boundary={boundary}",
    )
    assert analyze_status == 200
    analyze_body = json.loads(raw_analyze.decode("utf-8"))
    assert set(analyze_body.keys()) == {
        "total_records",
        "valid_records",
        "invalid_records",
        "invalid_reasons",
        "average_satisfaction",
    }

    export_res = export_results()
    assert export_res.status_code == 200
    assert export_res.media_type == "text/csv; charset=utf-8"
