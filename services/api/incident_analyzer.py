"""Lógica compartida para validar y analizar CSVs de incidencias de TrackFlow."""

from __future__ import annotations

import csv
from collections import Counter
from typing import Any, Iterable, Mapping, Optional, TextIO, Tuple

CARRIERS_BY_COUNTRY: dict[str, frozenset[str]] = {
    "US": frozenset({"UPS", "FEDEX", "DHL_US"}),
    "ES": frozenset({"MRW", "SEUR", "DHL_ES", "LOCAL_ES"}),
}

VALID_CATEGORIES: frozenset[str] = frozenset(
    {"LOST_PARCEL", "DELAYED_DELIVERY", "WRONG_ADDRESS", "RETURN_REQUEST", "DAMAGE"}
)

MIN_TRACKING_LENGTH = 8
MIN_DESCRIPTION_LENGTH = 5
SCORE_RANGE = range(1, 6)


def _clean(row: Mapping[str, Any], key: str) -> str:
    value = row.get(key)
    return "" if value is None else str(value).strip()


def _parse_score(raw: str) -> Optional[int]:
    """Devuelve el puntaje como entero o None si no es un entero válido (acepta '4' y '4.0')."""
    try:
        number = float(raw)
    except ValueError:
        return None
    return int(number) if number.is_integer() else None


def validate_row(row: Mapping[str, Any]) -> Tuple[bool, Optional[str]]:
    """Valida una fila del CSV. Retorna (is_valid, error_reason) con la primera regla incumplida."""
    country = _clean(row, "country").upper()
    carrier = _clean(row, "carrier").upper()
    tracking_number = _clean(row, "tracking_number")
    category = _clean(row, "category").upper()
    description = _clean(row, "description")
    customer_email = _clean(row, "customer_email")
    status = _clean(row, "status").upper()
    raw_score = _clean(row, "satisfaction_score")

    if country not in CARRIERS_BY_COUNTRY:
        return False, "INVALID_COUNTRY"
    if not carrier:
        return False, "MISSING_CARRIER"
    if carrier not in CARRIERS_BY_COUNTRY[country]:
        return False, "CARRIER_COUNTRY_MISMATCH"
    if len(tracking_number) < MIN_TRACKING_LENGTH:
        return False, "INVALID_TRACKING_NUMBER"
    if category not in VALID_CATEGORIES:
        return False, "INVALID_CATEGORY"
    if len(description) < MIN_DESCRIPTION_LENGTH:
        return False, "DESCRIPTION_TOO_SHORT"
    if "@" not in customer_email:
        return False, "INVALID_EMAIL"
    if status == "CLOSED" and not raw_score:
        return False, "MISSING_SATISFACTION_SCORE"
    if raw_score:
        score = _parse_score(raw_score)
        if score is None or score not in SCORE_RANGE:
            return False, "INVALID_SATISFACTION_SCORE"

    return True, None


def process_csv_data(csv_file_like: Iterable[str] | TextIO) -> dict[str, Any]:
    """Procesa un CSV (objeto tipo archivo en modo texto) y retorna métricas agregadas.

    Los desgloses por categoría, estado, país y satisfacción se calculan sobre registros válidos.
    """
    reader = csv.DictReader(csv_file_like)

    total = 0
    valid = 0
    invalid_reasons: Counter[str] = Counter()
    categories: Counter[str] = Counter()
    statuses: Counter[str] = Counter()
    countries: Counter[str] = Counter()
    scores: dict[int, int] = {score: 0 for score in SCORE_RANGE}

    for row in reader:
        total += 1
        is_valid, reason = validate_row(row)
        if not is_valid:
            invalid_reasons[reason or "UNKNOWN"] += 1
            continue

        valid += 1
        categories[_clean(row, "category").upper()] += 1
        statuses[_clean(row, "status").upper()] += 1
        countries[_clean(row, "country").upper()] += 1

        raw_score = _clean(row, "satisfaction_score")
        if raw_score:
            score = _parse_score(raw_score)
            if score is not None:
                scores[score] += 1

    scored_count = sum(scores.values())
    average = (
        round(sum(score * count for score, count in scores.items()) / scored_count, 2)
        if scored_count
        else None
    )

    return {
        "total_records": total,
        "valid_records": valid,
        "invalid_records": total - valid,
        "invalid_reasons": dict(invalid_reasons),
        "categories": dict(categories),
        "statuses": dict(statuses),
        "countries": dict(countries),
        "satisfaction_scores": scores,
        "average_satisfaction": average,
    }
