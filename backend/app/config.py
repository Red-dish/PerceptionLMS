"""Settings read from environment variables. On Lambda, Terraform sets them."""

import os
from dataclasses import dataclass
from functools import cache


@dataclass(frozen=True)
class Settings:
    table_name: str
    bucket_name: str
    google_client_id: str
    jwt_secret: str
    # Emails that become admins on their first Google sign-in, so the first admin can get in.
    admin_emails: frozenset[str]
    # If set, only Google accounts from this Google Workspace domain can sign in.
    allowed_domain: str | None
    allowed_origins: list[str]
    token_ttl_minutes: int
    max_upload_mb: int


def _split(value: str) -> list[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


@cache
def get_settings() -> Settings:
    return Settings(
        table_name=os.environ["TABLE_NAME"],
        bucket_name=os.environ["BUCKET_NAME"],
        google_client_id=os.environ["GOOGLE_CLIENT_ID"],
        jwt_secret=os.environ["JWT_SECRET"],
        admin_emails=frozenset(email.lower() for email in _split(os.environ.get("ADMIN_EMAILS", ""))),
        allowed_domain=os.environ.get("ALLOWED_DOMAIN") or None,
        allowed_origins=_split(os.environ.get("ALLOWED_ORIGINS", "")),
        token_ttl_minutes=int(os.environ.get("TOKEN_TTL_MINUTES", "480")),
        max_upload_mb=int(os.environ.get("MAX_UPLOAD_MB", "20")),
    )
