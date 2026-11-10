from datetime import UTC, datetime, timedelta


def test_announcements_pinned_first_and_on_the_dashboard(client, school):
    url = f"/courses/{school.course_id}/announcements"
    client.post(url, json={"title": "Lab moved", "body": "Room 3.12", "pinned": True}, headers=school.lecturer)
    client.post(url, json={"title": "Marks released", "body": "See Grades"}, headers=school.lecturer)

    listed = client.get(url, headers=school.student).json()
    assert [a["title"] for a in listed] == ["Lab moved", "Marks released"]
    assert listed[0]["author_name"] == "Dr. Maya Chen"

    due_at = (datetime.now(UTC) + timedelta(days=3)).isoformat()
    client.post(
        f"/courses/{school.course_id}/assignments", json={"title": "Report", "due_at": due_at}, headers=school.lecturer
    )
    dashboard = client.get("/me/dashboard", headers=school.student).json()
    assert [c["code"] for c in dashboard["courses"]] == ["ICT102"]
    assert [a["title"] for a in dashboard["upcoming"]] == ["Report"]
    assert {a["title"] for a in dashboard["announcements"]} == {"Lab moved", "Marks released"}


def test_students_cannot_post_or_delete_announcements(client, school):
    url = f"/courses/{school.course_id}/announcements"
    assert client.post(url, json={"title": "Hi", "body": "Hello"}, headers=school.student).status_code == 403
    posted = client.post(url, json={"title": "Hi", "body": "Hello"}, headers=school.lecturer).json()
    assert client.delete(f"{url}/{posted['id']}", headers=school.student).status_code == 403
    assert client.delete(f"{url}/{posted['id']}", headers=school.lecturer).status_code == 204
    assert client.get(url, headers=school.student).json() == []


def test_announcements_can_be_edited(client, school):
    url = f"/courses/{school.course_id}/announcements"
    posted = client.post(url, json={"title": "Lab moved", "body": "Room 3.12"}, headers=school.lecturer).json()
    edit = f"{url}/{posted['id']}"
    assert client.patch(edit, json={"body": "Room 4.01"}, headers=school.student).status_code == 403
    edited = client.patch(edit, json={"body": "Room 4.01", "pinned": True}, headers=school.lecturer).json()
    assert (edited["title"], edited["body"], edited["pinned"]) == ("Lab moved", "Room 4.01", True)
    assert edited["updated_at"] is not None
    assert client.patch(f"{url}/nope", json={"body": "x"}, headers=school.lecturer).status_code == 404


def test_scheduled_announcements_wait_until_their_time(client, school):
    url = f"/courses/{school.course_id}/announcements"
    later = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    scheduled = client.post(
        url, json={"title": "Exam tips", "body": "Coming soon", "publish_at": later}, headers=school.lecturer
    ).json()
    client.post(url, json={"title": "Welcome", "body": "Hi all"}, headers=school.lecturer)

    assert [a["title"] for a in client.get(url, headers=school.student).json()] == ["Welcome"]
    assert {a["title"] for a in client.get(url, headers=school.lecturer).json()} == {"Welcome", "Exam tips"}
    dashboard = client.get("/me/dashboard", headers=school.student).json()
    assert [a["title"] for a in dashboard["announcements"]] == ["Welcome"]

    # Publishing now (publish_at: null) makes it visible straight away.
    client.patch(f"{url}/{scheduled['id']}", json={"publish_at": None}, headers=school.lecturer)
    assert {a["title"] for a in client.get(url, headers=school.student).json()} == {"Welcome", "Exam tips"}


def test_health_check_needs_no_sign_in(client):
    assert client.get("/health").json() == {"status": "ok"}
