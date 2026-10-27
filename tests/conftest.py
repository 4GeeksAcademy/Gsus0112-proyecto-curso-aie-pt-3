"""Fixtures compartidas para aislar TinyDB en memoria, SQLite temporal y envío de emails."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Coroutine, Iterator, TypeVar
from unittest.mock import MagicMock

import pytest
from tinydb import TinyDB
from tinydb.storages import MemoryStorage

import services.api.database as db_module
import services.api.main as main_module
import services.api.security as security_module
from services.api.models import RoleEnum, UserDB
from services.api.routes import auth as auth_routes
from services.api.routes import profiles as profiles_routes
from services.api.routes import suppliers as suppliers_routes
from services.api.routes import users as users_routes
from services.api.security import create_access_token, get_password_hash

T = TypeVar("T")


def run_async(coro: Coroutine[Any, Any, T]) -> T:
    """Ejecuta una corrutina de endpoint de forma síncrona sin levantar sockets de red."""
    try:
        while True:
            coro.send(None)
    except StopIteration as exc:
        return exc.value  # type: ignore[no-any-return]
    finally:
        coro.close()


@pytest.fixture(autouse=True)
def memory_db(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[dict[str, Any]]:
    """Proporciona tablas TinyDB en memoria y una base SQLite temporal por cada test."""
    tinydb_instance = TinyDB(storage=MemoryStorage)
    users_table = tinydb_instance.table("users")
    profiles_table = tinydb_instance.table("profiles")
    suppliers_table = tinydb_instance.table("suppliers")

    # Redirigir todas las referencias a tablas TinyDB hacia la instancia en memoria
    monkeypatch.setattr(db_module, "users", users_table)
    monkeypatch.setattr(db_module, "profiles", profiles_table)
    monkeypatch.setattr(db_module, "suppliers", suppliers_table)
    monkeypatch.setattr(security_module, "users", users_table)
    monkeypatch.setattr(auth_routes, "users", users_table)
    monkeypatch.setattr(auth_routes, "profiles", profiles_table)
    monkeypatch.setattr(users_routes, "users", users_table)
    monkeypatch.setattr(users_routes, "profiles", profiles_table)
    monkeypatch.setattr(profiles_routes, "profiles", profiles_table)
    monkeypatch.setattr(suppliers_routes, "suppliers", suppliers_table)

    # Aislar la base de datos SQLite de incidencias en un archivo temporal
    sqlite_path = tmp_path / "test_incidents.db"
    monkeypatch.setenv("INCIDENTS_DB_PATH", str(sqlite_path))
    monkeypatch.setattr(main_module, "last_analysis", None)
    db_module.init_db(sqlite_path)

    yield {
        "db": tinydb_instance,
        "users": users_table,
        "profiles": profiles_table,
        "suppliers": suppliers_table,
        "sqlite_path": sqlite_path,
    }

    tinydb_instance.close()


@pytest.fixture()
def mock_mailer(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """Intercepta el envío de correos de recuperación para verificar llamadas sin red."""
    mock_send = MagicMock()
    monkeypatch.setattr(auth_routes, "send_password_reset_email", mock_send)
    return mock_send


@pytest.fixture()
def seeded_user(memory_db: dict[str, Any]) -> dict[str, Any]:
    """Crea un usuario estándar activo con su perfil asociado y su modelo UserDB."""
    plain_password = "StrongPassword123!"
    hashed = get_password_hash(plain_password)
    created_at = "2026-10-20T10:00:00+00:00"
    user_id = memory_db["users"].insert(
        {
            "email": "operador@trackflow.com",
            "hashed_password": hashed,
            "is_active": True,
            "role": "user",
            "created_at": created_at,
        }
    )
    memory_db["profiles"].insert(
        {
            "user_id": user_id,
            "name": "Ana Operadora",
            "phone": "+34 600 111 222",
            "address": "Plataforma Logística Madrid",
        }
    )
    token = create_access_token({"sub": str(user_id)})
    user_db = UserDB(
        id=user_id,
        email="operador@trackflow.com",
        is_active=True,
        role=RoleEnum.user,
        created_at=created_at,
        hashed_password=hashed,
    )
    return {
        "id": user_id,
        "email": "operador@trackflow.com",
        "password": plain_password,
        "role": "user",
        "token": token,
        "user_db": user_db,
    }


@pytest.fixture()
def seeded_admin(memory_db: dict[str, Any]) -> dict[str, Any]:
    """Crea un usuario con rol administrador para pruebas de autorización."""
    plain_password = "AdminPassword999!"
    hashed = get_password_hash(plain_password)
    created_at = "2026-10-20T09:00:00+00:00"
    admin_id = memory_db["users"].insert(
        {
            "email": "admin@trackflow.com",
            "hashed_password": hashed,
            "is_active": True,
            "role": "admin",
            "created_at": created_at,
        }
    )
    memory_db["profiles"].insert(
        {
            "user_id": admin_id,
            "name": "Carlos Admin",
            "phone": "+34 600 999 000",
            "address": "Sede Central",
        }
    )
    token = create_access_token({"sub": str(admin_id)})
    user_db = UserDB(
        id=admin_id,
        email="admin@trackflow.com",
        is_active=True,
        role=RoleEnum.admin,
        created_at=created_at,
        hashed_password=hashed,
    )
    return {
        "id": admin_id,
        "email": "admin@trackflow.com",
        "password": plain_password,
        "role": "admin",
        "token": token,
        "user_db": user_db,
    }
