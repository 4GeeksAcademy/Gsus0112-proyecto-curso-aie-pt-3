"""Pruebas unitarias para la lógica de tokens JWT, expiración y hashing (services/api/security.py)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from jose import jwt

import services.api.security as security_module
from services.api.security import (
    ALGORITHM,
    PASSWORD_RESET_TOKEN_TYPE,
    SECRET_KEY,
    _parse_int_env,
    create_access_token,
    create_password_reset_token,
    decode_password_reset_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from tests.conftest import run_async


# =====================================================================
# 1. CAMINO FELIZ (Happy Path)
# =====================================================================


def test_create_access_token_and_resolve_current_user(
    seeded_user: dict[str, Any],
) -> None:
    """Genera un token de acceso válido y resuelve la entidad UserDB mediante get_current_user."""
    token = create_access_token({"sub": str(seeded_user["id"])})
    resolved_user = run_async(get_current_user(token=token))

    assert resolved_user.id == seeded_user["id"]
    assert resolved_user.email == seeded_user["email"]
    assert resolved_user.role.value == seeded_user["role"]


def test_create_and_decode_password_reset_token_roundtrip() -> None:
    """Genera un token de recuperación y extrae correctamente (user_id, issued_at)."""
    token = create_password_reset_token(user_id=42)
    decoded = decode_password_reset_token(token)

    assert decoded is not None
    user_id, issued_at = decoded
    assert user_id == 42
    assert isinstance(issued_at, float)
    assert issued_at <= datetime.now(timezone.utc).timestamp()


def test_password_hash_and_verify_roundtrip() -> None:
    """Verifica que dos hashes de la misma contraseña usan salt distinto pero ambos validan."""
    hash_a = get_password_hash("ClaveSecreta!")
    hash_b = get_password_hash("ClaveSecreta!")

    assert hash_a != hash_b
    assert verify_password("ClaveSecreta!", hash_a) is True
    assert verify_password("ClaveSecreta!", hash_b) is True
    assert verify_password("OtraClave", hash_a) is False


# =====================================================================
# 2. CASOS LÍMITE (Edge Cases)
# =====================================================================


def test_session_and_reset_tokens_are_strictly_isolated(
    seeded_user: dict[str, Any],
) -> None:
    """Un token de reset no puede autenticar sesión y un token de sesión no sirve para reset."""
    reset_token = create_password_reset_token(seeded_user["id"])
    session_token = create_access_token({"sub": str(seeded_user["id"])})

    # El token de sesión carece de type='password_reset', por lo que decode_password_reset_token lo rechaza
    assert decode_password_reset_token(session_token) is None

    # Aunque comparten SECRET_KEY, get_current_user debe rechazar tokens con type='password_reset'
    with pytest.raises(HTTPException) as exc_info:
        run_async(get_current_user(token=reset_token))
    assert exc_info.value.status_code == 401


def test_parse_int_env_handles_missing_valid_and_invalid_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verifica que _parse_int_env usa el valor por defecto si la variable no existe o no es entera."""
    monkeypatch.delenv("TEST_TOKEN_MINUTES", raising=False)
    assert _parse_int_env("TEST_TOKEN_MINUTES", 30) == 30

    monkeypatch.setenv("TEST_TOKEN_MINUTES", "45")
    assert _parse_int_env("TEST_TOKEN_MINUTES", 30) == 45

    monkeypatch.setenv("TEST_TOKEN_MINUTES", "no-es-numero")
    assert _parse_int_env("TEST_TOKEN_MINUTES", 30) == 30


def test_verify_password_returns_false_on_corrupted_hash() -> None:
    """Si el hash almacenado está corrupto o vacío, verify_password devuelve False en lugar de propagar ValueError."""
    assert verify_password("cualquier-clave", "hash-invalido-no-bcrypt") is False
    assert verify_password("cualquier-clave", "") is False


# =====================================================================
# 3. MODOS DE FALLO (Failure Modes — Expiración y Manipulación)
# =====================================================================


def test_expired_access_token_is_rejected_by_get_current_user(
    seeded_user: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un token cuya ventana de expiración ya venció debe ser rechazado con 401 (regresión del ticket AUTH-088)."""
    monkeypatch.setattr(security_module, "ACCESS_TOKEN_EXPIRE_MINUTES", -5)
    expired_token = create_access_token({"sub": str(seeded_user["id"])})

    with pytest.raises(HTTPException) as exc_info:
        run_async(get_current_user(token=expired_token))
    assert exc_info.value.status_code == 401


def test_expired_password_reset_token_returns_none() -> None:
    """Un token de recuperación expirado debe devolver None al decodificarse."""
    past = datetime.now(timezone.utc) - timedelta(minutes=20)
    expired_reset = jwt.encode(
        {
            "sub": "1",
            "type": PASSWORD_RESET_TOKEN_TYPE,
            "iat": past - timedelta(minutes=30),
            "exp": past,
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    assert decode_password_reset_token(expired_reset) is None


def test_tampered_or_malformed_tokens_are_rejected() -> None:
    """Tokens firmados con otra clave, malformados o con 'sub' no numérico son rechazados."""
    wrong_secret_token = jwt.encode({"sub": "1"}, "otra-clave-secreta", algorithm=ALGORITHM)
    non_numeric_sub = jwt.encode({"sub": "abc"}, SECRET_KEY, algorithm=ALGORITHM)
    missing_sub = jwt.encode({"role": "admin"}, SECRET_KEY, algorithm=ALGORITHM)

    for bad_token in ("token.mal.formado", wrong_secret_token, non_numeric_sub, missing_sub):
        with pytest.raises(HTTPException) as exc_info:
            run_async(get_current_user(token=bad_token))
        assert exc_info.value.status_code == 401

    bad_reset = jwt.encode(
        {"sub": "no-int", "type": PASSWORD_RESET_TOKEN_TYPE, "iat": "invalido"},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    assert decode_password_reset_token(bad_reset) is None


def test_get_current_user_rejects_deleted_or_deactivated_user(
    seeded_user: dict[str, Any], memory_db: dict[str, Any]
) -> None:
    """Si el usuario es desactivado o eliminado tras emitirse el token, la sesión queda invalidada."""
    token = seeded_user["token"]

    # Caso 1: Usuario desactivado (is_active=False)
    memory_db["users"].update({"is_active": False}, doc_ids=[seeded_user["id"]])
    with pytest.raises(HTTPException) as exc_deactivated:
        run_async(get_current_user(token=token))
    assert exc_deactivated.value.status_code == 401

    # Caso 2: Usuario eliminado de la base de datos
    memory_db["users"].remove(doc_ids=[seeded_user["id"]])
    with pytest.raises(HTTPException) as exc_deleted:
        run_async(get_current_user(token=token))
    assert exc_deleted.value.status_code == 401


def test_get_current_user_handles_database_oserror(
    seeded_user: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Si TinyDB lanza OSError al verificar el usuario del token, responde 500."""
    broken_users = MagicMock()
    broken_users.get.side_effect = OSError("DB read error")
    monkeypatch.setattr(security_module, "users", broken_users)

    with pytest.raises(HTTPException) as exc_info:
        run_async(get_current_user(token=seeded_user["token"]))
    assert exc_info.value.status_code == 500
