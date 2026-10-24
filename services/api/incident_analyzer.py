"""Reexporta las funciones de validación compartidas desde packages/shared."""

from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from packages.shared.incident_analyzer import (  # noqa: E402
    CARRIERS_BY_COUNTRY,
    MIN_DESCRIPTION_LENGTH,
    MIN_TRACKING_LENGTH,
    SCORE_RANGE,
    VALID_CATEGORIES,
    process_csv_data,
    validate_row,
)

__all__ = [
    "CARRIERS_BY_COUNTRY",
    "MIN_DESCRIPTION_LENGTH",
    "MIN_TRACKING_LENGTH",
    "SCORE_RANGE",
    "VALID_CATEGORIES",
    "process_csv_data",
    "validate_row",
]
