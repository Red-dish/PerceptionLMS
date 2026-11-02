from fastapi import APIRouter, HTTPException, status

from app import db
from app.auth import issue_token, verify_google_token
from app.config import get_settings
from app.models import GoogleLogin, TokenResponse

router = APIRouter(prefix="/auth", tags=["sign-in"])


@router.post("/google", response_model=TokenResponse)
def sign_in_with_google(body: GoogleLogin):
    claims = verify_google_token(body.credential)
    email = claims["email"].lower()
    user = db.find_user_by_email(email)
    if user is None and email in get_settings().admin_emails:
        user = db.create_user(email=email, name=claims.get("name") or email, role="admin")
    if user is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Your account has not been set up yet. Ask an administrator to add you."
        )
    if not user["active"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account has been deactivated")
    return {"access_token": issue_token(user), "user": user}
