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


def test_health_check_needs_no_sign_in(client):
    assert client.get("/health").json() == {"status": "ok"}
