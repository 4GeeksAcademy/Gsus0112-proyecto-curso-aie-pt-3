"""Acceso a las bases de datos de TrackFlow (TinyDB para proveedores/usuarios y SQLite/TinyDB para incidencias)."""

from __future__ import annotations

import os
import sqlite3
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Optional

from tinydb import TinyDB

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from packages.shared.incident_rules import (  # noqa: E402
    VALID_BRANCHES,
    VALID_MODEL_CATEGORIES,
    VALID_ORIGINS,
    VALID_STATUSES,
    build_empty_summary,
)

# --- TinyDB tables used by Suppliers, Users & Profiles ---
db = TinyDB(
    os.getenv(
        "TRACKFLOW_DB_PATH", str(Path(__file__).resolve().parent / "db.json")
    )
)
suppliers = db.table("suppliers")
users = db.table("users")
profiles = db.table("profiles")
incidents_tinydb = db.table("incidents")

# --- SQLite persistence for the Centralized Incident Manager ---
DEFAULT_DB_PATH = Path(__file__).resolve().parent / "incidents.db"


@dataclass(frozen=True)
class Incident:
    """Representa una incidencia operativa en el gestor centralizado de TrackFlow."""

    id: int
    title: str
    description: str
    category: str
    status: str
    origin: str
    branch: str
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "status": self.status,
            "origin": self.origin,
            "branch": self.branch,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


def get_db_path(custom_path: Optional[Path | str] = None) -> Path:
    if custom_path is not None:
        return Path(custom_path)
    env_path = os.environ.get("INCIDENTS_DB_PATH")
    if env_path:
        return Path(env_path)
    return DEFAULT_DB_PATH


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@contextmanager
def get_connection(custom_path: Optional[Path | str] = None) -> Iterator[sqlite3.Connection]:
    db_path = get_db_path(custom_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(custom_path: Optional[Path | str] = None) -> None:
    """Crea la tabla incidents con todas sus restricciones de integridad."""
    statuses_sql = ", ".join(f"'{s}'" for s in VALID_STATUSES)
    origins_sql = ", ".join(f"'{o}'" for o in VALID_ORIGINS)
    branches_sql = ", ".join(f"'{b}'" for b in VALID_BRANCHES)
    categories_sql = ", ".join(f"'{c}'" for c in VALID_MODEL_CATEGORIES)

    create_table_sql = f"""
    CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL CHECK(length(trim(title)) > 0),
        description TEXT NOT NULL CHECK(length(trim(description)) > 0),
        category TEXT NOT NULL CHECK(category IN ({categories_sql})),
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ({statuses_sql})),
        origin TEXT NOT NULL CHECK(origin IN ({origins_sql})),
        branch TEXT NOT NULL CHECK(branch IN ({branches_sql})),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        source_ref TEXT UNIQUE
    );
    """
    with get_connection(custom_path) as conn:
        conn.execute(create_table_sql)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_incidents_filters "
            "ON incidents(status, origin, branch, category);"
        )


def _row_to_incident(row: sqlite3.Row) -> Incident:
    return Incident(
        id=int(row["id"]),
        title=str(row["title"]),
        description=str(row["description"]),
        category=str(row["category"]),
        status=str(row["status"]),
        origin=str(row["origin"]),
        branch=str(row["branch"]),
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )


def create_incident(
    data: dict[str, str],
    *,
    custom_path: Optional[Path | str] = None,
) -> Incident:
    """Inserta una nueva incidencia y devuelve el modelo creado."""
    init_db(custom_path)
    now = _now_iso()
    created_at = data.get("created_at") or now
    updated_at = data.get("updated_at") or created_at
    source_ref = data.get("source_ref")

    with get_connection(custom_path) as conn:
        cursor = conn.execute(
            """
            INSERT INTO incidents (
                title, description, category, status, origin, branch, created_at, updated_at, source_ref
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data["title"],
                data["description"],
                data["category"],
                data.get("status", "open"),
                data["origin"],
                data["branch"],
                created_at,
                updated_at,
                source_ref,
            ),
        )
        incident_id = cursor.lastrowid
        row = conn.execute(
            "SELECT id, title, description, category, status, origin, branch, created_at, updated_at "
            "FROM incidents WHERE id = ?",
            (incident_id,),
        ).fetchone()
    return _row_to_incident(row)


def incident_exists_for_seed(
    source_ref: str,
    title: str,
    created_at: str,
    *,
    has_explicit_id: bool = True,
    custom_path: Optional[Path | str] = None,
) -> bool:
    """Comprueba si un registro del CSV ya fue insertado (por source_ref si tiene incident_id, o por title + created_at si no existe ese campo)."""
    init_db(custom_path)
    with get_connection(custom_path) as conn:
        if has_explicit_id:
            row = conn.execute(
                "SELECT 1 FROM incidents WHERE source_ref = ? LIMIT 1",
                (source_ref,),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT 1 FROM incidents WHERE source_ref = ? OR (title = ? AND created_at = ?) LIMIT 1",
                (source_ref, title, created_at),
            ).fetchone()
    return row is not None


def list_incidents(
    *,
    status: Optional[str] = None,
    origin: Optional[str] = None,
    branch: Optional[str] = None,
    category: Optional[str] = None,
    custom_path: Optional[Path | str] = None,
) -> list[Incident]:
    """Devuelve la lista de incidencias aplicando filtros opcionales."""
    init_db(custom_path)
    clauses: list[str] = []
    params: list[Any] = []

    if status:
        clauses.append("status = ?")
        params.append(status)
    if origin:
        clauses.append("origin = ?")
        params.append(origin)
    if branch:
        clauses.append("branch = ?")
        params.append(branch)
    if category:
        clauses.append("category = ?")
        params.append(category)

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    query = (
        "SELECT id, title, description, category, status, origin, branch, created_at, updated_at "
        f"FROM incidents {where_sql} ORDER BY id DESC"
    )
    with get_connection(custom_path) as conn:
        rows = conn.execute(query, params).fetchall()
    return [_row_to_incident(row) for row in rows]


def get_incident_by_id(
    incident_id: int,
    *,
    custom_path: Optional[Path | str] = None,
) -> Optional[Incident]:
    """Obtiene una incidencia por su ID o None si no existe."""
    init_db(custom_path)
    with get_connection(custom_path) as conn:
        row = conn.execute(
            "SELECT id, title, description, category, status, origin, branch, created_at, updated_at "
            "FROM incidents WHERE id = ?",
            (incident_id,),
        ).fetchone()
    return _row_to_incident(row) if row is not None else None


def update_incident_status(
    incident_id: int,
    new_status: str,
    *,
    custom_path: Optional[Path | str] = None,
) -> Optional[Incident]:
    """Actualiza el estado y updated_at de una incidencia."""
    init_db(custom_path)
    now = _now_iso()
    with get_connection(custom_path) as conn:
        conn.execute(
            "UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?",
            (new_status, now, incident_id),
        )
        row = conn.execute(
            "SELECT id, title, description, category, status, origin, branch, created_at, updated_at "
            "FROM incidents WHERE id = ?",
            (incident_id,),
        ).fetchone()
    return _row_to_incident(row) if row is not None else None


def get_incidents_summary(
    *,
    custom_path: Optional[Path | str] = None,
) -> dict[str, Any]:
    """Calcula las métricas agregadas por estado, categoría, origen y sede."""
    init_db(custom_path)
    summary = build_empty_summary()

    with get_connection(custom_path) as conn:
        rows = conn.execute(
            "SELECT status, category, origin, branch FROM incidents"
        ).fetchall()

    for row in rows:
        summary["total"] += 1
        st = str(row["status"])
        cat = str(row["category"])
        orig = str(row["origin"])
        br = str(row["branch"])

        if st in summary["by_status"]:
            summary["by_status"][st] += 1
        else:
            summary["by_status"][st] = summary["by_status"].get(st, 0) + 1

        if cat in summary["by_category"]:
            summary["by_category"][cat] += 1
        else:
            summary["by_category"][cat] = summary["by_category"].get(cat, 0) + 1

        if orig in summary["by_origin"]:
            summary["by_origin"][orig] += 1
        else:
            summary["by_origin"][orig] = summary["by_origin"].get(orig, 0) + 1

        if br in summary["by_branch"]:
            summary["by_branch"][br] += 1
        else:
            summary["by_branch"][br] = summary["by_branch"].get(br, 0) + 1

    return summary
