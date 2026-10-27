"""Pruebas unitarias para la lógica de inicio de sesión (POST /auth/login -> login)."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from jose import jwt

from services.api.routes import auth as auth_routes
from services.api.routes.auth import login
from services.api.security import ALGORITHM, SECRET_KEY, get_password_hash


def _credentials(username: str, password: str) -> Any:
    """Construye los datos de credenciales equivalentes al formulario OAuth2."""
    return SimpleNamespace(username=username, password=password)


# =====================================================================
# 1. CAMINO FELIZ (Happy Path)
# =====================================================================


def test_login_with_valid_credentials_issues_signed_jwt_for_user_id(
    seeded_user: dict[str, Any],
) -> None:
    """Autentica un usuario activo y genera un JWT firmado cuyo 'sub' identifica al usuario."""
    result = login(_credentials(seeded_user["email"], seeded_user["password"]))
    decoded = jwt.decode(result["access_token"], SECRET_KEY, algorithms=[ALGORITHM])

    # El token emitido debe pertenecer al ID del usuario autenticado y tener expiración futura
    assert decoded["sub"] == str(seeded_user["id"])
    assert "exp" in decoded
    assert decoded.get("type") != "password_reset"


# =====================================================================
# 2. CASOS LÍMITE (Edge Cases)
# =====================================================================


def test_login_rejects_inactive_user_even_with_valid_password(
    memory_db: dict[str, Any],
) -> None:
    """Un usuario desactivado (is_active=False) no debe poder iniciar sesión (Bug #1 detectado)."""
    password = "SuspendedUserPass123"
    memory_db["users"].insert(
        {
            "email": "suspendido@trackflow.com",
            "hashed_password": get_password_hash(password),
            "is_active": False,
            "role": "user",
            "created_at": "2026-10-20T10:00:00+00:00",
        }
    )

    with pytest.raises(HTTPException) as exc_info:
        login(_credentials("suspendido@trackflow.com", password))

    assert exc_info.value.status_code == 401


def test_login_with_record_missing_hashed_password_fails_safely(
    memory_db: dict[str, Any],
) -> None:
    """Si un documento legacy en TinyDB no tiene 'hashed_password', rechaza con 401 sin lanzar ValueError."""
    memory_db["users"].insert(
        {
            "email": "legacy@trackflow.com",
            "is_active": True,
            "role": "user",
            "created_at": "2026-10-20T10:00:00+00:00",
        }
    )

    with pytest.raises(HTTPException) as exc_info:
        login(_credentials("legacy@trackflow.com", "CualquierPassword"))

    assert exc_info.value.status_code == 401


# =====================================================================
# 3. MODOS DE FALLO (Failure Modes)
# =====================================================================


def test_login_rejects_wrong_password_and_unknown_email_with_identical_error(
    seeded_user: dict[str, Any],
) -> None:
    """Contraseña errónea y email inexistente deben devolver el mismo detalle para evitar enumeración."""
    with pytest.raises(HTTPException) as wrong_pass_exc:
        login(_credentials(seeded_user["email"], "PasswordIncorrecta"))

    with pytest.raises(HTTPException) as unknown_email_exc:
        login(_credentials("noexiste@trackflow.com", seeded_user["password"]))

    assert wrong_pass_exc.value.status_code == 401
    assert unknown_email_exc.value.status_code == 401
    assert wrong_pass_exc.value.detail == unknown_email_exc.value.detail


def test_login_handles_database_oserror_gracefully(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Si la lectura de usuarios lanza OSError, lanza HTTPException 500 con mensaje controlado."""
    broken_users = MagicMock()
    broken_users.get.side_effect = OSError("Storage unavailable")
    monkeypatch.setattr(auth_routes, "users", broken_users)

    with pytest.raises(HTTPException) as exc_info:
        login(_credentials("operador@trackflow.com", "cualquier"))

    assert exc_info.value.status_code == 500
    assert "inicio de sesión" in str(exc_info.value.detail)
