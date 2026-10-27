"""Pruebas unitarias para la lógica de registro de usuarios (POST /users -> create_user)."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from tinydb import Query

from services.api.models import RoleEnum, UserCreate
from services.api.routes import users as users_routes
from services.api.routes.users import create_user
from services.api.security import verify_password


# =====================================================================
# 1. CAMINO FELIZ (Happy Path)
# =====================================================================


def test_register_creates_active_user_hashes_password_and_initializes_profile(
    memory_db: dict[str, Any],
) -> None:
    """Verifica que create_user persiste el hash bcrypt (nunca la clave en claro) y crea su perfil."""
    payload = UserCreate(
        email="nuevo@trackflow.com",
        password="MiPasswordSegura42",
        name="Laura Gómez",
        phone="+34 611 222 333",
        address="Almacén Valencia",
    )

    created = create_user(payload)
    stored_user = memory_db["users"].get(doc_id=created.id)
    stored_profile = memory_db["profiles"].get(Query().user_id == created.id)

    # La contraseña nunca debe almacenarse en texto plano, sino como hash verificable por bcrypt
    assert stored_user is not None
    assert stored_user["hashed_password"] != payload.password
    assert verify_password(payload.password, stored_user["hashed_password"]) is True
    assert stored_user["is_active"] is True
    assert stored_user["role"] == "user"

    # El registro de usuario debe inicializar automáticamente el perfil vinculado por user_id
    assert stored_profile is not None
    assert stored_profile["name"] == "Laura Gómez"
    assert stored_profile["phone"] == "+34 611 222 333"
    assert stored_profile["address"] == "Almacén Valencia"


# =====================================================================
# 2. CASOS LÍMITE (Edge Cases)
# =====================================================================


def test_register_ignores_privilege_escalation_attempt_and_forces_user_role(
    memory_db: dict[str, Any],
) -> None:
    """Aunque el payload solicite role='admin', el registro público siempre fuerza 'user'."""
    created = create_user(
        UserCreate(
            email="intento-admin@trackflow.com",
            password="PasswordValida123",
            role=RoleEnum.admin,
        )
    )

    # Decisión de negocio crítica: impedir auto-asignación de rol administrativo en el sign-up
    stored_user = memory_db["users"].get(doc_id=created.id)
    assert created.role == RoleEnum.user
    assert stored_user["role"] == "user"


def test_register_accepts_72_char_password_boundary_and_defaults_optional_profile_fields(
    memory_db: dict[str, Any],
) -> None:
    """Acepta exactamente 72 caracteres (límite de bcrypt) y normaliza campos opcionales a cadena vacía."""
    boundary_password = "A" * 72
    created = create_user(
        UserCreate(
            email="limite72@trackflow.com",
            password=boundary_password,
        )
    )

    stored_user = memory_db["users"].get(doc_id=created.id)
    stored_profile = memory_db["profiles"].get(Query().user_id == created.id)
    assert verify_password(boundary_password, stored_user["hashed_password"]) is True
    assert stored_profile["name"] == ""
    assert stored_profile["phone"] == ""
    assert stored_profile["address"] == ""


def test_register_duplicate_email_raises_conflict_without_creating_second_record(
    seeded_user: dict[str, Any], memory_db: dict[str, Any]
) -> None:
    """Intentar registrar un email ya existente debe ser rechazado con 409 sin alterar la tabla."""
    initial_count = len(memory_db["users"])

    with pytest.raises(HTTPException) as exc_info:
        create_user(
            UserCreate(
                email=seeded_user["email"],
                password="OtraPasswordDistinta123",
            )
        )

    assert exc_info.value.status_code == 409
    assert len(memory_db["users"]) == initial_count


# =====================================================================
# 3. MODOS DE FALLO (Failure Modes)
# =====================================================================


def test_register_rejects_empty_password(memory_db: dict[str, Any]) -> None:
    """Rechaza contraseñas vacías para impedir cuentas sin credencial de acceso (Bug #3)."""
    with pytest.raises(ValidationError):
        UserCreate(email="vacio@trackflow.com", password="")
    assert len(memory_db["users"]) == 0


def test_register_rejects_password_exceeding_72_characters(
    memory_db: dict[str, Any],
) -> None:
    """Rechaza contraseñas > 72 caracteres para evitar el truncado silencioso de bcrypt."""
    with pytest.raises(ValidationError):
        UserCreate(email="largo@trackflow.com", password="B" * 73)
    assert len(memory_db["users"]) == 0


def test_register_rejects_invalid_email_format(memory_db: dict[str, Any]) -> None:
    """Rechaza emails vacíos o sin formato usuario@dominio.tld."""
    for invalid_email in ("", "   ", "sin-arroba.com", "usuario@", "@dominio.com"):
        with pytest.raises(ValidationError):
            UserCreate(email=invalid_email, password="Password123")
    assert len(memory_db["users"]) == 0


def test_register_handles_storage_oserror_on_lookup_and_insert(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Si TinyDB falla por OSError al verificar duplicados o al insertar, lanza HTTPException 500."""
    broken_table = MagicMock()
    broken_table.contains.side_effect = OSError("Disk read failure")
    monkeypatch.setattr(users_routes, "users", broken_table)

    with pytest.raises(HTTPException) as exc_lookup:
        create_user(UserCreate(email="fallo1@trackflow.com", password="Password123"))
    assert exc_lookup.value.status_code == 500

    # Simular que contains() pasa pero insert() lanza OSError
    broken_table.contains.side_effect = None
    broken_table.contains.return_value = False
    broken_table.insert.side_effect = OSError("Disk write failure")

    with pytest.raises(HTTPException) as exc_insert:
        create_user(UserCreate(email="fallo2@trackflow.com", password="Password123"))
    assert exc_insert.value.status_code == 500
