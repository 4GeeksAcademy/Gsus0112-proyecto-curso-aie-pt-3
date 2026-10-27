from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from tinydb import Query

from ..database import suppliers
from ..models import (
    SupplierCreate,
    SupplierRateUpdate,
    SupplierResponse,
    SupplierStatusUpdate,
    UserDB,
)
from ..security import get_current_user

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.post("", response_model=SupplierResponse, status_code=201)
def create_supplier(
    supplier: SupplierCreate, current_user: UserDB = Depends(get_current_user)
) -> SupplierResponse:
    data = supplier.model_dump(mode="json")
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        supplier_id = suppliers.insert(data)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="No se pudo registrar el proveedor en este momento.",
        ) from exc
    return SupplierResponse(id=supplier_id, **data)


@router.get("", response_model=list[SupplierResponse])
def list_suppliers(
    country: str | None = None,
    category: str | None = None,
    current_user: UserDB = Depends(get_current_user),
) -> list[SupplierResponse]:
    query = Query()
    condition = None
    if country is not None:
        condition = query.country == country
    if category is not None:
        category_condition = query.categories.any([category])
        condition = (
            category_condition if condition is None else condition & category_condition
        )
    try:
        records = suppliers.all() if condition is None else suppliers.search(condition)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="No se pudo obtener el directorio de proveedores.",
        ) from exc
    return [SupplierResponse(id=record.doc_id, **record) for record in records]


@router.get("/{id}", response_model=SupplierResponse)
def get_supplier(
    id: int, current_user: UserDB = Depends(get_current_user)
) -> SupplierResponse:
    try:
        record = suppliers.get(doc_id=id)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="No se pudo consultar el proveedor solicitado.",
        ) from exc
    if record is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return SupplierResponse(id=record.doc_id, **record)


@router.patch("/{id}/rate", response_model=SupplierResponse)
def update_supplier_rate(
    id: int,
    update: SupplierRateUpdate,
    current_user: UserDB = Depends(get_current_user),
) -> SupplierResponse:
    data = {"rate_per_shipment": update.rate_per_shipment}
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        updated_ids = suppliers.update(data, doc_ids=[id])
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="No se pudo actualizar la tarifa del proveedor.",
        ) from exc
    if not updated_ids:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return get_supplier(id, current_user)


@router.patch("/{id}/status", response_model=SupplierResponse)
def update_supplier_status(
    id: int,
    update: SupplierStatusUpdate,
    current_user: UserDB = Depends(get_current_user),
) -> SupplierResponse:
    data = update.model_dump(mode="json")
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        updated_ids = suppliers.update(data, doc_ids=[id])
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="No se pudo actualizar el estado del proveedor.",
        ) from exc
    if not updated_ids:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return get_supplier(id, current_user)


@router.delete("/{id}", status_code=204)
def delete_supplier(
    id: int, current_user: UserDB = Depends(get_current_user)
) -> Response:
    try:
        removed_ids = suppliers.remove(doc_ids=[id])
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="No se pudo eliminar el proveedor.",
        ) from exc
    if not removed_ids:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return Response(status_code=204)