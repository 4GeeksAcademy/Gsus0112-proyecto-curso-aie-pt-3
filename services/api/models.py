"""Modelos del servicio API de TrackFlow:
- Modelos Pydantic para entidades documentales en TinyDB (proveedores, usuarios y perfiles).
- Modelos ORM relacionales con SQLModel (table=True) para el inventario en Supabase (SKU, StockEntry, StockExit).
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel
from pydantic import Field as PydanticField
from sqlmodel import Field, Relationship, SQLModel


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


# =====================================================================
# Modelos TinyDB (Autenticación, Usuarios, Perfiles y Proveedores)
# =====================================================================


class SupplierStatus(str, Enum):
    active = "active"
    suspended = "suspended"


class SupplierBase(BaseModel):
    name: str
    country: str
    categories: list[str]
    rate_per_shipment: float = PydanticField(gt=0)
    currency: str
    service_zone: str
    contact_email: str = PydanticField(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    notes: str | None = None
    status: SupplierStatus


class SupplierCreate(SupplierBase):
    pass


class SupplierResponse(SupplierCreate):
    id: int
    updated_at: str | None = None


class SupplierRateUpdate(BaseModel):
    rate_per_shipment: float = PydanticField(gt=0)


class SupplierStatusUpdate(BaseModel):
    status: SupplierStatus


class RoleEnum(str, Enum):
    admin = "admin"
    manager = "manager"
    user = "user"


class UserCreate(BaseModel):
    email: str = PydanticField(
        min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
    )
    password: str = PydanticField(min_length=1, max_length=72)
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
    password_changed_at: str | None = None
    uuid: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: str = PydanticField(min_length=1, max_length=254)


class ResetPasswordRequest(BaseModel):
    token: str = PydanticField(min_length=1, max_length=2048)
    new_password: str = PydanticField(min_length=1, max_length=72)


class ChangePasswordRequest(BaseModel):
    current_password: str = PydanticField(min_length=1, max_length=72)
    new_password: str = PydanticField(min_length=1, max_length=72)


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


# =====================================================================
# Modelos ORM SQLModel — Supabase PostgreSQL (Gestión de Inventario)
# =====================================================================


class SKU(SQLModel, table=True):
    """Catálogo de referencias logísticas gestionadas por TrackFlow en Los Ángeles (LA) y Zaragoza (ZGZ).

    Nota de dominio: `current_stock` NUNCA se almacena como columna; se deriva siempre de
    SUMA(StockEntry.quantity) - SUMA(StockExit.quantity) acotada por almacén.
    """

    __tablename__ = "sku"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    sku: str = Field(index=True)
    client_name: str
    category: str
    warehouse: str = Field(index=True)

    entries: list["StockEntry"] = Relationship(back_populates="sku")
    exits: list["StockExit"] = Relationship(back_populates="sku")


class StockEntry(SQLModel, table=True):
    """Recepción de mercancía entrante desde una marca cliente hacia un almacén de TrackFlow."""

    __tablename__ = "stockentry"

    id: int | None = Field(default=None, primary_key=True)
    sku_id: int = Field(foreign_key="sku.id", index=True)
    quantity: int = Field(gt=0)
    reference: str
    warehouse: str = Field(index=True)
    created_at: datetime = Field(default_factory=_utc_now)
    # Cadena que referencia al usuario autenticado en TinyDB (sin FK ni tabla User en Supabase)
    user_uuid: str = Field(index=True)

    sku: Optional[SKU] = Relationship(back_populates="entries")


class StockExit(SQLModel, table=True):
    """Salida de inventario por despacho a cliente final ('dispatch') o baja confirmada ('loss')."""

    __tablename__ = "stockexit"

    id: int | None = Field(default=None, primary_key=True)
    sku_id: int = Field(foreign_key="sku.id", index=True)
    quantity: int = Field(gt=0)
    exit_type: str
    tracking_number: str | None = Field(default=None)
    warehouse: str = Field(index=True)
    created_at: datetime = Field(default_factory=_utc_now)
    # Cadena que referencia al usuario autenticado en TinyDB (sin FK ni tabla User en Supabase)
    user_uuid: str = Field(index=True)

    sku: Optional[SKU] = Relationship(back_populates="exits")
