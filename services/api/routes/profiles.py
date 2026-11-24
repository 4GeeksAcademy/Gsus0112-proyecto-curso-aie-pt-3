from fastapi import APIRouter, Depends, HTTPException
from tinydb import Query

from ..database import profiles
from ..models import ProfileResponse, ProfileUpdate, UserDB
from ..security import get_current_user

router = APIRouter(prefix="/profiles", tags=["Profiles"])


@router.get("/me", response_model=ProfileResponse)
def read_my_profile(current_user: UserDB = Depends(get_current_user)) -> ProfileResponse:
    try:
        record = profiles.get(Query().user_id == current_user.id)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="No se pudo obtener el perfil del usuario en este momento.",
        ) from exc
    if record is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return ProfileResponse(
        name=record.get("name", ""),
        phone=record.get("phone", ""),
        address=record.get("address", ""),
    )


@router.put("/me", response_model=ProfileResponse)
def update_my_profile(
    update: ProfileUpdate, current_user: UserDB = Depends(get_current_user)
) -> ProfileResponse:
    data = update.model_dump(exclude_unset=True, exclude_none=True)
    if data:
        try:
            profiles.update(data, Query().user_id == current_user.id)
        except OSError as exc:
            raise HTTPException(
                status_code=500,
                detail="No se pudo actualizar el perfil en este momento.",
            ) from exc
    return read_my_profile(current_user)
