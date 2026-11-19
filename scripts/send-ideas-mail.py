#!/usr/bin/env python3
"""Mail the pending-ideas report.

Usage
    python3 scripts/send-ideas-mail.py out/mail.txt

The file starts with the subject line, then a blank line, then the body.

Secrets (repo → Settings → Secrets and variables → Actions)
    MAIL_USERNAME  Gmail address that sends (e.g. ytdjbhai34@gmail.com)
    MAIL_PASSWORD  Gmail app password (16 chars) — NOT the account password
    MAIL_TO        optional recipient, defaults to MAIL_USERNAME

Gmail needs an app password (2-Step Verification required):
    https://myaccount.google.com/apppasswords

Exit codes
    0 mail sent (or nothing to send)
    3 SMTP not configured — the workflow then falls back to a GitHub issue
    4 SMTP error
"""
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "out/mail.txt"
    try:
        with open(path, "r", encoding="utf-8") as fh:
            text = fh.read().strip()
    except OSError as exc:
        print(f"cannot read {path}: {exc}", file=sys.stderr)
        return 4

    subject, _, body = text.partition("\n")
    body = body.strip() or "(empty)"

    user = os.environ.get("MAIL_USERNAME", "").strip()
    password = os.environ.get("MAIL_PASSWORD", "").strip()
    to = (os.environ.get("MAIL_TO") or user).strip()

    # Nothing pending and not forced: stay quiet.
    force = (os.environ.get("FORCE", "") or "").lower() in ("1", "true", "yes")
    if "koi pending idea nahi" in subject and not force:
        print("nothing pending — no mail sent")
        return 0

    if not user or not password:
        print("MAIL_USERNAME / MAIL_PASSWORD not set — skipping SMTP", file=sys.stderr)
        return 3

    msg = EmailMessage()
    msg["From"] = f"Kissa ideas <{user}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as smtp:
            smtp.starttls(context=context)
            smtp.login(user, password)
            smtp.send_message(msg)
    except Exception as exc:  # noqa: BLE001 - report, do not crash the job
        print(f"SMTP failed: {exc}", file=sys.stderr)
        return 4

    print(f"mail sent to {to}: {subject}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
