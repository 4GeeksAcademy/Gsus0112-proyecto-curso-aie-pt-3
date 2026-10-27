"""Pruebas unitarias para la lógica de consulta de sesión actual (GET /auth/me -> read_me)."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from tinydb import Query

from services.api.routes import auth as auth_routes
from services.api.routes.auth import read_me
from services.api.security import create_password_reset_token, get_current_user
from tests.conftest import run_async


# =====================================================================
# 1. CAMINO FELIZ (Happy Path)
# =====================================================================


def test_read_me_returns_authenticated_user_and_profile_fields(
    seeded_user: dict[str, Any],
) -> None:
    """Combina los datos de cuenta (email, role) con los datos del perfil asociado."""
    data = read_me(current_user=seeded_user["user_db"])

    assert data["email"] == seeded_user["email"]
    assert data["role"] == "user"
    assert data["name"] == "Ana Operadora"
    assert data["phone"] == "+34 600 111 222"
    assert data["address"] == "Plataforma Logística Madrid"


# =====================================================================
# 2. CASOS LÍMITE (Edge Cases)
# =====================================================================


def test_read_me_returns_empty_profile_strings_when_profile_record_is_missing(
    seeded_user: dict[str, Any], memory_db: dict[str, Any]
) -> None:
    """Si el usuario no tiene documento en 'profiles', devuelve cadenas vacías sin fallar."""
    memory_db["profiles"].remove(Query().user_id == seeded_user["id"])

    data = read_me(current_user=seeded_user["user_db"])

    assert data["email"] == seeded_user["email"]
    assert data["name"] == ""
    assert data["phone"] == ""
    assert data["address"] == ""


# =====================================================================
# 3. MODOS DE FALLO (Failure Modes)
# =====================================================================


def test_read_me_dependency_rejects_invalid_or_reset_token(
    seeded_user: dict[str, Any],
) -> None:
    """Rechaza tokens inválidos o que intenten autenticarse con un token de recuperación."""
    with pytest.raises(HTTPException) as exc_invalid:
        run_async(get_current_user(token="token-invalido"))
    assert exc_invalid.value.status_code == 401

    reset_token = create_password_reset_token(seeded_user["id"])
    with pytest.raises(HTTPException) as exc_reset:
        run_async(get_current_user(token=reset_token))
    assert exc_reset.value.status_code == 401


def test_read_me_handles_profile_storage_oserror(
    seeded_user: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Si la tabla de perfiles lanza OSError, devuelve un error 500 controlado."""
    broken_profiles = MagicMock()
    broken_profiles.get.side_effect = OSError("Profile storage failure")
    monkeypatch.setattr(auth_routes, "profiles", broken_profiles)

    with pytest.raises(HTTPException) as exc_info:
        read_me(current_user=seeded_user["user_db"])
    assert exc_info.value.status_code == 500
