"""Pruebas unitarias y de integración para caching con TTL, invalidación, aislamiento de sesión y timing."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import anyio.to_thread
import pytest
from sqlmodel import Session, create_engine
import starlette.concurrency

import services.api.database as db_module
import services.api.main as main_module
from services.api.cache import TTLCache, app_cache
from services.api.routers.inventory import (
    create_inbound_order,
    create_outbound_order,
    create_product,
    list_orders,
    list_products,
)
from services.api.schemas import SKUCreate, StockEntryCreate, StockExitCreate
from tests.test_serialization_audit import _asgi_json, _asgi_request


@pytest.fixture(autouse=True)
def _inline_sync(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _sync_anyio(func: Any, *args: Any, **_kwargs: Any) -> Any:
        return func(*args)

    async def _sync_starlette(func: Any, *args: Any, **kwargs: Any) -> Any:
        return func(*args, **kwargs)

    monkeypatch.setattr(anyio.to_thread, "run_sync", _sync_anyio)
    monkeypatch.setattr(starlette.concurrency, "run_in_threadpool", _sync_starlette)


def test_ttl_cache_expiration_immutability_and_prefix_invalidation() -> None:
    """Verifica expiración exacta por TTL, protección contra mutaciones externas e invalidación por prefijo."""
    fake_now = 1000.0
    cache = TTLCache(clock=lambda: fake_now)

    with pytest.raises(ValueError):
        cache.set("k", {"a": 1}, ttl_seconds=0)

    payload = {"total": 10, "nested": [1, 2]}
    cache.set("incidents:summary", payload, ttl_seconds=30.0)

    hit, val = cache.get("incidents:summary")
    assert hit is True
    assert val == {"total": 10, "nested": [1, 2]}

    # Mutar el objeto devuelto no debe contaminar el valor almacenado en caché
    val["total"] = 999
    val["nested"].append(3)
    _, clean_val = cache.get("incidents:summary")
    assert clean_val == {"total": 10, "nested": [1, 2]}

    # Avanzar el reloj 29.9s -> sigue vigente; a los 30.0s exactos -> expira
    fake_now = 1029.9
    assert cache.get("incidents:summary")[0] is True

    fake_now = 1030.0
    assert cache.get("incidents:summary") == (False, None)

    # Invalidación por prefijo
    cache.set("inventory:products:ALL", [1], ttl_seconds=45.0)
    cache.set("inventory:orders:LA", [2], ttl_seconds=30.0)
    cache.set("incidents:summary", {"total": 1}, ttl_seconds=30.0)
    removed = cache.invalidate_prefix("inventory:")
    assert removed == 2
    assert cache.get("inventory:products:ALL")[0] is False
    assert cache.get("incidents:summary")[0] is True


def test_incidents_summary_cache_hit_and_write_invalidation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Comprueba que GET /api/incidents/summary evita recalcular en caché caliente y se invalida al crear o editar."""
    db_calls = 0
    real_get_summary = main_module.get_incidents_summary

    def counted_summary() -> dict[str, Any]:
        nonlocal db_calls
        db_calls += 1
        return real_get_summary()

    monkeypatch.setattr(main_module, "get_incidents_summary", counted_summary)

    status1, body1 = _asgi_json("GET", "/api/incidents/summary")
    assert status1 == 200
    assert body1["total"] == 0
    assert db_calls == 1

    # Segunda lectura consecutiva: Cache HIT sin tocar SQLite
    status2, body2 = _asgi_json("GET", "/api/incidents/summary")
    assert status2 == 200
    assert body2["total"] == 0
    assert db_calls == 1

    # Crear incidencia invalida la caché -> siguiente lectura ve total = 1
    post_status, created = _asgi_json(
        "POST",
        "/api/incidents",
        json_body={
            "title": "Retraso en muelle norte",
            "description": "Espera superior a 2h en descarga de tráiler.",
            "category": "carrier_issue",
            "origin": "branch",
            "branch": "zaragoza_warehouse",
        },
    )
    assert post_status == 201

    _, body3 = _asgi_json("GET", "/api/incidents/summary")
    assert body3["total"] == 1
    assert body3["by_status"]["open"] == 1
    assert db_calls == 2

    # Cambiar estado invalida nuevamente la caché -> refleja 'in_progress' al instante
    inc_id = created["id"]
    patch_status, _ = _asgi_json(
        "PATCH",
        f"/api/incidents/{inc_id}/status",
        json_body={"status": "in_progress"},
    )
    assert patch_status == 200

    _, body4 = _asgi_json("GET", "/api/incidents/summary")
    assert body4["by_status"]["open"] == 0
    assert body4["by_status"]["in_progress"] == 1
    assert db_calls == 3


def test_inventory_products_and_orders_caching_and_invalidation_on_writes(
    seeded_user: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """Valida caché por almacén en /inventory/products y /inventory/orders e invalidación tras entradas/salidas."""
    inv_file = tmp_path / "cache_inventory.sqlite"
    engine = create_engine(f"sqlite:///{inv_file}")
    monkeypatch.setattr(db_module, "engine", engine)
    db_module.create_inventory_tables(engine)
    user = seeded_user["user_db"]

    with Session(engine) as session:
        sku = create_product(
            SKUCreate(
                name="Batería Portátil Pro",
                sku="TEC-BAT-01",
                client_name="VoltEdge",
                category="electronics",
                warehouse="LA",
            ),
            session=session,
            _=user,
        )

        exec_count = 0
        orig_exec = session.exec

        def tracked_exec(*args: Any, **kwargs: Any) -> Any:
            nonlocal exec_count
            exec_count += 1
            return orig_exec(*args, **kwargs)

        monkeypatch.setattr(session, "exec", tracked_exec)

        # 1ª lectura de productos -> MISS (3 queries SQL)
        first_products = list_products(warehouse="LA", session=session)
        assert len(first_products) == 1
        assert first_products[0].current_stock == 0
        assert exec_count == 3

        # 2ª lectura con mismo filtro -> HIT (0 queries SQL adicionales)
        second_products = list_products(warehouse="LA", session=session)
        assert second_products[0].current_stock == 0
        assert exec_count == 3

        # Registrar entrada invalida caché de productos y órdenes
        create_inbound_order(
            StockEntryCreate(
                sku_id=sku.id,
                quantity=50,
                reference="PO-CACHE-01",
                warehouse="LA",
            ),
            session=session,
            current_user=user,
        )

        refreshed_products = list_products(warehouse="LA", session=session)
        assert refreshed_products[0].current_stock == 50

        # Calentar caché de órdenes y verificar invalidación tras orden de salida
        orders_before = list_orders(warehouse="LA", session=session)
        assert len(orders_before) == 1
        calls_after_orders_miss = exec_count

        orders_hit = list_orders(warehouse="LA", session=session)
        assert len(orders_hit) == 1
        assert exec_count == calls_after_orders_miss  # 0 queries SQL en HIT

        create_outbound_order(
            StockExitCreate(
                sku_id=sku.id,
                quantity=10,
                exit_type="dispatch",
                tracking_number="1Z999AA10001",
                warehouse="LA",
            ),
            session=session,
            current_user=user,
        )

        orders_after_exit = list_orders(warehouse="LA", session=session)
        assert len(orders_after_exit) == 2
        assert list_products(warehouse="LA", session=session)[0].current_stock == 40


def test_private_endpoints_never_populate_shared_cache_and_timing_middleware_logs(
    seeded_user: dict[str, Any],
    seeded_admin: dict[str, Any],
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Garantiza cero almacenamiento en caché compartida para rutas privadas (/auth/me, /profiles/me) y verifica logs de timing."""
    app_cache.clear_all()
    user_headers = {"Authorization": f"Bearer {seeded_user['token']}"}
    admin_headers = {"Authorization": f"Bearer {seeded_admin['token']}"}

    with caplog.at_level(logging.INFO, logger="api.timing"):
        _, me_user = _asgi_json("GET", "/auth/me", headers=user_headers)
        _, me_admin = _asgi_json("GET", "/auth/me", headers=admin_headers)
        status_prof, _, res_headers = _asgi_request("GET", "/profiles/me", headers=user_headers)

    assert status_prof == 200
    assert me_user["email"] == seeded_user["email"]
    assert me_admin["email"] == seeded_admin["email"]
    # Ningún dato privado o de sesión debe haberse guardado en app_cache
    assert app_cache.stats()["active_entries"] == 0
    assert "x-response-time-ms" in res_headers
    assert any("GET /auth/me → 200 |" in rec.message for rec in caplog.records)
