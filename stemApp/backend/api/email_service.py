import logging
import os
import smtplib
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str) -> None:
    """
    Send an email. Behavior controlled by EMAIL_MODE env var:
      mock (default) — logs to console with [EMAIL] prefix
      smtp           — sends via SMTP using SMTP_HOST/PORT/USER/PASS env vars
    Never raises — email failure is always non-fatal.
    """
    mode = os.getenv("EMAIL_MODE", "mock").strip().lower()

    if mode == "smtp":
        try:
            host = os.getenv("SMTP_HOST", "localhost")
            port = int(os.getenv("SMTP_PORT", "587"))
            user = os.getenv("SMTP_USER", "")
            password = os.getenv("SMTP_PASS", "")

            msg = MIMEText(body, "plain")
            msg["Subject"] = subject
            msg["From"] = user
            msg["To"] = to

            with smtplib.SMTP(host, port) as server:
                server.starttls()
                server.login(user, password)
                server.sendmail(user, [to], msg.as_string())

            logger.info("[EMAIL] Sent to %s — %s", to, subject)
        except Exception as exc:
            logger.error("[EMAIL] Failed to send to %s — %s: %s", to, subject, exc)
    else:
        # Mock mode — log the full email so reset links can be copied manually
        logger.info(
            "\n[EMAIL MOCK]\nTo: %s\nSubject: %s\n\n%s\n[/EMAIL MOCK]",
            to, subject, body,
        )
        print(
            f"\n[EMAIL MOCK]\nTo: {to}\nSubject: {subject}\n\n{body}\n[/EMAIL MOCK]\n"
        )
