from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from tinydb import Query

from ..database import profiles, users
from ..models import RoleEnum, UserCreate, UserDB, UserResponse, UserUpdate
from ..security import get_current_user, get_password_hash

router = APIRouter(prefix="/users", tags=["Users"])


def _ensure_owner_or_admin(current_user: UserDB, id: int) -> None:
    if current_user.id != id and current_user.role != RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.post("", response_model=UserResponse, status_code=201)
def create_user(user: UserCreate) -> UserResponse:
    try:
        exists = users.contains(Query().email == user.email)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo verificar el registro de usuario.",
        ) from exc

    if exists:
        raise HTTPException(status_code=409, detail="Email already registered")

    data = {
        "email": user.email,
        "hashed_password": get_password_hash(user.password),
        "is_active": True,
        # Public sign-up never grants elevated roles; admins are seeded directly.
        "role": RoleEnum.user.value,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    profile_data = {
        "name": user.name or "",
        "phone": user.phone or "",
        "address": user.address or "",
    }
    try:
        user_id = users.insert(data)
        profiles.insert({"user_id": user_id, **profile_data})
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo crear el usuario en este momento.",
        ) from exc

    return UserResponse(id=user_id, **data)


@router.get("", response_model=list[UserResponse])
def list_users(_: UserDB = Depends(get_current_user)) -> list[UserResponse]:
    try:
        records = users.all()
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo obtener la lista de usuarios.",
        ) from exc
    return [UserResponse(id=record.doc_id, **record) for record in records]


@router.get("/{id}", response_model=UserResponse)
def get_user(id: int, _: UserDB = Depends(get_current_user)) -> UserResponse:
    try:
        record = users.get(doc_id=id)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo consultar el usuario solicitado.",
        ) from exc
    if record is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(id=record.doc_id, **record)


@router.put("/{id}", response_model=UserResponse)
def update_user(
    id: int, update: UserUpdate, current_user: UserDB = Depends(get_current_user)
) -> UserResponse:
    _ensure_owner_or_admin(current_user, id)
    data = update.model_dump(mode="json", exclude_unset=True, exclude_none=True)
    # Prevents a non-admin from escalating their own role.
    if "role" in data and current_user.role != RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if "email" in data:
        try:
            existing = users.get(Query().email == data["email"])
        except OSError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo validar el email del usuario.",
            ) from exc
        if existing is not None and existing.doc_id != id:
            raise HTTPException(status_code=409, detail="Email already registered")

    try:
        current_record = users.get(doc_id=id)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo consultar el usuario a actualizar.",
        ) from exc
    if current_record is None:
        raise HTTPException(status_code=404, detail="User not found")
    if data:
        try:
            users.update(data, doc_ids=[id])
        except OSError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudieron guardar los cambios del usuario.",
            ) from exc
    return get_user(id, current_user)


@router.delete("/{id}", status_code=204)
def delete_user(id: int, current_user: UserDB = Depends(get_current_user)) -> Response:
    _ensure_owner_or_admin(current_user, id)
    try:
        removed = users.remove(doc_ids=[id])
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo eliminar el usuario.",
        ) from exc
    if not removed:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        profiles.remove(Query().user_id == id)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo eliminar el perfil asociado al usuario.",
        ) from exc
    return Response(status_code=204)
