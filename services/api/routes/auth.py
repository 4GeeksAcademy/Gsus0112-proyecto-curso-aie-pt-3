from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from tinydb import Query

from ..database import profiles, users
from ..mailer import send_password_reset_email
from ..models import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserDB,
)
from ..security import (
    create_access_token,
    create_password_reset_token,
    decode_password_reset_token,
    get_current_user,
    get_password_hash,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])

FORGOT_PASSWORD_MESSAGE = (
    "Si el email está registrado, recibirás un enlace para restablecer la contraseña"
)


def _set_password(user_id: int, new_password: str) -> None:
    payload = {
        "hashed_password": get_password_hash(new_password),
        "password_changed_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        users.update(payload, doc_ids=[user_id])
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo actualizar la contraseña en este momento.",
        ) from exc


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()) -> dict[str, str]:
    try:
        user = users.get(Query().email == form_data.username)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo procesar el inicio de sesión en este momento.",
        ) from exc

    if user is None or not verify_password(form_data.password, user.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": str(user.doc_id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def read_me(current_user: UserDB = Depends(get_current_user)) -> dict[str, Any]:
    try:
        profile = profiles.get(Query().user_id == current_user.id) or {}
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo consultar el perfil del usuario en este momento.",
        ) from exc

    return {
        "email": current_user.email,
        "role": current_user.role,
        "name": profile.get("name", ""),
        "phone": profile.get("phone", ""),
        "address": profile.get("address", ""),
    }


@router.post("/forgot-password")
def forgot_password(
    body: ForgotPasswordRequest, background_tasks: BackgroundTasks
) -> dict[str, str]:
    try:
        user = users.get(Query().email == body.email)
    except OSError:
        user = None

    if user is not None and user.get("is_active", True):
        token = create_password_reset_token(user.doc_id)
        # Sent after the response so timing does not reveal whether the email exists.
        background_tasks.add_task(send_password_reset_email, user["email"], token)
    return {"detail": FORGOT_PASSWORD_MESSAGE}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest) -> dict[str, str]:
    invalid_token = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST, detail="Token inválido o expirado"
    )
    decoded = decode_password_reset_token(body.token)
    if decoded is None:
        raise invalid_token
    user_id, issued_at = decoded

    try:
        user = users.get(doc_id=user_id)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo restablecer la contraseña en este momento.",
        ) from exc

    if user is None or not user.get("is_active", True):
        raise invalid_token
    changed_at = user.get("password_changed_at")
    if changed_at:
        try:
            changed_ts = datetime.fromisoformat(str(changed_at)).timestamp()
        except (ValueError, TypeError):
            raise invalid_token
        if issued_at < changed_ts:
            raise invalid_token

    _set_password(user_id, body.new_password)
    return {"detail": "Contraseña restablecida correctamente"}


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest, current_user: UserDB = Depends(get_current_user)
) -> dict[str, str]:
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña actual no es correcta"
        )
    _set_password(current_user.id, body.new_password)
    return {"detail": "Contraseña actualizada correctamente"}
