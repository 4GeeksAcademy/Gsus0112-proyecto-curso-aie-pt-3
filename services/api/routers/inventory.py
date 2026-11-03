"""Router de gestión centralizada de inventario de TrackFlow (`/inventory`).

Arquitectura de doble base de datos:
- La autenticación (`Depends(get_current_user)`) consulta usuarios en TinyDB.
- Las entidades de negocio (`SKU`, `StockEntry`, `StockExit`) residen en Supabase (PostgreSQL)
  mediante sesiones SQLModel por petición (`Depends(get_db)`).

Decisión documentada sobre la Regla 6 (`trackflow-BRIEFING.es.md`):
- El stock es estrictamente por SKU y por almacén (`"LA"` o `"ZGZ"`), nunca agregado globalmente.
- En `GET /inventory/products` y `GET /inventory/products/{id}`, `current_stock` devuelve el stock
  neto (`entradas - salidas`) acotado al `warehouse` propio de ese registro `SKU`, e incluye además
  `stock_by_warehouse` (`{"LA": ..., "ZGZ": ...}`) con el desglose explícito por ubicación.
"""

from datetime import datetime, timezone
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, col, func, select

from ..database import get_db
from ..models import SKU, StockEntry, StockExit, UserDB
from ..schemas import (
    ExitType,
    SKUCategory,
    SKUCreate,
    SKUResponse,
    SKUSummary,
    StockEntryCreate,
    StockEntryResponse,
    StockExitCreate,
    StockExitResponse,
    StockOrderResponse,
    WarehouseCode,
)
from ..security import get_current_user

router = APIRouter(prefix="/inventory", tags=["Inventory"])


def _resolve_user_uuid(current_user: UserDB) -> str:
    """Obtiene el identificador en cadena del usuario autenticado desde TinyDB."""
    if current_user.uuid and current_user.uuid.strip():
        return current_user.uuid.strip()
    return str(current_user.id)


def _sort_timestamp(value: datetime) -> float:
    """Convierte datetimes con o sin zona horaria a epoch UTC para ordenación determinista."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).timestamp()
    return value.timestamp()


def _compute_stock_map(
    session: Session, sku_ids: list[int] | None = None
) -> dict[tuple[int, str], int]:
    """Calcula el stock neto por `(sku_id, warehouse)` en O(1) consultas agregadas (sin N+1)."""
    if sku_ids is not None and len(sku_ids) == 0:
        return {}

    entry_stmt = select(
        StockEntry.sku_id,
        StockEntry.warehouse,
        func.coalesce(func.sum(StockEntry.quantity), 0),
    )
    exit_stmt = select(
        StockExit.sku_id,
        StockExit.warehouse,
        func.coalesce(func.sum(StockExit.quantity), 0),
    )

    if sku_ids is not None:
        entry_stmt = entry_stmt.where(col(StockEntry.sku_id).in_(sku_ids))
        exit_stmt = exit_stmt.where(col(StockExit.sku_id).in_(sku_ids))

    entry_rows = session.exec(
        entry_stmt.group_by(StockEntry.sku_id, StockEntry.warehouse)
    ).all()
    exit_rows = session.exec(
        exit_stmt.group_by(StockExit.sku_id, StockExit.warehouse)
    ).all()

    stock_map: dict[tuple[int, str], int] = {}
    for row_sku_id, row_warehouse, total_in in entry_rows:
        key = (int(row_sku_id), str(row_warehouse))
        stock_map[key] = stock_map.get(key, 0) + int(total_in)

    for row_sku_id, row_warehouse, total_out in exit_rows:
        key = (int(row_sku_id), str(row_warehouse))
        stock_map[key] = stock_map.get(key, 0) - int(total_out)

    return stock_map


def _compute_available_stock(session: Session, sku_id: int, warehouse: str) -> int:
    """Calcula el stock disponible para un `sku_id` dentro de un `warehouse` específico."""
    entries_total = session.exec(
        select(func.coalesce(func.sum(StockEntry.quantity), 0)).where(
            StockEntry.sku_id == sku_id,
            StockEntry.warehouse == warehouse,
        )
    ).one()
    exits_total = session.exec(
        select(func.coalesce(func.sum(StockExit.quantity), 0)).where(
            StockExit.sku_id == sku_id,
            StockExit.warehouse == warehouse,
        )
    ).one()
    return int(entries_total) - int(exits_total)


def _build_sku_summary(sku_obj: SKU) -> SKUSummary:
    if sku_obj.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="El registro SKU no dispone de un identificador persistido.",
        )
    return SKUSummary(
        id=sku_obj.id,
        name=sku_obj.name,
        sku=sku_obj.sku,
        client_name=sku_obj.client_name,
        category=cast(SKUCategory, sku_obj.category),
        warehouse=cast(WarehouseCode, sku_obj.warehouse),
    )


def _build_sku_response(
    sku_obj: SKU, stock_map: dict[tuple[int, str], int]
) -> SKUResponse:
    if sku_obj.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="El registro SKU no dispone de un identificador persistido.",
        )
    sku_id = sku_obj.id
    la_stock = int(stock_map.get((sku_id, "LA"), 0))
    zgz_stock = int(stock_map.get((sku_id, "ZGZ"), 0))
    current_stock = int(stock_map.get((sku_id, sku_obj.warehouse), 0))
    return SKUResponse(
        id=sku_id,
        name=sku_obj.name,
        sku=sku_obj.sku,
        client_name=sku_obj.client_name,
        category=cast(SKUCategory, sku_obj.category),
        warehouse=cast(WarehouseCode, sku_obj.warehouse),
        current_stock=current_stock,
        stock_by_warehouse={"LA": la_stock, "ZGZ": zgz_stock},
    )


@router.get("/products", response_model=list[SKUResponse])
def list_products(
    warehouse: WarehouseCode | None = None,
    session: Session = Depends(get_db),
) -> list[SKUResponse]:
    """Lista todos los SKUs con su `current_stock` calculado por almacén sin incurrir en N+1."""
    stmt = select(SKU).order_by(col(SKU.id))
    if warehouse is not None:
        stmt = stmt.where(SKU.warehouse == warehouse)

    skus = list(session.exec(stmt).all())
    sku_ids = [s.id for s in skus if s.id is not None]
    stock_map = _compute_stock_map(session, sku_ids)
    return [_build_sku_response(sku_obj, stock_map) for sku_obj in skus]


@router.post(
    "/products",
    response_model=SKUResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    payload: SKUCreate,
    session: Session = Depends(get_db),
    _: UserDB = Depends(get_current_user),
) -> SKUResponse:
    """Registra un nuevo SKU en el catálogo (comienza siempre con `current_stock = 0`)."""
    existing = session.exec(
        select(SKU).where(
            SKU.sku == payload.sku,
            SKU.warehouse == payload.warehouse,
        )
    ).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"SKU '{payload.sku}' already exists in warehouse '{payload.warehouse}'."
            ),
        )

    new_sku = SKU(
        name=payload.name,
        sku=payload.sku,
        client_name=payload.client_name,
        category=payload.category,
        warehouse=payload.warehouse,
    )
    session.add(new_sku)
    session.commit()
    session.refresh(new_sku)
    return _build_sku_response(new_sku, {})


@router.get("/products/{id}", response_model=SKUResponse)
def get_product(
    id: int,
    session: Session = Depends(get_db),
) -> SKUResponse:
    """Obtiene un SKU por su `id` junto con su `current_stock` calculado en su almacén."""
    sku_obj = session.get(SKU, id)
    if sku_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SKU with id {id} not found.",
        )
    stock_map = _compute_stock_map(session, [id])
    return _build_sku_response(sku_obj, stock_map)


@router.post(
    "/orders/inbound",
    response_model=StockEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_inbound_order(
    payload: StockEntryCreate,
    session: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
) -> StockEntryResponse:
    """Registra una orden de entrada (`StockEntry`) trazada al usuario autenticado de TinyDB."""
    sku_obj = session.get(SKU, payload.sku_id)
    if sku_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SKU with id {payload.sku_id} not found.",
        )

    entry = StockEntry(
        sku_id=payload.sku_id,
        quantity=payload.quantity,
        reference=payload.reference,
        warehouse=payload.warehouse,
        user_uuid=_resolve_user_uuid(current_user),
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)

    if entry.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo obtener el identificador de la orden de entrada creada.",
        )

    return StockEntryResponse(
        id=entry.id,
        sku_id=entry.sku_id,
        quantity=entry.quantity,
        reference=entry.reference,
        warehouse=cast(WarehouseCode, entry.warehouse),
        created_at=entry.created_at,
        user_uuid=entry.user_uuid,
    )


@router.post(
    "/orders/outbound",
    response_model=StockExitResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_outbound_order(
    payload: StockExitCreate,
    session: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
) -> StockExitResponse:
    """Registra una orden de salida (`StockExit`) verificando disponibilidad por almacén antes de persistir."""
    sku_obj = session.get(SKU, payload.sku_id)
    if sku_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SKU with id {payload.sku_id} not found.",
        )

    available = _compute_available_stock(session, payload.sku_id, payload.warehouse)
    if payload.quantity > available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Insufficient stock for SKU '{sku_obj.sku}'. "
                f"Available: {available}, requested: {payload.quantity}."
            ),
        )

    exit_record = StockExit(
        sku_id=payload.sku_id,
        quantity=payload.quantity,
        exit_type=payload.exit_type,
        tracking_number=payload.tracking_number,
        warehouse=payload.warehouse,
        user_uuid=_resolve_user_uuid(current_user),
    )
    session.add(exit_record)
    session.commit()
    session.refresh(exit_record)

    if exit_record.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo obtener el identificador de la orden de salida creada.",
        )

    return StockExitResponse(
        id=exit_record.id,
        sku_id=exit_record.sku_id,
        quantity=exit_record.quantity,
        exit_type=cast(ExitType, exit_record.exit_type),
        tracking_number=exit_record.tracking_number,
        warehouse=cast(WarehouseCode, exit_record.warehouse),
        created_at=exit_record.created_at,
        user_uuid=exit_record.user_uuid,
    )


@router.get("/orders", response_model=list[StockOrderResponse])
def list_orders(
    warehouse: WarehouseCode | None = None,
    session: Session = Depends(get_db),
) -> list[StockOrderResponse]:
    """Lista todas las órdenes (`StockEntry` y `StockExit`) precargando `SKU` mediante SQL JOIN (sin N+1)."""
    entry_stmt = select(StockEntry, SKU).join(SKU, col(StockEntry.sku_id) == col(SKU.id))
    exit_stmt = select(StockExit, SKU).join(SKU, col(StockExit.sku_id) == col(SKU.id))

    if warehouse is not None:
        entry_stmt = entry_stmt.where(StockEntry.warehouse == warehouse)
        exit_stmt = exit_stmt.where(StockExit.warehouse == warehouse)

    entry_pairs = session.exec(entry_stmt).all()
    exit_pairs = session.exec(exit_stmt).all()

    orders: list[StockOrderResponse] = []

    for entry, sku_obj in entry_pairs:
        if entry.id is None:
            continue
        orders.append(
            StockOrderResponse(
                id=entry.id,
                order_type="inbound",
                sku_id=entry.sku_id,
                sku=_build_sku_summary(sku_obj),
                quantity=entry.quantity,
                warehouse=cast(WarehouseCode, entry.warehouse),
                reference=entry.reference,
                exit_type=None,
                tracking_number=None,
                created_at=entry.created_at,
                user_uuid=entry.user_uuid,
            )
        )

    for exit_record, sku_obj in exit_pairs:
        if exit_record.id is None:
            continue
        orders.append(
            StockOrderResponse(
                id=exit_record.id,
                order_type="outbound",
                sku_id=exit_record.sku_id,
                sku=_build_sku_summary(sku_obj),
                quantity=exit_record.quantity,
                warehouse=cast(WarehouseCode, exit_record.warehouse),
                reference=None,
                exit_type=cast(ExitType, exit_record.exit_type),
                tracking_number=exit_record.tracking_number,
                created_at=exit_record.created_at,
                user_uuid=exit_record.user_uuid,
            )
        )

    orders.sort(
        key=lambda item: (_sort_timestamp(item.created_at), item.id),
        reverse=True,
    )
    return orders
