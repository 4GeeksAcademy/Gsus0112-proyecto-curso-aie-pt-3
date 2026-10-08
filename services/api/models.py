from enum import Enum

from pydantic import BaseModel, Field


class SupplierStatus(str, Enum):
    active = "active"
    suspended = "suspended"


class SupplierCreate(BaseModel):
    name: str
    country: str
    categories: list[str]
    rate: float = Field(gt=0)
    status: SupplierStatus


class SupplierResponse(SupplierCreate):
    id: int
    updated_at: str | None = None


class SupplierRateUpdate(BaseModel):
    rate: float = Field(gt=0)


class SupplierStatusUpdate(BaseModel):
    status: SupplierStatus