"""Pruebas unitarias para los endpoints de perfiles de usuario (GET/PUT /profiles/me — Ticket API-042)."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from tinydb import Query

from services.api.models import ProfileUpdate
from services.api.routes import profiles as profiles_routes
from services.api.routes.profiles import read_my_profile, update_my_profile


# =====================================================================
# 1. CAMINO FELIZ (Happy Path)
# =====================================================================


def test_read_and_update_my_profile_persists_changes(
    seeded_user: dict[str, Any], memory_db: dict[str, Any]
) -> None:
    """Lee el perfil propio y actualiza todos sus campos verificando la persistencia en TinyDB."""
    initial = read_my_profile(current_user=seeded_user["user_db"])
    assert initial.name == "Ana Operadora"

    updated = update_my_profile(
        ProfileUpdate(
            name="Ana María Operadora",
            phone="+34 699 888 777",
            address="Centro Logístico Barcelona",
        ),
        current_user=seeded_user["user_db"],
    )
    assert updated.name == "Ana María Operadora"
    assert updated.phone == "+34 699 888 777"
    assert updated.address == "Centro Logístico Barcelona"

    stored = memory_db["profiles"].get(Query().user_id == seeded_user["id"])
    assert stored["address"] == "Centro Logístico Barcelona"


# =====================================================================
# 2. CASOS LÍMITE (Edge Cases)
# =====================================================================


def test_partial_profile_update_preserves_unmodified_fields(
    seeded_user: dict[str, Any],
) -> None:
    """Actualizar únicamente el teléfono conserva intactos el nombre y la dirección existentes."""
    partial = update_my_profile(
        ProfileUpdate(phone="+34 600 000 111"),
        current_user=seeded_user["user_db"],
    )
    assert partial.phone == "+34 600 000 111"
    assert partial.name == "Ana Operadora"
    assert partial.address == "Plataforma Logística Madrid"


# =====================================================================
# 3. MODOS DE FALLO (Failure Modes)
# =====================================================================


def test_read_my_profile_returns_404_when_profile_document_is_missing(
    seeded_user: dict[str, Any], memory_db: dict[str, Any]
) -> None:
    """Si el registro de perfil fue eliminado, read_my_profile lanza HTTPException 404."""
    memory_db["profiles"].remove(Query().user_id == seeded_user["id"])
    with pytest.raises(HTTPException) as exc_info:
        read_my_profile(current_user=seeded_user["user_db"])
    assert exc_info.value.status_code == 404


def test_profiles_endpoints_handle_storage_oserror(
    seeded_user: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Si la tabla de perfiles lanza OSError al leer o actualizar, lanza HTTPException 500."""
    broken_profiles = MagicMock()
    broken_profiles.get.side_effect = OSError("Read error")
    broken_profiles.update.side_effect = OSError("Write error")
    monkeypatch.setattr(profiles_routes, "profiles", broken_profiles)

    with pytest.raises(HTTPException) as exc_read:
        read_my_profile(current_user=seeded_user["user_db"])
    assert exc_read.value.status_code == 500

    with pytest.raises(HTTPException) as exc_write:
        update_my_profile(
            ProfileUpdate(name="Nuevo Nombre"),
            current_user=seeded_user["user_db"],
        )
    assert exc_write.value.status_code == 500
