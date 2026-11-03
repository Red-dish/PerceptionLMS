import os

# Settings must exist before the app is imported.
os.environ.pop("AWS_ENDPOINT_URL", None)
os.environ.update(
    TABLE_NAME="lms-test",
    BUCKET_NAME="lms-test-files",
    GOOGLE_CLIENT_ID="test-client.apps.googleusercontent.com",
    JWT_SECRET="test-secret-that-is-at-least-32-characters-long",
    ADMIN_EMAILS="admin@example.edu",
    ALLOWED_ORIGINS="http://localhost:5173",
    AWS_DEFAULT_REGION="ap-southeast-2",
    AWS_ACCESS_KEY_ID="testing",
    AWS_SECRET_ACCESS_KEY="testing",
)

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from moto import mock_aws

from app import auth, db, storage
from app.config import get_settings
from app.main import app
from scripts.local_setup import create_resources
from tests.helpers import ADMIN_EMAIL, GOOGLE_KEY, sign_in


def _clear_caches():
    db.table.cache_clear()
    storage.s3.cache_clear()
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def aws(monkeypatch):
    """Fake DynamoDB, S3 and Google for every test."""
    monkeypatch.setattr(auth, "google_signing_key", lambda token: GOOGLE_KEY.public_key())
    _clear_caches()
    with mock_aws():
        create_resources("lms-test", "lms-test-files", ["http://localhost:5173"])
        yield
    _clear_caches()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def school(client):
    """An admin, a lecturer, an enrolled student, a student who is not enrolled, and one course."""
    admin = sign_in(client, ADMIN_EMAIL)

    def add_user(email, name, role):
        response = client.post("/admin/users", json={"email": email, "name": name, "role": role}, headers=admin)
        assert response.status_code == 201, response.text
        return response.json()

    lecturer = add_user("maya.chen@example.edu", "Dr. Maya Chen", "lecturer")
    student = add_user("jordan.lee@example.edu", "Jordan Lee", "student")
    outsider = add_user("sam.patel@example.edu", "Sam Patel", "student")

    course = client.post(
        "/admin/courses",
        json={"code": "ict102", "title": "Introduction to Programming", "term": "Term 4 2026"},
        headers=admin,
    ).json()
    for person, role in ((lecturer, "lecturer"), (student, "student")):
        response = client.put(f"/admin/courses/{course['id']}/members/{person['id']}", json={"role": role}, headers=admin)
        assert response.status_code == 200, response.text

    return SimpleNamespace(
        admin=admin,
        lecturer=sign_in(client, lecturer["email"]),
        student=sign_in(client, student["email"]),
        outsider=sign_in(client, outsider["email"]),
        course_id=course["id"],
        student_id=student["id"],
    )
