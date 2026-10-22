from enum import Enum

from pydantic import BaseModel, Field


class SupplierStatus(str, Enum):
    active = "active"
    suspended = "suspended"


class SupplierBase(BaseModel):
    name: str
    country: str
    categories: list[str]
    rate_per_shipment: float = Field(gt=0)
    currency: str
    service_zone: str
    contact_email: str = Field(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    notes: str | None = None
    status: SupplierStatus


class SupplierCreate(SupplierBase):
    pass


class SupplierResponse(SupplierCreate):
    id: int
    updated_at: str | None = None


class SupplierRateUpdate(BaseModel):
    rate_per_shipment: float = Field(gt=0)


class SupplierStatusUpdate(BaseModel):
    status: SupplierStatus


class RoleEnum(str, Enum):
    admin = "admin"
    manager = "manager"
    user = "user"


class UserCreate(BaseModel):
    email: str
    password: str = Field(max_length=72)
    role: RoleEnum = RoleEnum.user
    name: str | None = None
    phone: str | None = None
    address: str | None = None


class UserResponse(BaseModel):
    id: int
    email: str
    is_active: bool = True
    role: RoleEnum
    created_at: str


class UserDB(UserResponse):
    hashed_password: str


class UserUpdate(BaseModel):
    email: str | None = None
    role: RoleEnum | None = None


class ProfileDB(BaseModel):
    id: int
    user_id: int
    name: str
    phone: str
    address: str


class ProfileUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    address: str | None = None