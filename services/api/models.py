"""Modelos del servicio API de TrackFlow:
- Modelos Pydantic para entidades documentales en TinyDB (proveedores, usuarios y perfiles).
- Modelos ORM relacionales con SQLModel (table=True) para el inventario en Supabase (SKU, StockEntry, StockExit).
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict
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
    """Esquema de entrada exclusivo para el alta de un nuevo proveedor."""


class SupplierListItem(BaseModel):
    """Proyección ligera para el listado del directorio de proveedores (sin `updated_at`)."""

    id: int
    name: str
    country: str
    categories: list[str]
    rate_per_shipment: float = PydanticField(gt=0)
    currency: str
    service_zone: str
    contact_email: str
    notes: str | None = None
    status: SupplierStatus


class SupplierResponse(BaseModel):
    """Esquema explícito de detalle y confirmación de escritura de un proveedor."""

    id: int
    name: str
    country: str
    categories: list[str]
    rate_per_shipment: float = PydanticField(gt=0)
    currency: str
    service_zone: str
    contact_email: str
    notes: str | None = None
    status: SupplierStatus
    updated_at: str | None = None


class SupplierRateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rate_per_shipment: float = PydanticField(gt=0)


class SupplierStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: SupplierStatus


class RoleEnum(str, Enum):
    admin = "admin"
    manager = "manager"
    user = "user"


class TokenResponse(BaseModel):
    """Contrato explícito de emisión de JWT en `POST /auth/login`."""

    access_token: str
    token_type: Literal["bearer"] = "bearer"


class MessageResponse(BaseModel):
    """Respuesta genérica de confirmación sin exponer credenciales, emails ni tokens."""

    detail: str


class CurrentUserResponse(BaseModel):
    """Proyección combinada del usuario autenticado y su perfil para `GET /auth/me`."""

    email: str
    role: RoleEnum
    name: str
    phone: str
    address: str


class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = PydanticField(
        min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
    )
    password: str = PydanticField(min_length=1, max_length=72)
    role: RoleEnum = RoleEnum.user
    name: str | None = None
    phone: str | None = None
    address: str | None = None


class UserRegistrationResponse(BaseModel):
    """Respuesta segura tras registro público (`POST /users`): nunca reenvía `email` ni credenciales."""

    id: int
    is_active: bool = True
    role: RoleEnum
    created_at: str


class UserListItem(BaseModel):
    """Proyección ligera para el listado `GET /users` (omite `created_at` y credenciales)."""

    id: int
    email: str
    is_active: bool = True
    role: RoleEnum


class UserResponse(BaseModel):
    """Esquema explícito de detalle de cuenta (`GET /users/{id}`, `PUT /users/{id}`)."""

    id: int
    email: str
    is_active: bool = True
    role: RoleEnum
    created_at: str


class UserDB(BaseModel):
    """Modelo interno de persistencia en TinyDB; nunca se expone como `response_model`."""

    id: int
    email: str
    is_active: bool = True
    role: RoleEnum
    created_at: str
    hashed_password: str
    password_changed_at: str | None = None
    uuid: str | None = None


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = PydanticField(min_length=1, max_length=254)


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = PydanticField(min_length=1, max_length=2048)
    new_password: str = PydanticField(min_length=1, max_length=72)


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = PydanticField(min_length=1, max_length=72)
    new_password: str = PydanticField(min_length=1, max_length=72)


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str | None = PydanticField(
        default=None,
        min_length=3,
        max_length=254,
        pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$",
    )
    role: RoleEnum | None = None


class ProfileDB(BaseModel):
    """Modelo interno de persistencia documental de perfil en TinyDB."""

    id: int
    user_id: int
    name: str
    phone: str
    address: str


class ProfileResponse(BaseModel):
    """Esquema público de perfil propio (`GET/PUT /profiles/me`), sin `id` interno ni FK `user_id`."""

    name: str
    phone: str
    address: str


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

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
