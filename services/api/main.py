"""API de gestión y análisis centralizado de incidencias de TrackFlow."""

from __future__ import annotations

import csv
import io
import sys
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from packages.shared.incident_analyzer import process_csv_data  # noqa: E402
from packages.shared.incident_rules import (  # noqa: E402
    VALID_BRANCHES,
    VALID_MODEL_CATEGORIES,
    VALID_ORIGINS,
    VALID_STATUSES,
    validate_incident_payload,
    validate_status_transition,
)
from services.api.database import (  # noqa: E402
    create_incident,
    get_incident_by_id,
    get_incidents_summary,
    init_db,
    list_incidents,
    update_incident_status,
)

app = FastAPI(title="TrackFlow Incident Manager API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

last_analysis: dict[str, Any] | None = None


def _validation_error_response(field: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={
            "error": message,
            "message": message,
            "detail": message,
            "field": field,
        },
    )


@app.exception_handler(RequestValidationError)
async def handle_request_validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = exc.errors()
    field = "body"
    message = "Los datos enviados no tienen el formato esperado."
    if errors:
        first = errors[0]
        loc = first.get("loc", ())
        if len(loc) > 1:
            field = str(loc[-1])
        message = f"Valor inválido en el campo '{field}': {first.get('msg', 'formato incorrecto')}."
    return _validation_error_response(field, message)


@app.exception_handler(Exception)
async def handle_unexpected_exception(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "error": "Ha ocurrido un error interno en el servidor. Por favor, inténtalo de nuevo más tarde.",
            "message": "Ha ocurrido un error interno en el servidor. Por favor, inténtalo de nuevo más tarde.",
            "detail": "Ha ocurrido un error interno en el servidor. Por favor, inténtalo de nuevo más tarde.",
        },
    )


@app.get("/api/incidents/summary")
def read_incidents_summary() -> dict[str, Any]:
    return get_incidents_summary()


@app.get("/api/incidents")
def read_incidents(
    status: Optional[str] = None,
    origin: Optional[str] = None,
    branch: Optional[str] = None,
    category: Optional[str] = None,
) -> Any:
    if status is not None and status.strip() != "":
        cleaned_status = status.strip()
        if cleaned_status not in VALID_STATUSES:
            return _validation_error_response(
                "status",
                f"El filtro status '{cleaned_status}' no es válido. Valores permitidos: {', '.join(VALID_STATUSES)}.",
            )
    else:
        cleaned_status = None

    if origin is not None and origin.strip() != "":
        cleaned_origin = origin.strip()
        if cleaned_origin not in VALID_ORIGINS:
            return _validation_error_response(
                "origin",
                f"El filtro origin '{cleaned_origin}' no es válido. Valores permitidos: {', '.join(VALID_ORIGINS)}.",
            )
    else:
        cleaned_origin = None

    if branch is not None and branch.strip() != "":
        cleaned_branch = branch.strip()
        if cleaned_branch not in VALID_BRANCHES:
            return _validation_error_response(
                "branch",
                f"El filtro branch '{cleaned_branch}' no es válido. Valores permitidos: {', '.join(VALID_BRANCHES)}.",
            )
    else:
        cleaned_branch = None

    if category is not None and category.strip() != "":
        cleaned_category = category.strip()
        if cleaned_category not in VALID_MODEL_CATEGORIES:
            return _validation_error_response(
                "category",
                f"El filtro category '{cleaned_category}' no es válido. Valores permitidos: {', '.join(VALID_MODEL_CATEGORIES)}.",
            )
    else:
        cleaned_category = None

    items = list_incidents(
        status=cleaned_status,
        origin=cleaned_origin,
        branch=cleaned_branch,
        category=cleaned_category,
    )
    return [item.to_dict() for item in items]


@app.post("/api/incidents", status_code=201)
async def create_new_incident(request: Request) -> Any:
    try:
        payload = await request.json()
    except Exception:
        return _validation_error_response(
            "body", "El cuerpo de la petición debe ser un objeto JSON válido."
        )

    if not isinstance(payload, dict):
        return _validation_error_response(
            "body", "El cuerpo de la petición debe ser un objeto JSON con los campos de la incidencia."
        )

    is_valid, error_field, error_msg, normalized = validate_incident_payload(payload)
    if not is_valid or normalized is None:
        return _validation_error_response(
            error_field or "body",
            error_msg or "Datos de incidencia inválidos.",
        )

    created = create_incident(normalized)
    return created.to_dict()


@app.get("/api/incidents/{incident_id}")
def read_incident_detail(incident_id: int) -> Any:
    incident = get_incident_by_id(incident_id)
    if incident is None:
        return JSONResponse(
            status_code=404,
            content={
                "error": f"No se encontró la incidencia con id {incident_id}.",
                "message": f"No se encontró la incidencia con id {incident_id}.",
                "detail": f"No se encontró la incidencia con id {incident_id}.",
            },
        )
    return incident.to_dict()


@app.patch("/api/incidents/{incident_id}/status")
async def patch_incident_status(incident_id: int, request: Request) -> Any:
    try:
        payload = await request.json()
    except Exception:
        return _validation_error_response(
            "status", "El cuerpo de la petición debe ser un JSON válido con el campo 'status'."
        )

    if not isinstance(payload, dict):
        return _validation_error_response(
            "status", "El cuerpo de la petición debe ser un objeto JSON con el campo 'status'."
        )

    incident = get_incident_by_id(incident_id)
    if incident is None:
        return JSONResponse(
            status_code=404,
            content={
                "error": f"No se encontró la incidencia con id {incident_id}.",
                "message": f"No se encontró la incidencia con id {incident_id}.",
                "detail": f"No se encontró la incidencia con id {incident_id}.",
            },
        )

    raw_status = payload.get("status")
    new_status = "" if raw_status is None else str(raw_status).strip()
    is_valid, error_msg = validate_status_transition(incident.status, new_status)
    if not is_valid:
        return _validation_error_response(
            "status", error_msg or "Transición de estado no permitida."
        )

    updated = update_incident_status(incident_id, new_status)
    if updated is None:
        return JSONResponse(
            status_code=404,
            content={
                "error": f"No se encontró la incidencia con id {incident_id}.",
                "message": f"No se encontró la incidencia con id {incident_id}.",
                "detail": f"No se encontró la incidencia con id {incident_id}.",
            },
        )
    return updated.to_dict()


@app.post("/api/incidents/analyze")
async def analyze_incidents(file: UploadFile = File(...)) -> dict[str, Any]:
    global last_analysis

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must have a .csv extension")

    try:
        content = (await file.read()).decode("utf-8-sig")
        results = process_csv_data(io.StringIO(content, newline=""))
    except (UnicodeDecodeError, csv.Error) as error:
        raise HTTPException(status_code=400, detail="Invalid CSV file") from error

    last_analysis = results
    return results


@app.get("/api/incidents/results/export")
def export_results() -> StreamingResponse:
    analysis = last_analysis
    if analysis is None:
        raise HTTPException(status_code=404, detail="No analysis available")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Métrica", "Categoría", "Valor"])
    for metric in ("total_records", "valid_records", "invalid_records"):
        writer.writerow([metric, "", analysis[metric]])
    for metric in (
        "invalid_reasons",
        "categories",
        "statuses",
        "countries",
        "satisfaction_scores",
    ):
        for category, value in analysis[metric].items():
            writer.writerow([metric, category, value])
    writer.writerow(["average_satisfaction", "", analysis["average_satisfaction"]])
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="results.csv"'},
    )
