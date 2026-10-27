"""Pruebas unitarias para el cambio de contraseña autenticado (POST /auth/change-password)."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from services.api.models import ChangePasswordRequest, ResetPasswordRequest
from services.api.routes import auth as auth_routes
from services.api.routes.auth import change_password, reset_password
from services.api.security import create_password_reset_token, verify_password


# =====================================================================
# 1. CAMINO FELIZ (Happy Path)
# =====================================================================


def test_change_password_updates_hash_and_allows_verification_with_new_password(
    seeded_user: dict[str, Any], memory_db: dict[str, Any]
) -> None:
    """Verifica la clave actual, persiste el nuevo hash bcrypt y actualiza password_changed_at."""
    new_password = "PasswordActualizada2026!"
    result = change_password(
        ChangePasswordRequest(
            current_password=seeded_user["password"],
            new_password=new_password,
        ),
        current_user=seeded_user["user_db"],
    )
    assert "detail" in result

    updated = memory_db["users"].get(doc_id=seeded_user["id"])
    assert verify_password(new_password, updated["hashed_password"]) is True
    assert verify_password(seeded_user["password"], updated["hashed_password"]) is False
    assert updated.get("password_changed_at") is not None


# =====================================================================
# 2. CASOS LÍMITE (Edge Cases)
# =====================================================================


def test_change_password_invalidates_previously_issued_reset_tokens(
    seeded_user: dict[str, Any],
) -> None:
    """Si el usuario cambia su contraseña, cualquier token de reset emitido antes queda invalidado."""
    prior_reset_token = create_password_reset_token(seeded_user["id"])

    change_password(
        ChangePasswordRequest(
            current_password=seeded_user["password"],
            new_password="ClaveCambiadaManualmente1",
        ),
        current_user=seeded_user["user_db"],
    )

    # El enlace de recuperación anterior ya no debe permitir sobrescribir la nueva contraseña
    with pytest.raises(HTTPException) as exc_info:
        reset_password(
            ResetPasswordRequest(
                token=prior_reset_token, new_password="ClaveDesdeTokenAntiguo"
            )
        )
    assert exc_info.value.status_code == 400


def test_change_password_accepts_72_char_boundary(
    seeded_user: dict[str, Any], memory_db: dict[str, Any]
) -> None:
    """Permite establecer una nueva contraseña en el límite exacto de 72 caracteres."""
    boundary_password = "M" * 72
    change_password(
        ChangePasswordRequest(
            current_password=seeded_user["password"],
            new_password=boundary_password,
        ),
        current_user=seeded_user["user_db"],
    )
    updated = memory_db["users"].get(doc_id=seeded_user["id"])
    assert verify_password(boundary_password, updated["hashed_password"]) is True


# =====================================================================
# 3. MODOS DE FALLO (Failure Modes)
# =====================================================================


def test_change_password_rejects_wrong_current_password_and_preserves_existing_hash(
    seeded_user: dict[str, Any], memory_db: dict[str, Any]
) -> None:
    """Si la contraseña actual no coincide, lanza HTTPException 400 y no modifica el hash almacenado."""
    with pytest.raises(HTTPException) as exc_info:
        change_password(
            ChangePasswordRequest(
                current_password="PasswordActualIncorrecta",
                new_password="IntentoCambioPassword",
            ),
            current_user=seeded_user["user_db"],
        )
    assert exc_info.value.status_code == 400

    stored = memory_db["users"].get(doc_id=seeded_user["id"])
    assert verify_password(seeded_user["password"], stored["hashed_password"]) is True


def test_change_password_rejects_empty_or_overlong_passwords(
    seeded_user: dict[str, Any],
) -> None:
    """Rechaza esquemas con contraseña vacía o mayor de 72 caracteres."""
    with pytest.raises(ValidationError):
        ChangePasswordRequest(current_password=seeded_user["password"], new_password="")

    with pytest.raises(ValidationError):
        ChangePasswordRequest(
            current_password=seeded_user["password"], new_password="P" * 73
        )


def test_change_password_handles_storage_oserror(
    seeded_user: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Si la escritura en TinyDB lanza OSError al guardar el nuevo hash, lanza HTTPException 500."""
    broken_users = MagicMock()
    broken_users.update.side_effect = OSError("Disk full")
    monkeypatch.setattr(auth_routes, "users", broken_users)

    with pytest.raises(HTTPException) as exc_info:
        change_password(
            ChangePasswordRequest(
                current_password=seeded_user["password"],
                new_password="NuevaPasswordValida",
            ),
            current_user=seeded_user["user_db"],
        )
    assert exc_info.value.status_code == 500
