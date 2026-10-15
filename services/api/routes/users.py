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
    if users.contains(Query().email == user.email):
        raise HTTPException(status_code=409, detail="Email already registered")

    data = {
        "email": user.email,
        "hashed_password": get_password_hash(user.password),
        "is_active": True,
        # Public sign-up never grants elevated roles; admins are seeded directly.
        "role": RoleEnum.user.value,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    user_id = users.insert(data)
    profiles.insert(
        {
            "user_id": user_id,
            "name": user.name or "",
            "phone": user.phone or "",
            "address": user.address or "",
        }
    )
    return UserResponse(id=user_id, **data)


@router.get("", response_model=list[UserResponse])
def list_users(_: UserDB = Depends(get_current_user)) -> list[UserResponse]:
    return [UserResponse(id=record.doc_id, **record) for record in users.all()]


@router.get("/{id}", response_model=UserResponse)
def get_user(id: int, _: UserDB = Depends(get_current_user)) -> UserResponse:
    record = users.get(doc_id=id)
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
        existing = users.get(Query().email == data["email"])
        if existing is not None and existing.doc_id != id:
            raise HTTPException(status_code=409, detail="Email already registered")

    if users.get(doc_id=id) is None:
        raise HTTPException(status_code=404, detail="User not found")
    if data:
        users.update(data, doc_ids=[id])
    return get_user(id, current_user)


@router.delete("/{id}", status_code=204)
def delete_user(id: int, current_user: UserDB = Depends(get_current_user)) -> Response:
    _ensure_owner_or_admin(current_user, id)
    if not users.remove(doc_ids=[id]):
        raise HTTPException(status_code=404, detail="User not found")
    profiles.remove(Query().user_id == id)
    return Response(status_code=204)
