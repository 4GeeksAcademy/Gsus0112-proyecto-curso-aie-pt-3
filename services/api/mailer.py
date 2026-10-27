import html
import logging
import os
from urllib.parse import quote

import resend

logger = logging.getLogger(__name__)

RESET_PASSWORD_URL = os.getenv("RESET_PASSWORD_URL", "http://localhost:3000/reset-password")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "TrackFlow <onboarding@resend.dev>")


def send_password_reset_email(to_email: str, token: str) -> None:
    # Lee la clave usando el os que ya está importado al inicio del archivo
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        logger.error("RESEND_API_KEY no está configurada; no se envía el email de recuperación")
        return

    # Asignamos la clave fresca a la librería
    resend.api_key = api_key

    link = html.escape(f"{RESET_PASSWORD_URL}?token={quote(token, safe='')}", quote=True)
    email_payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": "Recupera tu contraseña de TrackFlow",
        "html": (
            "<p>Hemos recibido una solicitud para restablecer tu contraseña.</p>"
            f'<p><a href="{link}">Restablecer contraseña</a></p>'
            "<p>El enlace caduca en breve. Si no fuiste tú, ignora este mensaje.</p>"
        ),
    }
    try:
        resend.Emails.send(email_payload)
    except Exception as exc:
        # Never leak delivery failures, API keys, or reset tokens to logs or clients.
        logger.error(
            "Error al enviar el email de recuperación de contraseña (%s).",
            type(exc).__name__,
        )