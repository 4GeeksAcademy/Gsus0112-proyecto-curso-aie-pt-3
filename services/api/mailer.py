import html
import logging
import os
from urllib.parse import quote

import resend

logger = logging.getLogger(__name__)

RESET_PASSWORD_URL = os.getenv("RESET_PASSWORD_URL", "http://localhost:3000/reset-password")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "TrackFlow <onboarding@resend.dev>")


def send_password_reset_email(to_email: str, token: str) -> None:
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        logger.error("RESEND_API_KEY no está configurada; no se envía el email de recuperación")
        return

    resend.api_key = api_key
    link = html.escape(f"{RESET_PASSWORD_URL}?token={quote(token, safe='')}", quote=True)
    try:
        resend.Emails.send(
            {
                "from": RESEND_FROM_EMAIL,
                "to": [to_email],
                "subject": "Recupera tu contraseña de TrackFlow",
                "html": (
                    "<p>Hemos recibido una solicitud para restablecer tu contraseña.</p>"
                    f'<p><a href="{link}">Restablecer contraseña</a></p>'
                    "<p>El enlace caduca en breve. Si no fuiste tú, ignora este mensaje.</p>"
                ),
            }
        )
    except Exception:
        # Never leak delivery failures to the client; the endpoint always answers 200.
        logger.exception("Error al enviar el email de recuperación de contraseña")
