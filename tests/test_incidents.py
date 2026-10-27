"""Pruebas unitarias para los endpoints de incidencias del backoffice (/api/incidents — Ticket API-042)."""

from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi import HTTPException

from services.api.main import (
    analyze_incidents,
    create_new_incident,
    export_results,
    patch_incident_status,
    read_incident_detail,
    read_incidents,
    read_incidents_summary,
)
from tests.conftest import run_async

VALID_INCIDENT_PAYLOAD = {
    "title": "  Retraso en ruta troncal Madrid-Zaragoza  ",
    "description": "  Camión detenido por avería mecánica en A-2 km 140 durante el reparto nocturno.  ",
    "category": "carrier_issue",
    "origin": "branch",
    "branch": "zaragoza_warehouse",
}


class _StubRequest:
    """Stub ligero de Request para probar la decisión del endpoint sin serialización HTTP."""

    def __init__(self, payload: Any, *, raise_error: bool = False) -> None:
        self._payload = payload
        self._raise_error = raise_error

    async def json(self) -> Any:
        if self._raise_error:
            raise ValueError("Invalid JSON")
        return self._payload


class _StubUploadFile:
    """Stub ligero de UploadFile para probar el análisis de CSV en memoria."""

    def __init__(self, filename: str, content: bytes) -> None:
        self.filename = filename
        self._content = content

    async def read(self) -> bytes:
        return self._content


# =====================================================================
# 1. CAMINO FELIZ (Happy Path)
# =====================================================================


def test_create_list_summary_and_transition_incident_status() -> None:
    """Crea una incidencia normalizada, verifica métricas en /summary y ejecuta transiciones válidas."""
    created = run_async(create_new_incident(_StubRequest(VALID_INCIDENT_PAYLOAD)))  # type: ignore[arg-type]
    incident_id = created["id"]

    # Los espacios laterales deben haberse recortado y el estado inicial debe ser 'open'
    assert created["title"] == "Retraso en ruta troncal Madrid-Zaragoza"
    assert created["status"] == "open"

    # Transición válida: open -> in_progress -> resolved
    in_progress = run_async(
        patch_incident_status(incident_id, _StubRequest({"status": "in_progress"}))  # type: ignore[arg-type]
    )
    assert in_progress["status"] == "in_progress"

    resolved = run_async(
        patch_incident_status(incident_id, _StubRequest({"status": "resolved"}))  # type: ignore[arg-type]
    )
    assert resolved["status"] == "resolved"

    detail = read_incident_detail(incident_id)
    assert detail["status"] == "resolved"

    # Verificar agregación en read_incidents_summary
    summary = read_incidents_summary()
    assert summary["total"] == 1
    assert summary["by_status"]["resolved"] == 1
    assert summary["by_branch"]["zaragoza_warehouse"] == 1


def test_analyze_csv_and_export_results() -> None:
    """Procesa un archivo CSV de incidencias y exporta el resumen de métricas."""
    csv_content = (
        "incident_id,date,category,status,country,satisfaction_score,description\n"
        "INC-1,2026-10-01,delivery_delay,resolved,ES,4,Entrega tardía en almacén central\n"
        "INC-2,2026-10-02,damaged_goods,open,MX,2,Caja golpeada durante el transporte\n"
    ).encode("utf-8")

    results = run_async(
        analyze_incidents(_StubUploadFile("incidents.csv", csv_content))  # type: ignore[arg-type]
    )
    assert results["total_records"] == 2

    export_res = export_results()
    assert export_res.media_type == "text/csv; charset=utf-8"


# =====================================================================
# 2. CASOS LÍMITE (Edge Cases)
# =====================================================================


def test_list_incidents_ignores_whitespace_filters_and_filters_by_exact_match() -> None:
    """Filtros vacíos o con espacios se ignoran; filtros válidos devuelven solo las coincidencias."""
    run_async(create_new_incident(_StubRequest(VALID_INCIDENT_PAYLOAD)))  # type: ignore[arg-type]

    matched = read_incidents(status="  ", origin="", branch="zaragoza_warehouse")
    assert len(matched) == 1

    unmatched = read_incidents(branch="central")
    assert unmatched == []


# =====================================================================
# 3. MODOS DE FALLO (Failure Modes)
# =====================================================================


def test_incident_rejects_invalid_status_transition_from_terminal_state() -> None:
    """Una incidencia en estado final ('resolved' o 'discarded') no puede volver a 'open'."""
    created = run_async(create_new_incident(_StubRequest(VALID_INCIDENT_PAYLOAD)))  # type: ignore[arg-type]
    incident_id = created["id"]

    discarded = run_async(
        patch_incident_status(incident_id, _StubRequest({"status": "discarded"}))  # type: ignore[arg-type]
    )
    assert discarded["status"] == "discarded"

    # Intentar reabrir desde estado terminal debe devolver respuesta de error 400
    reopen_res = run_async(
        patch_incident_status(incident_id, _StubRequest({"status": "open"}))  # type: ignore[arg-type]
    )
    assert reopen_res.status_code == 400
    assert json.loads(reopen_res.body)["field"] == "status"


def test_incidents_reject_invalid_filters_missing_ids_and_invalid_csv() -> None:
    """Valida errores 400/404 ante filtros fuera de catálogo, IDs inexistentes y archivos inválidos."""
    assert read_incidents(status="invalido").status_code == 400
    assert read_incidents(origin="invalido").status_code == 400
    assert read_incidents(branch="INVALID").status_code == 400
    assert read_incidents(category="invalida").status_code == 400

    assert read_incident_detail(9999).status_code == 404
    assert (
        run_async(
            patch_incident_status(9999, _StubRequest({"status": "in_progress"}))  # type: ignore[arg-type]
        ).status_code
        == 404
    )

    with pytest.raises(HTTPException) as exc_ext:
        run_async(analyze_incidents(_StubUploadFile("datos.txt", b"contenido")))  # type: ignore[arg-type]
    assert exc_ext.value.status_code == 400

    with pytest.raises(HTTPException) as exc_empty:
        run_async(analyze_incidents(_StubUploadFile("vacio.csv", b"   ")))  # type: ignore[arg-type]
    assert exc_empty.value.status_code == 400

    with pytest.raises(HTTPException) as exc_export:
        export_results()
    assert exc_export.value.status_code == 404
