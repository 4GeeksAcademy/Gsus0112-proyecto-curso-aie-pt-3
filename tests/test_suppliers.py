"""Pruebas unitarias para los endpoints de proveedores del backoffice (/api/suppliers — Ticket API-042)."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from services.api.models import (
    SupplierCreate,
    SupplierRateUpdate,
    SupplierStatus,
    SupplierStatusUpdate,
)
from services.api.routes import suppliers as suppliers_routes
from services.api.routes.suppliers import (
    create_supplier,
    delete_supplier,
    get_supplier,
    list_suppliers,
    update_supplier_rate,
    update_supplier_status,
)

VALID_SUPPLIER_DATA: dict[str, Any] = {
    "name": "Iberia Cargo Express",
    "country": "ES",
    "categories": ["last mile delivery", "cold chain"],
    "rate_per_shipment": 14.5,
    "currency": "EUR",
    "service_zone": "Península",
    "contact_email": "operaciones@iberiacargo.es",
    "notes": "Prioridad rutas nocturnas",
    "status": SupplierStatus.active,
}


# =====================================================================
# 1. CAMINO FELIZ (Happy Path)
# =====================================================================


def test_supplier_lifecycle_create_read_update_rate_status_and_delete(
    seeded_user: dict[str, Any], memory_db: dict[str, Any]
) -> None:
    """Valida el ciclo completo de negocio de un proveedor: alta, consulta, cambio de tarifa/estado y baja."""
    user = seeded_user["user_db"]
    created = create_supplier(SupplierCreate(**VALID_SUPPLIER_DATA), current_user=user)
    supplier_id = created.id
    assert created.updated_at is not None

    # Actualizar tarifa por envío
    rate_updated = update_supplier_rate(
        supplier_id,
        SupplierRateUpdate(rate_per_shipment=18.75),
        current_user=user,
    )
    assert rate_updated.rate_per_shipment == 18.75
    assert memory_db["suppliers"].get(doc_id=supplier_id)["rate_per_shipment"] == 18.75

    # Suspender proveedor
    status_updated = update_supplier_status(
        supplier_id,
        SupplierStatusUpdate(status=SupplierStatus.suspended),
        current_user=user,
    )
    assert status_updated.status == SupplierStatus.suspended

    # Eliminar proveedor
    del_res = delete_supplier(supplier_id, current_user=user)
    assert del_res.status_code == 204
    assert memory_db["suppliers"].get(doc_id=supplier_id) is None


# =====================================================================
# 2. CASOS LÍMITE (Edge Cases)
# =====================================================================


def test_list_suppliers_filters_by_country_and_category_intersection(
    seeded_user: dict[str, Any],
) -> None:
    """Verifica el filtrado individual y combinado (país + categoría) y el retorno vacío sin coincidencias."""
    user = seeded_user["user_db"]
    create_supplier(SupplierCreate(**VALID_SUPPLIER_DATA), current_user=user)
    create_supplier(
        SupplierCreate(
            **{
                **VALID_SUPPLIER_DATA,
                "name": "Nordic Freight",
                "country": "SE",
                "categories": ["customs"],
            }
        ),
        current_user=user,
    )

    by_country = list_suppliers(country="ES", current_user=user)
    assert len(by_country) == 1
    assert by_country[0].name == "Iberia Cargo Express"

    combined = list_suppliers(country="ES", category="cold chain", current_user=user)
    assert len(combined) == 1

    no_match = list_suppliers(country="ES", category="customs", current_user=user)
    assert no_match == []


# =====================================================================
# 3. MODOS DE FALLO (Failure Modes)
# =====================================================================


def test_suppliers_rejects_nonpositive_rates_invalid_email_and_missing_records(
    seeded_user: dict[str, Any],
) -> None:
    """Rechaza tarifas <= 0, emails inválidos y lanza 404 para proveedores inexistentes."""
    user = seeded_user["user_db"]
    with pytest.raises(ValidationError):
        SupplierCreate(**{**VALID_SUPPLIER_DATA, "rate_per_shipment": 0})

    with pytest.raises(ValidationError):
        SupplierCreate(**{**VALID_SUPPLIER_DATA, "contact_email": "email-invalido"})

    with pytest.raises(HTTPException) as exc_get:
        get_supplier(999, current_user=user)
    assert exc_get.value.status_code == 404

    with pytest.raises(HTTPException) as exc_rate:
        update_supplier_rate(
            999, SupplierRateUpdate(rate_per_shipment=10.0), current_user=user
        )
    assert exc_rate.value.status_code == 404

    with pytest.raises(HTTPException) as exc_status:
        update_supplier_status(
            999,
            SupplierStatusUpdate(status=SupplierStatus.suspended),
            current_user=user,
        )
    assert exc_status.value.status_code == 404

    with pytest.raises(HTTPException) as exc_del:
        delete_supplier(999, current_user=user)
    assert exc_del.value.status_code == 404


def test_suppliers_endpoints_handle_storage_oserrors(
    seeded_user: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Verifica que fallos OSError en la tabla de proveedores lanzan HTTPException 500."""
    user = seeded_user["user_db"]
    broken = MagicMock()
    broken.insert.side_effect = OSError("Insert error")
    broken.all.side_effect = OSError("All error")
    broken.get.side_effect = OSError("Get error")
    broken.update.side_effect = OSError("Update error")
    broken.remove.side_effect = OSError("Remove error")
    monkeypatch.setattr(suppliers_routes, "suppliers", broken)

    with pytest.raises(HTTPException) as exc_create:
        create_supplier(SupplierCreate(**VALID_SUPPLIER_DATA), current_user=user)
    assert exc_create.value.status_code == 500

    with pytest.raises(HTTPException) as exc_list:
        list_suppliers(current_user=user)
    assert exc_list.value.status_code == 500

    with pytest.raises(HTTPException) as exc_get:
        get_supplier(1, current_user=user)
    assert exc_get.value.status_code == 500

    with pytest.raises(HTTPException) as exc_rate:
        update_supplier_rate(
            1, SupplierRateUpdate(rate_per_shipment=12.0), current_user=user
        )
    assert exc_rate.value.status_code == 500

    with pytest.raises(HTTPException) as exc_status:
        update_supplier_status(
            1, SupplierStatusUpdate(status=SupplierStatus.active), current_user=user
        )
    assert exc_status.value.status_code == 500

    with pytest.raises(HTTPException) as exc_del:
        delete_supplier(1, current_user=user)
    assert exc_del.value.status_code == 500
