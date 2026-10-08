from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Response
from tinydb import Query

from ..database import suppliers
from ..models import (
    SupplierCreate,
    SupplierRateUpdate,
    SupplierResponse,
    SupplierStatusUpdate,
)

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.post("", response_model=SupplierResponse, status_code=201)
def create_supplier(supplier: SupplierCreate) -> SupplierResponse:
    data = supplier.model_dump(mode="json")
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    supplier_id = suppliers.insert(data)
    return SupplierResponse(id=supplier_id, **data)


@router.get("", response_model=list[SupplierResponse])
def list_suppliers(
    country: str | None = None, category: str | None = None
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
    records = suppliers.all() if condition is None else suppliers.search(condition)
    return [SupplierResponse(id=record.doc_id, **record) for record in records]


@router.get("/{id}", response_model=SupplierResponse)
def get_supplier(id: int) -> SupplierResponse:
    record = suppliers.get(doc_id=id)
    if record is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return SupplierResponse(id=record.doc_id, **record)


@router.patch("/{id}/rate", response_model=SupplierResponse)
def update_supplier_rate(id: int, update: SupplierRateUpdate) -> SupplierResponse:
    data = update.model_dump(mode="json")
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if not suppliers.update(data, doc_ids=[id]):
        raise HTTPException(status_code=404, detail="Supplier not found")
    return get_supplier(id)


@router.patch("/{id}/status", response_model=SupplierResponse)
def update_supplier_status(id: int, update: SupplierStatusUpdate) -> SupplierResponse:
    data = update.model_dump(mode="json")
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if not suppliers.update(data, doc_ids=[id]):
        raise HTTPException(status_code=404, detail="Supplier not found")
    return get_supplier(id)


@router.delete("/{id}", status_code=204)
def delete_supplier(id: int) -> Response:
    if not suppliers.remove(doc_ids=[id]):
        raise HTTPException(status_code=404, detail="Supplier not found")
    return Response(status_code=204)