from datetime import UTC, datetime, timedelta


def make_assignment(client, school, *, due_in_days=7, max_mark=100):
    due_at = (datetime.now(UTC) + timedelta(days=due_in_days)).isoformat()
    response = client.post(
        f"/courses/{school.course_id}/assignments",
        json={"title": "Assignment 2: Control flow", "due_at": due_at, "weight": 20, "max_mark": max_mark},
        headers=school.lecturer,
    )
    assert response.status_code == 201, response.text
    return f"/courses/{school.course_id}/assignments/{response.json()['id']}"


def test_submit_grade_and_release(client, school):
    url = make_assignment(client, school)

    submitted = client.post(f"{url}/submission", json={"text": "print('hello')"}, headers=school.student)
    assert submitted.status_code == 201, submitted.text
    assert submitted.json()["submission"]["late"] is False
    assert submitted.json()["upload"] is None

    submissions = client.get(f"{url}/submissions", headers=school.lecturer).json()
    assert [s["student_name"] for s in submissions] == ["Jordan Lee"]

    # A saved but unreleased mark stays hidden from the student.
    grade_url = f"{url}/submissions/{school.student_id}/grade"
    client.put(grade_url, json={"mark": 78, "feedback": "Good start"}, headers=school.lecturer)
    mine = client.get(url, headers=school.student).json()["my_submission"]
    assert mine["mark"] is None and mine["feedback"] is None
    assert client.get("/me/grades", headers=school.student).json() == []

    client.put(grade_url, json={"mark": 78, "feedback": "Good start", "release": True}, headers=school.lecturer)
    grades = client.get("/me/grades", headers=school.student).json()
    assert [(g["course_code"], g["mark"], g["feedback"]) for g in grades] == [("ICT102", 78, "Good start")]

    # Released work cannot be resubmitted.
    again = client.post(f"{url}/submission", json={"text": "v2"}, headers=school.student)
    assert again.status_code == 409


def test_late_submissions_are_flagged(client, school):
    url = make_assignment(client, school, due_in_days=-1)
    response = client.post(f"{url}/submission", json={"text": "sorry"}, headers=school.student)
    assert response.json()["submission"]["late"] is True


def test_file_submissions_get_an_upload_form_and_a_download_link(client, school):
    url = make_assignment(client, school)
    response = client.post(
        f"{url}/submission",
        json={"file": {"file_name": "control-flow.zip", "content_type": "application/zip"}},
        headers=school.student,
    )
    assert response.status_code == 201, response.text
    assert response.json()["upload"]["fields"]["key"].endswith("/control-flow.zip")

    download = f"{url}/submissions/{school.student_id}/download"
    assert client.get(download, headers=school.lecturer).status_code == 200
    assert client.get(download, headers=school.student).status_code == 200
    assert client.get(download, headers=school.outsider).status_code == 404


def test_submissions_need_text_or_a_file(client, school):
    url = make_assignment(client, school)
    assert client.post(f"{url}/submission", json={"text": "   "}, headers=school.student).status_code == 422


def test_marks_cannot_exceed_the_maximum(client, school):
    url = make_assignment(client, school, max_mark=20)
    client.post(f"{url}/submission", json={"text": "done"}, headers=school.student)
    response = client.put(f"{url}/submissions/{school.student_id}/grade", json={"mark": 21}, headers=school.lecturer)
    assert response.status_code == 422


def test_only_lecturers_see_all_submissions_and_only_students_submit(client, school):
    url = make_assignment(client, school)
    assert client.get(f"{url}/submissions", headers=school.student).status_code == 403
    assert client.post(f"{url}/submission", json={"text": "x"}, headers=school.lecturer).status_code == 403
    assert client.post(f"{url}/submission", json={"text": "x"}, headers=school.outsider).status_code == 404


def test_assignment_times_are_stored_in_utc(client, school):
    response = client.post(
        f"/courses/{school.course_id}/assignments",
        json={"title": "Quiz", "due_at": "2026-11-13T23:59:00+11:00"},
        headers=school.lecturer,
    )
    assert response.json()["due_at"] == "2026-11-13T12:59:00Z"
