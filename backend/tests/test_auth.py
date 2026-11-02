from app.config import get_settings
from tests.helpers import ADMIN_EMAIL, google_token, sign_in


def test_unknown_people_cannot_sign_in(client):
    response = client.post("/auth/google", json={"credential": google_token("stranger@example.edu")})
    assert response.status_code == 403
    assert "administrator" in response.json()["detail"]


def test_first_admin_is_created_on_first_sign_in(client):
    first = client.post("/auth/google", json={"credential": google_token(ADMIN_EMAIL, "Amora")}).json()
    second = client.post("/auth/google", json={"credential": google_token(ADMIN_EMAIL, "Amora")}).json()
    assert first["user"]["role"] == "admin"
    assert first["user"]["name"] == "Amora"
    assert second["user"]["id"] == first["user"]["id"]


def test_tokens_for_another_app_are_rejected(client):
    token = google_token(ADMIN_EMAIL, audience="someone-else.apps.googleusercontent.com")
    assert client.post("/auth/google", json={"credential": token}).status_code == 401


def test_unverified_google_emails_are_rejected(client):
    token = google_token(ADMIN_EMAIL, verified=False)
    assert client.post("/auth/google", json={"credential": token}).status_code == 401


def test_allowed_domain_limits_who_can_sign_in(client, monkeypatch):
    monkeypatch.setenv("ALLOWED_DOMAIN", "example.edu")
    get_settings.cache_clear()
    personal = google_token(ADMIN_EMAIL)
    college = google_token(ADMIN_EMAIL, hd="example.edu")
    assert client.post("/auth/google", json={"credential": personal}).status_code == 403
    assert client.post("/auth/google", json={"credential": college}).status_code == 200


def test_requests_need_a_valid_session_token(client):
    assert client.get("/me").status_code == 401
    assert client.get("/me", headers={"Authorization": "Bearer not-a-token"}).status_code == 401


def test_me_returns_the_signed_in_user(client):
    headers = sign_in(client, ADMIN_EMAIL)
    assert client.get("/me", headers=headers).json()["email"] == ADMIN_EMAIL


def test_deactivated_users_lose_access_straight_away(client, school):
    student_id = school.student_id
    response = client.patch(f"/admin/users/{student_id}", json={"active": False}, headers=school.admin)
    assert response.status_code == 200
    assert client.get("/me", headers=school.student).status_code == 401
    token = google_token("jordan.lee@example.edu")
    assert client.post("/auth/google", json={"credential": token}).status_code == 403


def test_admins_cannot_remove_their_own_access(client):
    headers = sign_in(client, ADMIN_EMAIL)
    my_id = client.get("/me", headers=headers).json()["id"]
    response = client.patch(f"/admin/users/{my_id}", json={"role": "student"}, headers=headers)
    assert response.status_code == 400


def test_only_admins_can_use_admin_routes(client, school):
    assert client.get("/admin/users", headers=school.lecturer).status_code == 403
    assert client.get("/admin/users", headers=school.admin).status_code == 200


def test_duplicate_users_and_course_codes_are_refused(client, school):
    user = {"email": "JORDAN.LEE@example.edu", "name": "Jordan again", "role": "student"}
    assert client.post("/admin/users", json=user, headers=school.admin).status_code == 409
    course = {"code": "ICT102", "title": "Copy", "term": "Term 4 2026"}
    assert client.post("/admin/courses", json=course, headers=school.admin).status_code == 409
