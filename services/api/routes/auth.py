from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from tinydb import Query

from ..database import profiles, users
from ..models import UserDB
from ..security import create_access_token, get_current_user, verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()) -> dict[str, str]:
    user = users.get(Query().email == form_data.username)
    if user is None or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": str(user.doc_id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def read_me(current_user: UserDB = Depends(get_current_user)) -> dict[str, Any]:
    profile = profiles.get(Query().user_id == current_user.id) or {}
    return {
        "email": current_user.email,
        "role": current_user.role,
        "name": profile.get("name", ""),
        "phone": profile.get("phone", ""),
        "address": profile.get("address", ""),
    }
