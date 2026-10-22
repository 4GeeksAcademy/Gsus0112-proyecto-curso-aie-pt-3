import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.hash import bcrypt

from .database import users
from .models import UserDB

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
# Clamped to the 15-60 minute window required for reset links.
RESET_TOKEN_EXPIRE_MINUTES = min(max(int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "30")), 15), 60)
PASSWORD_RESET_TOKEN_TYPE = "password_reset"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_password_hash(password: str) -> str:
    return bcrypt.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_password_reset_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": PASSWORD_RESET_TOKEN_TYPE,
        "iat": now,
        "exp": now + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_password_reset_token(token: str) -> tuple[int, int] | None:
    """Returns (user_id, iat) for a valid, unexpired reset token, or None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != PASSWORD_RESET_TOKEN_TYPE:
            return None
        return int(payload["sub"]), int(payload["iat"])
    except (JWTError, KeyError, TypeError, ValueError):
        return None


async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserDB:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Reset tokens share the signing key, so they must never authenticate a session.
        if payload.get("type") == PASSWORD_RESET_TOKEN_TYPE:
            raise credentials_exception
        user_id = int(payload["sub"])
    except (JWTError, KeyError, TypeError, ValueError):
        raise credentials_exception

    record = users.get(doc_id=user_id)
    if record is None:
        raise credentials_exception
    return UserDB(id=record.doc_id, **record)
