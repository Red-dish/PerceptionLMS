"""Google sign-in and the API's own session tokens.

1. The frontend shows Google's "Sign in with Google" button and gets an ID token.
2. It posts that token to /auth/google. We check Google's signature and that the
   email belongs to a user an admin has added.
3. We return our own short-lived token, which the frontend sends as
   "Authorization: Bearer <token>" on every other request.
"""

from datetime import UTC, datetime, timedelta
from functools import cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app import db
from app.config import get_settings

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")
TOKEN_ISSUER = "perception-lms"


@cache
def _google_keys() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(GOOGLE_CERTS_URL, cache_keys=True, lifespan=3600)


def google_signing_key(token: str):
    return _google_keys().get_signing_key_from_jwt(token).key


def verify_google_token(token: str) -> dict:
    settings = get_settings()
    try:
        claims = jwt.decode(
            token,
            google_signing_key(token),
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=GOOGLE_ISSUERS,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google sign-in could not be verified") from exc
    if not claims.get("email_verified"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your Google email address is not verified")
    if settings.allowed_domain and claims.get("hd") != settings.allowed_domain:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Sign in with your {settings.allowed_domain} account")
    return claims


def issue_token(user: dict) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "iss": TOKEN_ISSUER,
        "iat": now,
        "exp": now + timedelta(minutes=settings.token_ttl_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


_bearer = HTTPBearer(auto_error=False)


def current_user(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]) -> dict:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED, "Sign in required", headers={"WWW-Authenticate": "Bearer"}
    )
    if credentials is None:
        raise unauthorized
    try:
        claims = jwt.decode(
            credentials.credentials, get_settings().jwt_secret, algorithms=["HS256"], issuer=TOKEN_ISSUER
        )
    except jwt.PyJWTError:
        raise unauthorized from None
    # Load the user each time so role changes and deactivations apply straight away.
    user = db.get_user(claims["sub"])
    if user is None or not user["active"]:
        raise unauthorized
    return user


CurrentUser = Annotated[dict, Depends(current_user)]


def require_admin(user: CurrentUser) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only administrators can do this")
    return user


AdminUser = Annotated[dict, Depends(require_admin)]
