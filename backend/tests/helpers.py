"""Shared test helpers. Kept out of conftest.py so there is only ever one fake Google key."""

import time

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

ADMIN_EMAIL = "admin@example.edu"
CLIENT_ID = "test-client.apps.googleusercontent.com"
GOOGLE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def google_token(email, name="Test User", *, audience=CLIENT_ID, verified=True, hd=None):
    """An ID token like the one Google's sign-in button gives the frontend."""
    now = int(time.time())
    claims = {
        "iss": "https://accounts.google.com",
        "aud": audience,
        "sub": f"google-{email}",
        "email": email,
        "email_verified": verified,
        "name": name,
        "iat": now,
        "exp": now + 600,
    }
    if hd:
        claims["hd"] = hd
    return jwt.encode(claims, GOOGLE_KEY, algorithm="RS256")


def sign_in(client, email):
    response = client.post("/auth/google", json={"credential": google_token(email)})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
