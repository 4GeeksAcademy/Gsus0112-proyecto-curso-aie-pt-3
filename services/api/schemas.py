"""Schemas Pydantic independientes de los modelos ORM SQLModel para el dominio de inventario de TrackFlow.

Estos schemas definen los contratos de entrada (request) y salida (response) de `/inventory`.
Ningún endpoint devuelve instancias `SQLModel` directamente.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

WarehouseCode = Literal["LA", "ZGZ"]
SKUCategory = Literal["fashion", "electronics", "cosmetics"]
ExitType = Literal["dispatch", "loss"]
OrderMovementType = Literal["inbound", "outbound"]


class SKUCreate(BaseModel):
    """Datos requeridos para dar de alta un nuevo SKU en un almacén de TrackFlow.

    `extra="forbid"` impide inyectar `current_stock` directamente en la creación.
    """

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255)
    sku: str = Field(min_length=1, max_length=120)
    client_name: str = Field(min_length=1, max_length=255)
    category: SKUCategory
    warehouse: WarehouseCode

    @field_validator("name", "sku", "client_name")
    @classmethod
    def _strip_and_require_non_empty(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("El campo no puede estar vacío ni contener solo espacios.")
        return cleaned


class SKUResponse(BaseModel):
    """Representación de respuesta de un SKU incluyendo su `current_stock` calculado por almacén."""

    id: int
    name: str
    sku: str
    client_name: str
    category: SKUCategory
    warehouse: WarehouseCode
    current_stock: int
    stock_by_warehouse: dict[str, int]


class SKUSummary(BaseModel):
    """Datos resumidos del SKU incrustados al listar órdenes en `GET /inventory/orders`."""

    id: int
    name: str
    sku: str
    client_name: str
    category: SKUCategory
    warehouse: WarehouseCode


class StockEntryCreate(BaseModel):
    """Payload para registrar una recepción de mercancía (`POST /inventory/orders/inbound`)."""

    sku_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    reference: str = Field(min_length=1, max_length=150)
    warehouse: WarehouseCode

    @field_validator("reference")
    @classmethod
    def _strip_reference(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("El campo 'reference' no puede estar vacío.")
        return cleaned


class StockEntryResponse(BaseModel):
    """Respuesta tras registrar una recepción de mercancía (`StockEntry`)."""

    id: int
    sku_id: int
    quantity: int
    reference: str
    warehouse: WarehouseCode
    created_at: datetime
    user_uuid: str


class StockExitCreate(BaseModel):
    """Payload para registrar un despacho o baja de inventario (`POST /inventory/orders/outbound`)."""

    sku_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    exit_type: ExitType
    tracking_number: str | None = None
    warehouse: WarehouseCode

    @model_validator(mode="after")
    def _validate_tracking_number_by_exit_type(self) -> "StockExitCreate":
        if self.exit_type == "dispatch":
            if self.tracking_number is None or not self.tracking_number.strip():
                raise ValueError(
                    "tracking_number is required when exit_type is 'dispatch'."
                )
            self.tracking_number = self.tracking_number.strip()
        elif self.exit_type == "loss":
            if self.tracking_number is not None:
                raise ValueError(
                    "tracking_number must be null when exit_type is 'loss'."
                )
        return self


class StockExitResponse(BaseModel):
    """Respuesta tras registrar una salida de inventario (`StockExit`)."""

    id: int
    sku_id: int
    quantity: int
    exit_type: ExitType
    tracking_number: str | None = None
    warehouse: WarehouseCode
    created_at: datetime
    user_uuid: str


class StockOrderResponse(BaseModel):
    """Movimiento consolidado de inventario (`StockEntry` o `StockExit`) con datos del `SKU` y `user_uuid`."""

    id: int
    order_type: OrderMovementType
    sku_id: int
    sku: SKUSummary
    quantity: int
    warehouse: WarehouseCode
    reference: str | None = None
    exit_type: ExitType | None = None
    tracking_number: str | None = None
    created_at: datetime
    user_uuid: str
