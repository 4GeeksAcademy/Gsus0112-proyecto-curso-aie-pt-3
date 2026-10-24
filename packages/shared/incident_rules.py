"""Reglas de dominio, validaciones y transformaciones del Gestor de Incidencias de TrackFlow."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping, Optional, Tuple

from .incident_analyzer import MIN_DESCRIPTION_LENGTH, validate_row

MAX_TITLE_LENGTH = 120

VALID_STATUSES: tuple[str, ...] = ("open", "in_progress", "resolved", "discarded")
VALID_ORIGINS: tuple[str, ...] = ("customer", "branch", "internal")
VALID_BRANCHES: tuple[str, ...] = (
    "central",
    "la_warehouse",
    "la_office",
    "zaragoza_warehouse",
    "zaragoza_office",
)
VALID_MODEL_CATEGORIES: tuple[str, ...] = (
    "lost_parcel",
    "carrier_issue",
    "delivery_failure",
    "returns_issue",
    "inventory_discrepancy",
)

STATUS_LABELS: dict[str, str] = {
    "open": "Abierta",
    "in_progress": "En progreso",
    "resolved": "Resuelta",
    "discarded": "Descartada",
}

ORIGIN_LABELS: dict[str, str] = {
    "customer": "Cliente",
    "branch": "Sede operativa",
    "internal": "Interno",
}

BRANCH_LABELS: dict[str, str] = {
    "central": "Central",
    "la_warehouse": "Los Ángeles — Almacén",
    "la_office": "Los Ángeles — Oficina",
    "zaragoza_warehouse": "Zaragoza — Almacén",
    "zaragoza_office": "Zaragoza — Oficina",
}

CATEGORY_LABELS: dict[str, str] = {
    "lost_parcel": "Paquete extraviado en tránsito o en el almacén",
    "carrier_issue": "Incidencia atribuible al transportista (retraso, daño, SLA)",
    "delivery_failure": "Fallo en la entrega (intento fallido, dirección incorrecta, destinatario ausente)",
    "returns_issue": "Problema en el proceso de devoluciones o logística inversa",
    "inventory_discrepancy": "Diferencia entre el stock registrado y el stock físico",
}

ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "open": frozenset({"in_progress", "discarded"}),
    "in_progress": frozenset({"resolved", "discarded"}),
    "resolved": frozenset(),
    "discarded": frozenset(),
}

FINAL_STATUSES: frozenset[str] = frozenset({"resolved", "discarded"})

CSV_STATUS_MAP: dict[str, str] = {
    "OPEN": "open",
    "CLOSED": "resolved",
    "DISCARDED": "discarded",
}

CSV_CATEGORY_MAP: dict[str, str] = {
    "LOST_PARCEL": "lost_parcel",
    "DELAYED_DELIVERY": "carrier_issue",
    "DAMAGE": "carrier_issue",
    "WRONG_ADDRESS": "delivery_failure",
    "RETURN_REQUEST": "returns_issue",
}

CSV_BRANCH_MAP: dict[str, str] = {
    "US": "la_office",
    "ES": "zaragoza_office",
}


def _clean_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def validate_incident_payload(
    payload: Mapping[str, Any],
    *,
    allow_initial_status: bool = True,
) -> Tuple[bool, Optional[str], Optional[str], Optional[dict[str, str]]]:
    """Valida los datos de entrada de una incidencia.

    Retorna (is_valid, error_field, error_message, normalized_data).
    """
    title = _clean_str(payload.get("title"))
    description = _clean_str(payload.get("description"))
    category = _clean_str(payload.get("category"))
    origin = _clean_str(payload.get("origin"))
    branch = _clean_str(payload.get("branch"))
    raw_status = payload.get("status")
    status = _clean_str(raw_status) if raw_status is not None and _clean_str(raw_status) != "" else "open"

    if not title:
        return False, "title", "El título de la incidencia es obligatorio.", None
    if len(title) > MAX_TITLE_LENGTH:
        return (
            False,
            "title",
            f"El título no puede superar los {MAX_TITLE_LENGTH} caracteres.",
            None,
        )

    if not description:
        return False, "description", "La descripción detallada es obligatoria.", None
    if len(description) < MIN_DESCRIPTION_LENGTH:
        return (
            False,
            "description",
            f"La descripción debe tener al menos {MIN_DESCRIPTION_LENGTH} caracteres.",
            None,
        )

    if not category:
        return False, "category", "La categoría es obligatoria.", None
    if category not in VALID_MODEL_CATEGORIES:
        allowed_cats = ", ".join(VALID_MODEL_CATEGORIES)
        return (
            False,
            "category",
            f"La categoría '{category}' no es válida. Valores permitidos: {allowed_cats}.",
            None,
        )

    if not origin:
        return False, "origin", "El origen del reporte es obligatorio.", None
    if origin not in VALID_ORIGINS:
        allowed_origins = ", ".join(VALID_ORIGINS)
        return (
            False,
            "origin",
            f"El origen '{origin}' no es válido. Valores permitidos: {allowed_origins}.",
            None,
        )

    if not branch:
        return False, "branch", "La sede (branch) es obligatoria para todos los orígenes.", None
    if branch not in VALID_BRANCHES:
        allowed_branches = ", ".join(VALID_BRANCHES)
        return (
            False,
            "branch",
            f"La sede '{branch}' no es válida. Valores permitidos: {allowed_branches}.",
            None,
        )

    if not allow_initial_status and raw_status is not None and status != "open":
        return (
            False,
            "status",
            "Las nuevas incidencias deben crearse en estado 'open'.",
            None,
        )

    if status not in VALID_STATUSES:
        allowed_statuses = ", ".join(VALID_STATUSES)
        return (
            False,
            "status",
            f"El estado '{status}' no es válido. Valores permitidos: {allowed_statuses}.",
            None,
        )

    return (
        True,
        None,
        None,
        {
            "title": title,
            "description": description,
            "category": category,
            "status": status,
            "origin": origin,
            "branch": branch,
        },
    )


def validate_status_transition(
    current_status: str, new_status: str
) -> Tuple[bool, Optional[str]]:
    """Valida si el cambio de estado respeta el ciclo de vida de la incidencia."""
    cleaned_new = _clean_str(new_status)
    if not cleaned_new:
        return False, "El nuevo estado es obligatorio."
    if cleaned_new not in VALID_STATUSES:
        allowed = ", ".join(VALID_STATUSES)
        return False, f"El estado '{cleaned_new}' no es válido. Valores permitidos: {allowed}."

    if current_status in FINAL_STATUSES:
        return (
            False,
            f"La incidencia está en estado final ('{current_status}') y no admite más cambios.",
        )

    allowed_next = ALLOWED_TRANSITIONS.get(current_status, frozenset())
    if cleaned_new not in allowed_next:
        allowed_str = ", ".join(sorted(allowed_next)) if allowed_next else "ninguno"
        return (
            False,
            f"Transición de estado no permitida de '{current_status}' a '{cleaned_new}'. "
            f"Estados permitidos desde '{current_status}': {allowed_str}.",
        )

    return True, None


def _parse_csv_date_to_iso(raw_date: str) -> Optional[str]:
    """Convierte una fecha YYYY-MM-DD del CSV a ISO-8601 medianoche UTC."""
    cleaned = _clean_str(raw_date)
    if not cleaned:
        return None
    try:
        dt = datetime.strptime(cleaned, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        try:
            dt = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            return None


def compute_idempotency_key(
    csv_incident_id: Optional[str], title: str, created_at: str
) -> str:
    """Calcula la clave de idempotencia según el BRIEFING (incident_id o title + created_at)."""
    cleaned_id = _clean_str(csv_incident_id)
    if cleaned_id:
        return cleaned_id
    return f"{_clean_str(title)}|{_clean_str(created_at)}"


def transform_csv_row_to_incident(
    row: Mapping[str, Any],
) -> Tuple[bool, Optional[str], Optional[dict[str, str]]]:
    """Valida una fila del CSV con las reglas del analizador y la transforma al modelo Incident.

    Retorna (is_valid, error_reason, transformed_dict).
    """
    is_valid, reason = validate_row(row)
    if not is_valid:
        return False, reason, None

    raw_description = _clean_str(row.get("description"))
    title = raw_description[:MAX_TITLE_LENGTH].strip()
    if not title:
        return False, "EMPTY_TITLE", None

    raw_category = _clean_str(row.get("category")).upper()
    category = CSV_CATEGORY_MAP.get(raw_category)
    if not category:
        return False, "INVALID_CATEGORY", None

    raw_status = _clean_str(row.get("status")).upper()
    status = CSV_STATUS_MAP.get(raw_status)
    if not status:
        return False, "INVALID_STATUS", None

    raw_country = _clean_str(row.get("country")).upper()
    branch = CSV_BRANCH_MAP.get(raw_country)
    if not branch:
        return False, "INVALID_COUNTRY", None

    created_at = _parse_csv_date_to_iso(_clean_str(row.get("date")))
    if not created_at:
        return False, "INVALID_DATE", None

    csv_incident_id = _clean_str(row.get("incident_id"))
    source_ref = compute_idempotency_key(csv_incident_id, title, created_at)

    return (
        True,
        None,
        {
            "title": title,
            "description": raw_description,
            "category": category,
            "status": status,
            "origin": "customer",
            "branch": branch,
            "created_at": created_at,
            "updated_at": created_at,
            "source_ref": source_ref,
        },
    )


def build_empty_summary() -> dict[str, Any]:
    """Construye la estructura de métricas en cero cuando no hay incidencias."""
    return {
        "total": 0,
        "by_status": {status: 0 for status in VALID_STATUSES},
        "by_category": {category: 0 for category in VALID_MODEL_CATEGORIES},
        "by_origin": {origin: 0 for origin in VALID_ORIGINS},
        "by_branch": {branch: 0 for branch in VALID_BRANCHES},
    }
