"""Script idempotente para poblar la base de datos de incidencias desde el CSV histórico."""

from __future__ import annotations

import csv
import sqlite3
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from packages.shared.incident_rules import transform_csv_row_to_incident  # noqa: E402
from services.api.database import (  # noqa: E402
    create_incident,
    get_incidents_summary,
    incident_exists_for_seed,
    init_db,
)

DEFAULT_CSV_PATH = Path(__file__).resolve().parent / "incidents-trackflow.csv"


REQUIRED_CSV_COLUMNS = {
    "country",
    "carrier",
    "tracking_number",
    "category",
    "status",
    "description",
    "customer_email",
}


def seed_from_csv(
    csv_path: Path = DEFAULT_CSV_PATH,
    *,
    db_path: Optional[Path | str] = None,
) -> dict[str, Any]:
    """Lee el CSV histórico, valida y transforma cada fila, e inserta de forma idempotente."""
    if not csv_path.exists() or not csv_path.is_file():
        raise FileNotFoundError(f"El archivo CSV '{csv_path.name}' no existe.")

    init_db(db_path)

    total_rows = 0
    inserted = 0
    skipped_duplicates = 0
    invalid_rows: list[dict[str, Any]] = []
    invalid_reasons: Counter[str] = Counter()

    with csv_path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError("El archivo CSV está vacío o no contiene cabeceras.")
        missing_cols = REQUIRED_CSV_COLUMNS - set(reader.fieldnames)
        if missing_cols:
            missing_list = ", ".join(sorted(missing_cols))
            raise ValueError(f"Faltan columnas obligatorias en el CSV: {missing_list}.")

        for line_number, row in enumerate(reader, start=2):
            total_rows += 1
            is_valid, reason, transformed = transform_csv_row_to_incident(row)
            if not is_valid or transformed is None:
                err_code = reason or "UNKNOWN"
                invalid_reasons[err_code] += 1
                invalid_rows.append(
                    {
                        "line": line_number,
                        "incident_id": (row.get("incident_id") or "").strip() or f"fila-{line_number}",
                        "reason": err_code,
                    }
                )
                continue

            source_ref = transformed["source_ref"]
            title = transformed["title"]
            created_at = transformed["created_at"]
            has_explicit_id = bool((row.get("incident_id") or "").strip())

            if incident_exists_for_seed(
                source_ref,
                title,
                created_at,
                has_explicit_id=has_explicit_id,
                custom_path=db_path,
            ):
                skipped_duplicates += 1
                continue

            create_incident(transformed, custom_path=db_path)
            inserted += 1

    summary = get_incidents_summary(custom_path=db_path)
    return {
        "total_rows": total_rows,
        "inserted": inserted,
        "skipped_duplicates": skipped_duplicates,
        "invalid_count": len(invalid_rows),
        "invalid_reasons": dict(invalid_reasons),
        "invalid_rows": invalid_rows,
        "summary": summary,
    }


def main() -> int:
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CSV_PATH
    if not csv_path.exists() or not csv_path.is_file():
        print(f"Error: no se encontró el archivo CSV '{csv_path.name}'.", file=sys.stderr)
        return 1

    try:
        report = seed_from_csv(csv_path)
    except (OSError, UnicodeError, csv.Error, ValueError) as error:
        print(f"Error al leer o validar el archivo CSV: {error}", file=sys.stderr)
        return 1
    except sqlite3.Error as error:
        print(f"Error en la base de datos durante el seed: {error}", file=sys.stderr)
        return 1

    print("=== Seed de incidencias históricas (TrackFlow) ===")
    print(f"|- Filas procesadas en CSV : {report['total_rows']}")
    print(f"|- Incidencias insertadas  : {report['inserted']}")
    print(f"|- Duplicadas omitidas     : {report['skipped_duplicates']}")
    print(f"|- Registros inválidos     : {report['invalid_count']}")

    if report["invalid_rows"]:
        print("\nDetalle de registros inválidos omitidos:")
        for item in report["invalid_rows"]:
            print(f"  - Línea {item['line']} ({item['incident_id']}): {item['reason']}")

    summary = report["summary"]
    print("\n Totales en base de datos tras el seed:")
    print(f"|- Total incidencias: {summary['total']}")
    print(f"|- Por estado       : {summary['by_status']}")
    print(f"|- Por categoría    : {summary['by_category']}")
    print(f"|- Por origen       : {summary['by_origin']}")
    print(f"|- Por sede         : {summary['by_branch']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
