"""Pruebas unitarias para la lógica de restablecimiento de contraseña (POST /auth/reset-password)."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from services.api.models import ResetPasswordRequest
from services.api.routes import auth as auth_routes
from services.api.routes.auth import reset_password
from services.api.security import (
    create_access_token,
    create_password_reset_token,
    verify_password,
)


# =====================================================================
# 1. CAMINO FELIZ (Happy Path)
# =====================================================================


def test_reset_password_updates_bcrypt_hash_and_records_timestamp(
    seeded_user: dict[str, Any], memory_db: dict[str, Any]
) -> None:
    """Un token válido actualiza el hash de la contraseña y registra password_changed_at."""
    reset_token = create_password_reset_token(seeded_user["id"])
    new_password = "NuevaPasswordSegura2026!"

    result = reset_password(
        ResetPasswordRequest(token=reset_token, new_password=new_password)
    )
    assert "detail" in result

    updated_user = memory_db["users"].get(doc_id=seeded_user["id"])
    assert verify_password(new_password, updated_user["hashed_password"]) is True
    assert verify_password(seeded_user["password"], updated_user["hashed_password"]) is False
    assert updated_user.get("password_changed_at") is not None


# =====================================================================
# 2. CASOS LÍMITE (Edge Cases)
# =====================================================================


def test_reset_password_token_cannot_be_reused_even_at_same_timestamp(
    seeded_user: dict[str, Any], memory_db: dict[str, Any]
) -> None:
    """El token es de un solo uso estricto: cualquier segundo intento debe ser rechazado con 400 (Bug #2)."""
    reset_token = create_password_reset_token(seeded_user["id"])

    reset_password(
        ResetPasswordRequest(token=reset_token, new_password="PrimeraCambioPassword1")
    )

    # Segundo intento con el mismo token debe fallar y no sobrescribir la contraseña
    with pytest.raises(HTTPException) as exc_info:
        reset_password(
            ResetPasswordRequest(
                token=reset_token, new_password="IntentoReusoPassword2"
            )
        )
    assert exc_info.value.status_code == 400

    updated_user = memory_db["users"].get(doc_id=seeded_user["id"])
    assert verify_password("PrimeraCambioPassword1", updated_user["hashed_password"]) is True
    assert verify_password("IntentoReusoPassword2", updated_user["hashed_password"]) is False


def test_reset_password_accepts_boundary_lengths_1_and_72(
    seeded_user: dict[str, Any], memory_db: dict[str, Any]
) -> None:
    """Acepta contraseñas en los límites exactos permitidos (1 carácter y 72 caracteres)."""
    token_min = create_password_reset_token(seeded_user["id"])
    reset_password(ResetPasswordRequest(token=token_min, new_password="X"))
    assert verify_password(
        "X", memory_db["users"].get(doc_id=seeded_user["id"])["hashed_password"]
    )

    # Limpiar password_changed_at para probar el límite superior de 72 caracteres
    memory_db["users"].update({"password_changed_at": None}, doc_ids=[seeded_user["id"]])
    token_max = create_password_reset_token(seeded_user["id"])
    max_pass = "Z" * 72
    reset_password(ResetPasswordRequest(token=token_max, new_password=max_pass))
    assert verify_password(
        max_pass, memory_db["users"].get(doc_id=seeded_user["id"])["hashed_password"]
    )


# =====================================================================
# 3. MODOS DE FALLO (Failure Modes)
# =====================================================================


def test_reset_password_rejects_session_token_or_malformed_token(
    seeded_user: dict[str, Any],
) -> None:
    """Un token de sesión normal o un string arbitrario son rechazados con 400."""
    session_token = create_access_token({"sub": str(seeded_user["id"])})
    for invalid_token in (session_token, "token-corrupto"):
        with pytest.raises(HTTPException) as exc_info:
            reset_password(
                ResetPasswordRequest(
                    token=invalid_token, new_password="NuevaPassword123"
                )
            )
        assert exc_info.value.status_code == 400


def test_reset_password_rejects_deactivated_deleted_or_corrupted_timestamp_user(
    seeded_user: dict[str, Any], memory_db: dict[str, Any]
) -> None:
    """Rechaza el reset si el usuario tiene password_changed_at corrupto, está inactivo o fue borrado."""
    token = create_password_reset_token(seeded_user["id"])

    # 1. password_changed_at con formato ISO inválido
    memory_db["users"].update(
        {"password_changed_at": "fecha-corrupta"}, doc_ids=[seeded_user["id"]]
    )
    with pytest.raises(HTTPException) as exc_corrupt:
        reset_password(ResetPasswordRequest(token=token, new_password="NuevaPassword"))
    assert exc_corrupt.value.status_code == 400

    # 2. Usuario desactivado (is_active=False)
    memory_db["users"].update(
        {"password_changed_at": None, "is_active": False}, doc_ids=[seeded_user["id"]]
    )
    with pytest.raises(HTTPException) as exc_inactive:
        reset_password(ResetPasswordRequest(token=token, new_password="NuevaPassword"))
    assert exc_inactive.value.status_code == 400

    # 3. Usuario eliminado
    memory_db["users"].remove(doc_ids=[seeded_user["id"]])
    with pytest.raises(HTTPException) as exc_deleted:
        reset_password(ResetPasswordRequest(token=token, new_password="NuevaPassword"))
    assert exc_deleted.value.status_code == 400


def test_reset_password_handles_storage_oserror_on_read_and_write(
    seeded_user: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Si TinyDB falla al leer el usuario o al actualizar la contraseña, devuelve 500."""
    token = create_password_reset_token(seeded_user["id"])
    broken_users = MagicMock()
    broken_users.get.side_effect = OSError("Read failure")
    monkeypatch.setattr(auth_routes, "users", broken_users)

    with pytest.raises(HTTPException) as exc_read:
        reset_password(
            ResetPasswordRequest(token=token, new_password="NuevaPassword123")
        )
    assert exc_read.value.status_code == 500

    # Simular que get() funciona pero update() falla con OSError
    broken_users.get.side_effect = None
    broken_users.get.return_value = {"is_active": True, "password_changed_at": None}
    broken_users.update.side_effect = OSError("Write failure")

    with pytest.raises(HTTPException) as exc_write:
        reset_password(
            ResetPasswordRequest(token=token, new_password="NuevaPassword123")
        )
    assert exc_write.value.status_code == 500
