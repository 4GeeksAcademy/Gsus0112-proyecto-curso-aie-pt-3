"""Pruebas unitarias para los endpoints de gestión de usuarios del backoffice (Ticket API-042)."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from tinydb import Query

from services.api.models import RoleEnum, UserUpdate
from services.api.routes import users as users_routes
from services.api.routes.users import delete_user, get_user, list_users, update_user


# =====================================================================
# 1. CAMINO FELIZ (Happy Path)
# =====================================================================


def test_list_and_get_user_by_id_for_authenticated_session(
    seeded_user: dict[str, Any], seeded_admin: dict[str, Any]
) -> None:
    """Lista todos los usuarios registrados y recupera el detalle de un usuario existente."""
    all_users = list_users(seeded_user["user_db"])
    emails = {u.email for u in all_users}
    assert {seeded_user["email"], seeded_admin["email"]}.issubset(emails)

    detail = get_user(seeded_user["id"], seeded_user["user_db"])
    assert detail.email == seeded_user["email"]


def test_user_updates_own_email_and_admin_can_change_roles(
    seeded_user: dict[str, Any],
    seeded_admin: dict[str, Any],
    memory_db: dict[str, Any],
) -> None:
    """Un usuario puede actualizar su propio email y un admin puede promover el rol de otro usuario."""
    own_updated = update_user(
        seeded_user["id"],
        UserUpdate(email="operador-actualizado@trackflow.com"),
        current_user=seeded_user["user_db"],
    )
    assert own_updated.email == "operador-actualizado@trackflow.com"

    role_updated = update_user(
        seeded_user["id"],
        UserUpdate(role=RoleEnum.manager),
        current_user=seeded_admin["user_db"],
    )
    assert role_updated.role == RoleEnum.manager
    assert memory_db["users"].get(doc_id=seeded_user["id"])["role"] == "manager"


def test_delete_user_removes_account_and_cascades_to_profile(
    seeded_user: dict[str, Any],
    seeded_admin: dict[str, Any],
    memory_db: dict[str, Any],
) -> None:
    """Al eliminar un usuario se borra tanto el documento en 'users' como su perfil en 'profiles'."""
    response = delete_user(seeded_user["id"], current_user=seeded_admin["user_db"])
    assert response.status_code == 204
    assert memory_db["users"].get(doc_id=seeded_user["id"]) is None
    assert memory_db["profiles"].get(Query().user_id == seeded_user["id"]) is None


# =====================================================================
# 2. CASOS LÍMITE (Edge Cases)
# =====================================================================


def test_update_user_with_same_email_or_empty_payload_succeeds(
    seeded_user: dict[str, Any],
) -> None:
    """Enviar el mismo email propio no debe lanzar conflicto 409; un payload vacío conserva los datos."""
    same_email = update_user(
        seeded_user["id"],
        UserUpdate(email=seeded_user["email"]),
        current_user=seeded_user["user_db"],
    )
    assert same_email.email == seeded_user["email"]

    empty_update = update_user(
        seeded_user["id"],
        UserUpdate(),
        current_user=seeded_user["user_db"],
    )
    assert empty_update.email == seeded_user["email"]


# =====================================================================
# 3. MODOS DE FALLO (Failure Modes)
# =====================================================================


def test_non_admin_cannot_modify_delete_other_users_or_escalate_own_role(
    seeded_user: dict[str, Any], seeded_admin: dict[str, Any]
) -> None:
    """Un usuario no-admin recibe 403 si intenta editar/borrar otra cuenta o cambiar su propio rol."""
    with pytest.raises(HTTPException) as exc_other_upd:
        update_user(
            seeded_admin["id"],
            UserUpdate(email="hack@trackflow.com"),
            current_user=seeded_user["user_db"],
        )
    assert exc_other_upd.value.status_code == 403

    with pytest.raises(HTTPException) as exc_other_del:
        delete_user(seeded_admin["id"], current_user=seeded_user["user_db"])
    assert exc_other_del.value.status_code == 403

    with pytest.raises(HTTPException) as exc_escalate:
        update_user(
            seeded_user["id"],
            UserUpdate(role=RoleEnum.admin),
            current_user=seeded_user["user_db"],
        )
    assert exc_escalate.value.status_code == 403


def test_update_user_rejects_email_already_used_by_another_account(
    seeded_user: dict[str, Any], seeded_admin: dict[str, Any]
) -> None:
    """Cambiar el email al de otro usuario existente debe fallar con 409 Conflict."""
    with pytest.raises(HTTPException) as exc_conflict:
        update_user(
            seeded_user["id"],
            UserUpdate(email=seeded_admin["email"]),
            current_user=seeded_user["user_db"],
        )
    assert exc_conflict.value.status_code == 409


def test_get_update_or_delete_nonexistent_user_returns_404(
    seeded_admin: dict[str, Any],
) -> None:
    """Operar sobre un ID inexistente lanza HTTPException 404."""
    with pytest.raises(HTTPException) as exc_get:
        get_user(9999, seeded_admin["user_db"])
    assert exc_get.value.status_code == 404

    with pytest.raises(HTTPException) as exc_upd:
        update_user(
            9999,
            UserUpdate(email="libre@trackflow.com"),
            current_user=seeded_admin["user_db"],
        )
    assert exc_upd.value.status_code == 404

    with pytest.raises(HTTPException) as exc_del:
        delete_user(9999, current_user=seeded_admin["user_db"])
    assert exc_del.value.status_code == 404


def test_users_endpoints_handle_storage_oserrors(
    seeded_admin: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Verifica que fallos de I/O (OSError) en listado, lectura, actualización y borrado lanzan 500."""
    broken_users = MagicMock()
    broken_users.all.side_effect = OSError("List error")
    broken_users.get.side_effect = OSError("Get error")
    broken_users.remove.side_effect = OSError("Remove error")
    monkeypatch.setattr(users_routes, "users", broken_users)

    with pytest.raises(HTTPException) as exc_list:
        list_users(seeded_admin["user_db"])
    assert exc_list.value.status_code == 500

    with pytest.raises(HTTPException) as exc_get:
        get_user(1, seeded_admin["user_db"])
    assert exc_get.value.status_code == 500

    with pytest.raises(HTTPException) as exc_upd:
        update_user(
            seeded_admin["id"],
            UserUpdate(email="nuevo@trackflow.com"),
            current_user=seeded_admin["user_db"],
        )
    assert exc_upd.value.status_code == 500

    with pytest.raises(HTTPException) as exc_del:
        delete_user(seeded_admin["id"], current_user=seeded_admin["user_db"])
    assert exc_del.value.status_code == 500
