from fastapi import APIRouter, Depends, HTTPException
from tinydb import Query

from ..database import profiles
from ..models import ProfileDB, ProfileUpdate, UserDB
from ..security import get_current_user

router = APIRouter(prefix="/profiles", tags=["Profiles"])


@router.get("/me", response_model=ProfileDB)
def read_my_profile(current_user: UserDB = Depends(get_current_user)) -> ProfileDB:
    record = profiles.get(Query().user_id == current_user.id)
    if record is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return ProfileDB(id=record.doc_id, **record)


@router.put("/me", response_model=ProfileDB)
def update_my_profile(
    update: ProfileUpdate, current_user: UserDB = Depends(get_current_user)
) -> ProfileDB:
    data = update.model_dump(exclude_unset=True, exclude_none=True)
    if data:
        profiles.update(data, Query().user_id == current_user.id)
    return read_my_profile(current_user)
