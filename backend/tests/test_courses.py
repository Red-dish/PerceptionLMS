from app import storage
from app.config import get_settings


def test_students_see_only_their_enrolled_courses(client, school):
    mine = client.get("/courses", headers=school.student).json()
    assert [course["code"] for course in mine] == ["ICT102"]
    assert mine[0]["my_role"] == "student"
    assert client.get("/courses", headers=school.outsider).json() == []
    assert client.get(f"/courses/{school.course_id}", headers=school.outsider).status_code == 404


def test_students_cannot_change_course_content(client, school):
    response = client.post(f"/courses/{school.course_id}/modules", json={"title": "Sneaky"}, headers=school.student)
    assert response.status_code == 403


def test_students_only_see_published_modules(client, school):
    course_url = f"/courses/{school.course_id}"
    module = client.post(f"{course_url}/modules", json={"title": "Module 1 · Getting started"}, headers=school.lecturer).json()
    assert client.get(course_url, headers=school.student).json()["modules"] == []
    assert len(client.get(course_url, headers=school.lecturer).json()["modules"]) == 1

    client.patch(f"{course_url}/modules/{module['id']}", json={"published": True}, headers=school.lecturer)
    modules = client.get(course_url, headers=school.student).json()["modules"]
    assert [m["title"] for m in modules] == ["Module 1 · Getting started"]


def test_material_upload_and_download(client, school):
    course_url = f"/courses/{school.course_id}"
    module = client.post(f"{course_url}/modules", json={"title": "Week 1"}, headers=school.lecturer).json()
    created = client.post(
        f"{course_url}/modules/{module['id']}/materials",
        json={"title": "Lecture slides", "file_name": "../Week 1 slides.pdf", "content_type": "application/pdf"},
        headers=school.lecturer,
    )
    assert created.status_code == 201, created.text
    material, upload = created.json()["material"], created.json()["upload"]
    assert material["file_name"] == "Week 1 slides.pdf"
    assert upload["fields"]["Content-Type"] == "application/pdf"

    # The browser would POST the file to upload["url"]; here we put it in the fake bucket directly.
    storage.s3().put_object(Bucket=get_settings().bucket_name, Key=upload["fields"]["key"], Body=b"%PDF")
    download_url = f"{course_url}/modules/{module['id']}/materials/{material['id']}/download"

    # Hidden from students until the module is published.
    assert client.get(download_url, headers=school.student).status_code == 404
    client.patch(f"{course_url}/modules/{module['id']}", json={"published": True}, headers=school.lecturer)
    link = client.get(download_url, headers=school.student)
    assert link.status_code == 200
    assert "Week%201%20slides.pdf" in link.json()["url"]

    detail = client.get(course_url, headers=school.student).json()
    assert [m["title"] for m in detail["modules"][0]["materials"]] == ["Lecture slides"]


def test_deleting_a_module_removes_its_materials(client, school):
    course_url = f"/courses/{school.course_id}"
    module = client.post(f"{course_url}/modules", json={"title": "Old"}, headers=school.lecturer).json()
    client.post(
        f"{course_url}/modules/{module['id']}/materials",
        json={"title": "Notes", "file_name": "notes.txt", "content_type": "text/plain"},
        headers=school.lecturer,
    )
    assert client.delete(f"{course_url}/modules/{module['id']}", headers=school.lecturer).status_code == 204
    assert client.get(course_url, headers=school.lecturer).json()["modules"] == []


def test_admin_can_list_and_remove_course_members(client, school):
    members_url = f"/admin/courses/{school.course_id}/members"
    assert {m["role"] for m in client.get(members_url, headers=school.admin).json()} == {"lecturer", "student"}
    client.delete(f"{members_url}/{school.student_id}", headers=school.admin)
    assert client.get("/courses", headers=school.student).json() == []
