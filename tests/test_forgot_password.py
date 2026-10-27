"""Pruebas unitarias para la lógica de recuperación de contraseña (POST /auth/forgot-password)."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import BackgroundTasks
from pydantic import ValidationError

from services.api.models import ForgotPasswordRequest
from services.api.routes import auth as auth_routes
from services.api.routes.auth import forgot_password
from services.api.security import decode_password_reset_token, get_password_hash


# =====================================================================
# 1. CAMINO FELIZ (Happy Path)
# =====================================================================


def test_forgot_password_dispatches_valid_reset_token_for_active_user(
    seeded_user: dict[str, Any], mock_mailer: MagicMock
) -> None:
    """Para un usuario registrado y activo, genera un token de reset válido y encola el correo."""
    tasks = BackgroundTasks()
    result = forgot_password(
        ForgotPasswordRequest(email=seeded_user["email"]),
        background_tasks=tasks,
    )

    assert "detail" in result
    assert len(tasks.tasks) == 1

    # Ejecutar la tarea encolada y verificar los argumentos de negocio (email + token válido)
    task = tasks.tasks[0]
    task.func(*task.args, **task.kwargs)
    mock_mailer.assert_called_once()
    sent_email, sent_token = mock_mailer.call_args.args
    assert sent_email == seeded_user["email"]

    decoded = decode_password_reset_token(sent_token)
    assert decoded is not None
    assert decoded[0] == seeded_user["id"]


# =====================================================================
# 2. CASOS LÍMITE (Edge Cases — Anti-enumeración)
# =====================================================================


def test_forgot_password_does_not_reveal_unregistered_or_inactive_users(
    seeded_user: dict[str, Any],
    memory_db: dict[str, Any],
    mock_mailer: MagicMock,
) -> None:
    """Emails desconocidos o cuentas inactivas devuelven la misma respuesta sin encolar correo."""
    memory_db["users"].insert(
        {
            "email": "inactivo@trackflow.com",
            "hashed_password": get_password_hash("Clave123"),
            "is_active": False,
            "role": "user",
            "created_at": "2026-10-20T10:00:00+00:00",
        }
    )

    tasks_unknown = BackgroundTasks()
    unknown_res = forgot_password(
        ForgotPasswordRequest(email="desconocido@trackflow.com"),
        background_tasks=tasks_unknown,
    )

    tasks_inactive = BackgroundTasks()
    inactive_res = forgot_password(
        ForgotPasswordRequest(email="inactivo@trackflow.com"),
        background_tasks=tasks_inactive,
    )

    # La respuesta debe ser idéntica para impedir enumeración de correos registrados
    assert unknown_res == inactive_res
    assert len(tasks_unknown.tasks) == 0
    assert len(tasks_inactive.tasks) == 0
    mock_mailer.assert_not_called()


# =====================================================================
# 3. MODOS DE FALLO (Failure Modes)
# =====================================================================


def test_forgot_password_rejects_empty_or_overlong_email(
    mock_mailer: MagicMock,
) -> None:
    """Rechaza solicitudes con email vacío o mayor a 254 caracteres (límite RFC)."""
    with pytest.raises(ValidationError):
        ForgotPasswordRequest(email="")

    with pytest.raises(ValidationError):
        ForgotPasswordRequest(email=f"{'a' * 250}@test.com")

    mock_mailer.assert_not_called()


def test_forgot_password_absorbs_storage_oserror_without_leaking_error(
    monkeypatch: pytest.MonkeyPatch, mock_mailer: MagicMock
) -> None:
    """Si TinyDB falla con OSError, responde con el mensaje genérico y no encola correo."""
    broken_users = MagicMock()
    broken_users.get.side_effect = OSError("Storage error")
    monkeypatch.setattr(auth_routes, "users", broken_users)

    tasks = BackgroundTasks()
    result = forgot_password(
        ForgotPasswordRequest(email="operador@trackflow.com"),
        background_tasks=tasks,
    )

    assert "detail" in result
    assert len(tasks.tasks) == 0
    mock_mailer.assert_not_called()
