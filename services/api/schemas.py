"""Schemas Pydantic independientes de los modelos ORM SQLModel y de persistencia local de TrackFlow.

Estos schemas definen los contratos explícitos de entrada (request) y salida (response) de `/inventory`
y `/api/incidents`. Ningún endpoint devuelve instancias `SQLModel` ni diccionarios sin filtrar.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

WarehouseCode = Literal["LA", "ZGZ"]
SKUCategory = Literal["fashion", "electronics", "cosmetics"]
ExitType = Literal["dispatch", "loss"]
OrderMovementType = Literal["inbound", "outbound"]

IncidentStatusLiteral = Literal["open", "in_progress", "resolved", "discarded"]
IncidentOriginLiteral = Literal["customer", "branch", "internal"]
IncidentBranchLiteral = Literal[
    "central",
    "la_warehouse",
    "la_office",
    "zaragoza_warehouse",
    "zaragoza_office",
]
IncidentCategoryLiteral = Literal[
    "lost_parcel",
    "carrier_issue",
    "delivery_failure",
    "returns_issue",
    "inventory_discrepancy",
]


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


class SKUListItem(BaseModel):
    """Proyección plana y ligera para `GET /inventory/products` (omite `stock_by_warehouse`)."""

    model_config = ConfigDict(frozen=True)

    id: int
    name: str
    sku: str
    client_name: str
    category: SKUCategory
    warehouse: WarehouseCode
    current_stock: int


class SKUResponse(BaseModel):
    """Representación de detalle y creación de un SKU incluyendo desglose `stock_by_warehouse`."""

    id: int
    name: str
    sku: str
    client_name: str
    category: SKUCategory
    warehouse: WarehouseCode
    current_stock: int
    stock_by_warehouse: dict[str, int]


class SKUSummary(BaseModel):
    """Proyección ligera del SKU incrustada al listar órdenes en `GET /inventory/orders`."""

    model_config = ConfigDict(frozen=True)

    id: int
    name: str
    sku: str
    client_name: str
    category: SKUCategory


class StockEntryCreate(BaseModel):
    """Payload para registrar una recepción de mercancía (`POST /inventory/orders/inbound`)."""

    model_config = ConfigDict(extra="forbid")

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

    model_config = ConfigDict(extra="forbid")

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
    """Movimiento consolidado de inventario con proyección `SKUSummary` (sin FK `sku_id` duplicada)."""

    model_config = ConfigDict(frozen=True)

    id: int
    order_type: OrderMovementType
    sku: SKUSummary
    quantity: int
    warehouse: WarehouseCode
    reference: str | None = None
    exit_type: ExitType | None = None
    tracking_number: str | None = None
    created_at: datetime
    user_uuid: str


# =====================================================================
# Schemas Pydantic — Gestor y Analizador de Incidencias (`/api/incidents`)
# =====================================================================


class IncidentCreateRequest(BaseModel):
    """Esquema de entrada para `POST /api/incidents` (solo atributos escribibles)."""

    model_config = ConfigDict(extra="forbid")

    title: str
    description: str
    category: str
    origin: str
    branch: str
    status: str | None = "open"


class IncidentStatusUpdateRequest(BaseModel):
    """Esquema de entrada para `PATCH /api/incidents/{incident_id}/status`."""

    model_config = ConfigDict(extra="forbid")

    status: str


class IncidentListItem(BaseModel):
    """Proyección ligera para `GET /api/incidents` (omite `updated_at` y `source_ref`)."""

    id: int
    title: str
    description: str
    category: IncidentCategoryLiteral
    status: IncidentStatusLiteral
    origin: IncidentOriginLiteral
    branch: IncidentBranchLiteral
    created_at: str


class IncidentDetailResponse(BaseModel):
    """Esquema completo de detalle y confirmación de escritura de una incidencia (sin `source_ref`)."""

    id: int
    title: str
    description: str
    category: IncidentCategoryLiteral
    status: IncidentStatusLiteral
    origin: IncidentOriginLiteral
    branch: IncidentBranchLiteral
    created_at: str
    updated_at: str


class IncidentsSummaryResponse(BaseModel):
    """Resumen agregado de métricas para `GET /api/incidents/summary`."""

    total: int
    by_status: dict[str, int]
    by_category: dict[str, int]
    by_origin: dict[str, int]
    by_branch: dict[str, int]


class IncidentAnalysisResponse(BaseModel):
    """Métricas de análisis por lotes consumidas por `IncidentsAnalysis.tsx` (sin mapas internos extra)."""

    total_records: int
    valid_records: int
    invalid_records: int
    invalid_reasons: dict[str, int]
    average_satisfaction: float | None
