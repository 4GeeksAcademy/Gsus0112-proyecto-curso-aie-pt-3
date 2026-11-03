"""Pruebas unitarias y de integración para el módulo de inventario ORM (`/inventory`) con doble base de datos."""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Any, Iterator

import pytest
from fastapi import HTTPException
from fastapi.routing import APIRoute
from pydantic import BaseModel, ValidationError
from sqlmodel import Session, SQLModel, create_engine, select

import services.api.database as db_module
from services.api.main import app
from services.api.models import RoleEnum, SKU, StockEntry, StockExit, UserDB
from services.api.routers.inventory import (
    create_inbound_order,
    create_outbound_order,
    create_product,
    get_product,
    list_orders,
    list_products,
    router as inventory_router,
)
from services.api.schemas import (
    SKUCreate,
    SKUResponse,
    StockEntryCreate,
    StockEntryResponse,
    StockExitCreate,
    StockExitResponse,
    StockOrderResponse,
)
from services.api.security import create_access_token, get_current_user, get_password_hash
from services.api.seed_inventory import seed_inventory
from tests.conftest import run_async


@pytest.fixture()
def inventory_engine(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Any:
    """Crea un motor SQLModel aislado en disco temporal para probar ORM, FKs y sesiones por petición."""
    db_file = tmp_path / "test_inventory_orm.sqlite"
    test_engine = create_engine(f"sqlite:///{db_file}")

    # Activar claves foráneas en SQLite en cada conexión abierta por el motor de pruebas
    raw_connect = test_engine.raw_connection
    conn = raw_connect()
    conn.close()

    monkeypatch.setattr(db_module, "engine", test_engine)
    db_module.create_inventory_tables(test_engine)
    return test_engine


@pytest.fixture()
def db_session(inventory_engine: Any) -> Iterator[Session]:
    """Obtiene una sesión SQLModel a través de la dependencia real `get_db()`."""
    gen = db_module.get_db()
    session = next(gen)
    # Garantizar PRAGMA foreign_keys=ON en SQLite para verificar integridad referencial real
    session.connection().exec_driver_sql("PRAGMA foreign_keys = ON")
    try:
        yield session
    finally:
        try:
            next(gen)
        except StopIteration:
            pass


# =====================================================================
# 1. ARQUITECTURA: ROUTER /inventory, SEPARACIÓN ORM/SCHEMAS Y SIN SQLALCHEMY DIRECTO
# =====================================================================


def test_inventory_router_endpoints_dependencies_and_schema_separation() -> None:
    """Verifica que las 6 rutas estén montadas en app bajo /inventory, inyecten Depends(get_db) y no devuelvan SQLModel."""
    openapi_paths = app.openapi()["paths"]
    assert "/inventory/products" in openapi_paths
    assert {"get", "post"}.issubset(set(openapi_paths["/inventory/products"].keys()))
    assert "get" in openapi_paths["/inventory/products/{id}"]
    assert "post" in openapi_paths["/inventory/orders/inbound"]
    assert "post" in openapi_paths["/inventory/orders/outbound"]
    assert "get" in openapi_paths["/inventory/orders"]

    inventory_routes: dict[tuple[str, str], APIRoute] = {}
    for route in inventory_router.routes:
        if isinstance(route, APIRoute) and route.path.startswith("/inventory"):
            for method in route.methods or set():
                if method in {"GET", "POST"}:
                    inventory_routes[(method, route.path)] = route

    expected = {
        ("GET", "/inventory/products"),
        ("POST", "/inventory/products"),
        ("GET", "/inventory/products/{id}"),
        ("POST", "/inventory/orders/inbound"),
        ("POST", "/inventory/orders/outbound"),
        ("GET", "/inventory/orders"),
    }
    assert expected.issubset(set(inventory_routes.keys()))

    # Verificar que todas las rutas inyectan get_db por petición
    for key in expected:
        route = inventory_routes[key]
        dep_calls = {dep.call for dep in route.dependant.dependencies}
        assert db_module.get_db in dep_calls, f"Falta Depends(get_db) en {key}"

    # Verificar que los 3 endpoints de escritura exigen autenticación TinyDB (get_current_user)
    for write_key in [
        ("POST", "/inventory/products"),
        ("POST", "/inventory/orders/inbound"),
        ("POST", "/inventory/orders/outbound"),
    ]:
        dep_calls = {dep.call for dep in inventory_routes[write_key].dependant.dependencies}
        assert get_current_user in dep_calls, f"Falta Depends(get_current_user) en {write_key}"

    # Verificar que los schemas de respuesta son Pydantic puros y NO subclases de SQLModel
    for schema_cls in (
        SKUResponse,
        StockEntryResponse,
        StockExitResponse,
        StockOrderResponse,
    ):
        assert issubclass(schema_cls, BaseModel)
        assert not issubclass(schema_cls, SQLModel)


def test_orm_metadata_has_no_user_table_no_current_stock_column_and_enforces_fk(
    db_session: Session,
) -> None:
    """Garantiza que no exista tabla User en SQLModel, ni columna current_stock en SKU, y que exista FK a sku.id."""
    table_names = set(SQLModel.metadata.tables.keys())
    assert {"sku", "stockentry", "stockexit"}.issubset(table_names)
    assert "user" not in table_names
    assert "users" not in table_names

    sku_columns = set(SQLModel.metadata.tables["sku"].columns.keys())
    assert sku_columns == {"id", "name", "sku", "client_name", "category", "warehouse"}
    assert "current_stock" not in sku_columns

    entry_fks = {
        fk.target_fullname for fk in SQLModel.metadata.tables["stockentry"].foreign_keys
    }
    exit_fks = {
        fk.target_fullname for fk in SQLModel.metadata.tables["stockexit"].foreign_keys
    }
    assert "sku.id" in entry_fks
    assert "sku.id" in exit_fks

    # Intentar insertar un StockEntry apuntando a un sku_id inexistente directamente en BD debe fallar por FK
    invalid_entry = StockEntry(
        sku_id=99999,
        quantity=5,
        reference="PO-INVALID-FK",
        warehouse="LA",
        user_uuid="1",
    )
    db_session.add(invalid_entry)
    with pytest.raises(Exception):
        db_session.commit()
    db_session.rollback()


def test_no_direct_sqlalchemy_imports_in_inventory_modules() -> None:
    """Comprueba mediante AST que los módulos del servicio usen SQLModel sin importar sqlalchemy directamente."""
    assert (
        db_module._normalize_database_url("postgres://u:p@host:6543/postgres")
        == "postgresql+psycopg2://u:p@host:6543/postgres"
    )
    assert (
        db_module._normalize_database_url("postgresql://u:p@host:6543/postgres")
        == "postgresql+psycopg2://u:p@host:6543/postgres"
    )
    repo_root = Path(__file__).resolve().parent.parent
    files_to_check = [
        repo_root / "services" / "api" / "database.py",
        repo_root / "services" / "api" / "models.py",
        repo_root / "services" / "api" / "schemas.py",
        repo_root / "services" / "api" / "routers" / "inventory.py",
        repo_root / "services" / "api" / "seed_inventory.py",
    ]
    for path in files_to_check:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    assert not alias.name.startswith("sqlalchemy"), (
                        f"Import directo de sqlalchemy detectado en {path.name}"
                    )
            elif isinstance(node, ast.ImportFrom) and node.module:
                assert not node.module.startswith("sqlalchemy"), (
                    f"Import directo de sqlalchemy detectado en {path.name}"
                )


# =====================================================================
# 2. PRODUCTOS (SKU) Y PROHIBICIÓN DE MODIFICACIÓN DIRECTA DE STOCK
# =====================================================================


def test_create_and_get_sku_starts_with_zero_stock_and_forbids_direct_stock_field(
    db_session: Session,
    seeded_user: dict[str, Any],
) -> None:
    """Un SKU nuevo inicia con stock 0, devuelve SKUResponse y rechaza current_stock en creación."""
    with pytest.raises(ValidationError):
        SKUCreate(
            name="Producto tramposo",
            sku="TRK-HACK-01",
            client_name="BrandX",
            category="fashion",
            warehouse="LA",
            current_stock=500,  # type: ignore[call-arg]
        )

    created = create_product(
        SKUCreate(
            name="  Zapatilla blanca clásica - Talla 42  ",
            sku="  CLT-SNK-W-42  ",
            client_name="  PureStep Footwear  ",
            category="fashion",
            warehouse="LA",
        ),
        session=db_session,
        _=seeded_user["user_db"],
    )
    assert isinstance(created, SKUResponse)
    assert not isinstance(created, SQLModel)
    assert created.sku == "CLT-SNK-W-42"
    assert created.warehouse == "LA"
    assert created.current_stock == 0
    assert created.stock_by_warehouse == {"LA": 0, "ZGZ": 0}

    # Duplicado en el mismo almacén devuelve 409
    with pytest.raises(HTTPException) as conflict_exc:
        create_product(
            SKUCreate(
                name="Zapatilla duplicada",
                sku="CLT-SNK-W-42",
                client_name="PureStep Footwear",
                category="fashion",
                warehouse="LA",
            ),
            session=db_session,
            _=seeded_user["user_db"],
        )
    assert conflict_exc.value.status_code == 409

    fetched = get_product(created.id, session=db_session)
    assert fetched.id == created.id
    assert fetched.current_stock == 0

    with pytest.raises(HTTPException) as not_found_exc:
        get_product(9999, session=db_session)
    assert not_found_exc.value.status_code == 404


# =====================================================================
# 3. DOBLE BASE DE DATOS (TINYDB AUTH -> SUPABASE/SQLMODEL user_uuid) Y REGLAS DE NEGOCIO
# =====================================================================


def test_dual_db_auth_traces_tinydb_user_uuid_and_rejects_invalid_token(
    db_session: Session,
    memory_db: dict[str, Any],
) -> None:
    """Valida que un usuario autenticado en TinyDB quede trazado en user_uuid en StockEntry y StockExit."""
    # Rechazar token inválido en TinyDB
    with pytest.raises(HTTPException) as unauth_exc:
        run_async(get_current_user("invalid.jwt.token"))
    assert unauth_exc.value.status_code == 401

    # Crear operario en TinyDB con campo uuid explícito
    explicit_uuid = "550e8400-e29b-41d4-a716-446655440000"
    user_doc_id = memory_db["users"].insert(
        {
            "email": "zaragoza.ops@trackflow.com",
            "hashed_password": get_password_hash("WarehousePass2026!"),
            "is_active": True,
            "role": RoleEnum.user.value,
            "created_at": "2026-11-02T10:00:00+00:00",
            "uuid": explicit_uuid,
        }
    )
    jwt_token = create_access_token({"sub": str(user_doc_id)})
    authenticated_user: UserDB = run_async(get_current_user(jwt_token))
    assert authenticated_user.uuid == explicit_uuid

    sku = create_product(
        SKUCreate(
            name="Sérum facial hidratante 30ml",
            sku="CSM-SRM-030",
            client_name="GlowLab Cosmetics",
            category="cosmetics",
            warehouse="ZGZ",
        ),
        session=db_session,
        _=authenticated_user,
    )

    inbound = create_inbound_order(
        StockEntryCreate(
            sku_id=sku.id,
            quantity=40,
            reference="PO-2024-0900",
            warehouse="ZGZ",
        ),
        session=db_session,
        current_user=authenticated_user,
    )
    assert isinstance(inbound, StockEntryResponse)
    assert inbound.user_uuid == explicit_uuid
    assert inbound.warehouse == "ZGZ"

    outbound = create_outbound_order(
        StockExitCreate(
            sku_id=sku.id,
            quantity=12,
            exit_type="dispatch",
            tracking_number="ESSEUR99887766",
            warehouse="ZGZ",
        ),
        session=db_session,
        current_user=authenticated_user,
    )
    assert isinstance(outbound, StockExitResponse)
    assert outbound.user_uuid == explicit_uuid
    assert outbound.tracking_number == "ESSEUR99887766"

    refreshed_sku = get_product(sku.id, session=db_session)
    assert refreshed_sku.current_stock == 28


def test_warehouse_scoped_stock_and_exact_http_400_on_insufficient_stock(
    db_session: Session,
    seeded_user: dict[str, Any],
) -> None:
    """Reglas 2 y 6: el stock es por almacén (LA vs ZGZ, nunca sumado) y rechaza exceso con HTTP 400 antes de escribir."""
    user = seeded_user["user_db"]
    sku = create_product(
        SKUCreate(
            name="Auriculares inalámbricos Pro",
            sku="TEC-EAR-001",
            client_name="SoundWave Electronics",
            category="electronics",
            warehouse="LA",
        ),
        session=db_session,
        _=user,
    )

    # 20 unidades en LA y 15 unidades en ZGZ para el mismo sku_id (NO deben agregarse como 35)
    create_inbound_order(
        StockEntryCreate(
            sku_id=sku.id,
            quantity=20,
            reference="GR-LA-0100",
            warehouse="LA",
        ),
        session=db_session,
        current_user=user,
    )
    create_inbound_order(
        StockEntryCreate(
            sku_id=sku.id,
            quantity=15,
            reference="GR-ZGZ-0100",
            warehouse="ZGZ",
        ),
        session=db_session,
        current_user=user,
    )

    product_state = get_product(sku.id, session=db_session)
    assert product_state.current_stock == 20
    assert product_state.stock_by_warehouse == {"LA": 20, "ZGZ": 15}

    # Intentar sacar 25 unidades de LA debe fallar con HTTP 400 y el mensaje exacto del BRIEFING.md
    with pytest.raises(HTTPException) as exc_info:
        create_outbound_order(
            StockExitCreate(
                sku_id=sku.id,
                quantity=25,
                exit_type="dispatch",
                tracking_number="1Z999AA10123456784",
                warehouse="LA",
            ),
            session=db_session,
            current_user=user,
        )

    assert exc_info.value.status_code == 400
    assert (
        exc_info.value.detail
        == "Insufficient stock for SKU 'TEC-EAR-001'. Available: 20, requested: 25."
    )

    # Confirmar que NO se persistió ningún registro StockExit tras el rechazo
    persisted_exits = db_session.exec(select(StockExit)).all()
    assert len(persisted_exits) == 0


def test_tracking_number_validation_rules_for_dispatch_and_loss() -> None:
    """Regla 3: tracking_number obligatorio en 'dispatch' y estrictamente nulo en 'loss'."""
    with pytest.raises(ValidationError):
        StockExitCreate(
            sku_id=1,
            quantity=5,
            exit_type="dispatch",
            tracking_number=None,
            warehouse="LA",
        )

    with pytest.raises(ValidationError):
        StockExitCreate(
            sku_id=1,
            quantity=5,
            exit_type="dispatch",
            tracking_number="   ",
            warehouse="LA",
        )

    with pytest.raises(ValidationError):
        StockExitCreate(
            sku_id=1,
            quantity=2,
            exit_type="loss",
            tracking_number="1Z999AA10123456784",
            warehouse="LA",
        )

    valid_loss = StockExitCreate(
        sku_id=1,
        quantity=2,
        exit_type="loss",
        tracking_number=None,
        warehouse="LA",
    )
    assert valid_loss.tracking_number is None


# =====================================================================
# 4. SEMILLAS (trackflow-BRIEFING.es.md), LISTADO DE ÓRDENES Y PREVENCIÓN DE N+1
# =====================================================================


def test_seed_inventory_populates_exact_briefing_skus_net_stocks_and_is_idempotent(
    inventory_engine: Any,
    db_session: Session,
) -> None:
    """Verifica los 6 SKUs del BRIEFING, el stock neto entradas-salidas, /inventory/orders y la idempotencia."""
    first_run = seed_inventory(inventory_engine, default_user_uuid="user-tiny-001")
    assert first_run["skus"] == 6
    assert first_run["entries"] >= 4
    assert first_run["exits"] >= 3

    # Segunda ejecución idempotente: no debe duplicar ni SKUs ni movimientos
    second_run = seed_inventory(inventory_engine, default_user_uuid="user-tiny-001")
    assert second_run == {"skus": 0, "entries": 0, "exits": 0}

    products = list_products(session=db_session)
    assert len(products) == 6
    stock_by_code = {item.sku: item.current_stock for item in products}
    assert stock_by_code == {
        "CLT-SNK-W-42": 100,    # LA: (80 + 45) - 25 = 100
        "CLT-SNK-W-42-Z": 58,   # ZGZ: 60 - 2 = 58
        "TEC-EAR-001": 47,      # LA: 50 - 3 = 47
        "CSM-SRM-030": 100,     # ZGZ: 120 - 20 = 100
        "CLT-CHN-N-32": 70,     # LA: 70 - 0 = 70
        "TEC-CHG-065": 90,      # ZGZ: 90 - 0 = 90
    }

    # Filtrado por almacén
    la_products = list_products(warehouse="LA", session=db_session)
    zgz_products = list_products(warehouse="ZGZ", session=db_session)
    assert len(la_products) == 3
    assert len(zgz_products) == 3

    # Listado consolidado de órdenes con datos incrustados del SKU y user_uuid
    orders = list_orders(session=db_session)
    assert len(orders) == first_run["entries"] + first_run["exits"]
    assert all(isinstance(order, StockOrderResponse) for order in orders)
    assert all(order.user_uuid == "user-tiny-001" for order in orders)
    assert all(order.sku.sku in stock_by_code for order in orders)


def test_list_products_and_list_orders_execute_constant_queries_without_n_plus_one(
    db_session: Session,
    seeded_user: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Garantiza que GET /inventory/products y GET /inventory/orders ejecuten O(1) consultas SQL con 15 SKUs."""
    user = seeded_user["user_db"]
    for idx in range(15):
        wh = "LA" if idx % 2 == 0 else "ZGZ"
        created_sku = create_product(
            SKUCreate(
                name=f"Producto Batch {idx}",
                sku=f"BATCH-SKU-{idx:03d}",
                client_name="BatchBrand",
                category="fashion",
                warehouse=wh,  # type: ignore[arg-type]
            ),
            session=db_session,
            _=user,
        )
        create_inbound_order(
            StockEntryCreate(
                sku_id=created_sku.id,
                quantity=20 + idx,
                reference=f"PO-BATCH-{idx:03d}",
                warehouse=wh,  # type: ignore[arg-type]
            ),
            session=db_session,
            current_user=user,
        )
        create_outbound_order(
            StockExitCreate(
                sku_id=created_sku.id,
                quantity=5,
                exit_type="loss",
                tracking_number=None,
                warehouse=wh,  # type: ignore[arg-type]
            ),
            session=db_session,
            current_user=user,
        )

    exec_calls = 0
    original_exec = db_session.exec

    def counting_exec(*args: Any, **kwargs: Any) -> Any:
        nonlocal exec_calls
        exec_calls += 1
        return original_exec(*args, **kwargs)

    monkeypatch.setattr(db_session, "exec", counting_exec)

    products = list_products(session=db_session)
    assert len(products) == 15
    assert exec_calls == 3  # 1 SELECT SKU + 1 GROUP BY StockEntry + 1 GROUP BY StockExit

    exec_calls = 0
    orders = list_orders(session=db_session)
    assert len(orders) == 30
    assert exec_calls == 2  # 1 JOIN StockEntry+SKU + 1 JOIN StockExit+SKU
