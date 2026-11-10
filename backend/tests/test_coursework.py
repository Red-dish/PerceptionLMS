"""Assignment settings, resubmissions, late and missing work, and the gradebook."""

from datetime import UTC, datetime, timedelta


def days(n):
    return (datetime.now(UTC) + timedelta(days=n)).isoformat()


def create(client, school, **fields):
    body = {"title": "Lab report", "due_at": days(7), "max_mark": 20, "weight": 10, **fields}
    response = client.post(f"/courses/{school.course_id}/assignments", json=body, headers=school.lecturer)
    assert response.status_code == 201, response.text
    return f"/courses/{school.course_id}/assignments/{response.json()['id']}", response.json()


def titles(client, school, who):
    return [a["title"] for a in client.get(f"/courses/{school.course_id}/assignments", headers=who).json()]


# Assignment creation (#41)
def test_teacher_sets_points_submission_type_and_window(client, school):
    _, assignment = create(
        client,
        school,
        kind="quiz",
        instructions="## Task\nAnswer **all** questions.",
        submission_type="text",
        available_from=days(-1),
        available_until=days(9),
    )
    assert assignment["kind"] == "quiz"
    assert assignment["max_mark"] == 20
    assert assignment["submission_type"] == "text"
    assert assignment["published"] is True


def test_window_must_make_sense(client, school):
    url = f"/courses/{school.course_id}/assignments"
    bad = {"title": "X", "due_at": days(5), "available_until": days(4)}
    assert client.post(url, json=bad, headers=school.lecturer).status_code == 422
    bad = {"title": "X", "due_at": days(5), "available_from": days(6)}
    assert client.post(url, json=bad, headers=school.lecturer).status_code == 422

    assignment_url, _ = create(client, school, available_until=days(8))
    response = client.patch(assignment_url, json={"available_until": days(7.5)}, headers=school.lecturer)
    assert response.status_code == 200
    # Moving the due date past the close date is refused; clearing the close date works.
    assert client.patch(assignment_url, json={"due_at": days(8)}, headers=school.lecturer).status_code == 422
    cleared = client.patch(assignment_url, json={"available_until": None, "due_at": days(10)}, headers=school.lecturer)
    assert cleared.status_code == 200 and cleared.json()["available_until"] is None


def test_students_only_see_published_work_that_has_opened(client, school):
    create(client, school, title="Open now")
    create(client, school, title="Opens next week", available_from=days(6), due_at=days(9))
    hidden_url, _ = create(client, school, title="Draft", published=False)

    assert set(titles(client, school, school.student)) == {"Open now"}
    assert set(titles(client, school, school.lecturer)) == {"Open now", "Opens next week", "Draft"}
    assert client.get(hidden_url, headers=school.student).status_code == 404
    assert client.post(f"{hidden_url}/submission", json={"text": "x"}, headers=school.student).status_code == 404
    dashboard = client.get("/me/dashboard", headers=school.student).json()
    assert [a["title"] for a in dashboard["upcoming"]] == ["Open now"]

    client.patch(hidden_url, json={"published": True}, headers=school.lecturer)
    assert "Draft" in titles(client, school, school.student)


def test_assignments_can_be_added_to_a_module(client, school):
    module = client.post(f"/courses/{school.course_id}/modules", json={"title": "Week 3"}, headers=school.lecturer)
    _, assignment = create(client, school, module_id=module.json()["id"])
    assert assignment["module_id"] == module.json()["id"]
    url = f"/courses/{school.course_id}/assignments"
    bad = {"title": "X", "due_at": days(3), "module_id": "nope"}
    assert client.post(url, json=bad, headers=school.lecturer).status_code == 422


def test_submission_type_is_enforced(client, school):
    file_only, _ = create(client, school, submission_type="file")
    text_only, _ = create(client, school, submission_type="text")
    offline, _ = create(client, school, submission_type="none")
    a_file = {"file": {"file_name": "report.pdf", "content_type": "application/pdf"}}

    assert client.post(f"{file_only}/submission", json={"text": "hi"}, headers=school.student).status_code == 422
    assert client.post(f"{file_only}/submission", json=a_file, headers=school.student).status_code == 201
    assert client.post(f"{text_only}/submission", json=a_file, headers=school.student).status_code == 422
    assert client.post(f"{text_only}/submission", json={"text": "hi"}, headers=school.student).status_code == 201
    assert client.post(f"{offline}/submission", json={"text": "hi"}, headers=school.student).status_code == 403
    bad_type = {"file": {"file_name": "virus.exe"}}
    assert client.post(f"{file_only}/submission", json=bad_type, headers=school.student).status_code == 422


def test_closed_assignments_refuse_submissions(client, school):
    url, _ = create(client, school, due_at=days(-3), available_from=days(-10), available_until=days(-1))
    response = client.post(f"{url}/submission", json={"text": "late"}, headers=school.student)
    assert response.status_code == 403
    view = client.get(url, headers=school.student).json()
    assert view["accepting_submissions"] is False


def test_assignment_can_be_deleted_with_its_submissions(client, school):
    url, _ = create(client, school)
    client.post(f"{url}/submission", json={"text": "done"}, headers=school.student)
    assert client.delete(url, headers=school.student).status_code == 403
    assert client.delete(url, headers=school.lecturer).status_code == 204
    assert client.get(url, headers=school.lecturer).status_code == 404
    assert client.get("/me/grades", headers=school.student).json() == []


# Late, missing and resubmission (#43)
def test_every_attempt_is_kept(client, school):
    url, _ = create(client, school)
    first = {"file": {"file_name": "v1.pdf", "content_type": "application/pdf"}}
    client.post(f"{url}/submission", json=first, headers=school.student)
    second = client.post(f"{url}/submission", json={"text": "v2"}, headers=school.student).json()["submission"]
    assert second["attempt"] == 2
    assert [(a["attempt"], a["file_name"]) for a in second["history"]] == [(1, "v1.pdf")]
    old = f"{url}/submissions/{school.student_id}/attempts/1/download"
    assert client.get(old, headers=school.lecturer).status_code == 200
    assert client.get(old, headers=school.student).status_code == 200
    assert client.get(old, headers=school.outsider).status_code == 404


def test_attempt_limit(client, school):
    url, _ = create(client, school, max_attempts=2)
    for _ in range(2):
        assert client.post(f"{url}/submission", json={"text": "x"}, headers=school.student).status_code == 201
    third = client.post(f"{url}/submission", json={"text": "x"}, headers=school.student)
    assert third.status_code == 409 and "2 attempts" in third.json()["detail"]


def test_resubmission_after_marking_needs_permission(client, school):
    url, _ = create(client, school)
    client.post(f"{url}/submission", json={"text": "v1"}, headers=school.student)
    grade = f"{url}/submissions/{school.student_id}/grade"
    client.put(grade, json={"mark": 8, "feedback": "Redo part 2", "release": True}, headers=school.lecturer)
    assert client.post(f"{url}/submission", json={"text": "v2"}, headers=school.student).status_code == 409

    grant_url = f"{url}/submissions/{school.student_id}/resubmission"
    assert client.put(grant_url, json={}, headers=school.student).status_code == 403
    granted = client.put(grant_url, json={"note": "Fix part 2"}, headers=school.lecturer)
    assert granted.status_code == 200 and granted.json()["granted_by"] == "Dr. Maya Chen"
    assert client.get(url, headers=school.student).json()["my_grant"]["note"] == "Fix part 2"

    again = client.post(f"{url}/submission", json={"text": "v2"}, headers=school.student)
    assert again.status_code == 201
    submission = again.json()["submission"]
    assert submission["mark"] is None and submission["released"] is False
    assert [(a["attempt"], a["mark"], a["feedback"]) for a in submission["history"]] == [(1, 8, "Redo part 2")]
    # The permission was used up.
    assert client.get(f"{url}/resubmissions", headers=school.lecturer).json() == []
    client.put(grade, json={"mark": 18, "release": True}, headers=school.lecturer)
    assert client.post(f"{url}/submission", json={"text": "v3"}, headers=school.student).status_code == 409


def test_extension_reopens_a_closed_assignment_and_counts_as_on_time(client, school):
    url, _ = create(client, school, due_at=days(-3), available_from=days(-10), available_until=days(-1))
    grant_url = f"{url}/submissions/{school.student_id}/resubmission"
    client.put(grant_url, json={"until": days(2), "note": "Medical certificate"}, headers=school.lecturer)
    response = client.post(f"{url}/submission", json={"text": "here"}, headers=school.student)
    assert response.status_code == 201
    assert response.json()["submission"]["late"] is False

    assert client.delete(grant_url, headers=school.lecturer).status_code == 204
    assert client.post(f"{url}/submission", json={"text": "again"}, headers=school.student).status_code == 403


def test_late_penalty_is_applied_per_day(client, school):
    url, _ = create(client, school, due_at=days(-1.95), late_penalty_percent=10)
    submitted = client.post(f"{url}/submission", json={"text": "late"}, headers=school.student).json()["submission"]
    assert submitted["late"] is True and submitted["days_late"] == 2
    graded = client.put(
        f"{url}/submissions/{school.student_id}/grade", json={"mark": 20, "release": True}, headers=school.lecturer
    ).json()
    assert (graded["mark"], graded["final_mark"]) == (20, 16)
    assert client.get("/me/grades", headers=school.student).json()[0]["final_mark"] == 16


def test_late_and_missing_report(client, school):
    missing_url, _ = create(client, school, title="Missed", due_at=days(-3.95))
    late_url, _ = create(client, school, title="Handed in late", due_at=days(-0.95))
    on_time_url, _ = create(client, school, title="Fine")
    client.post(f"{late_url}/submission", json={"text": "sorry"}, headers=school.student)
    client.post(f"{on_time_url}/submission", json={"text": "done"}, headers=school.student)

    url = f"/courses/{school.course_id}/late-missing"
    report = client.get(url, headers=school.lecturer).json()
    assert (report["missing"], report["late"]) == (1, 1)
    assert [(i["assignment_title"], i["status"], i["days_late"]) for i in report["items"]] == [
        ("Missed", "missing", 4),
        ("Handed in late", "late", 1),
    ]
    assert client.get(url, params={"status": "missing"}, headers=school.lecturer).json()["late"] == 0
    assert client.get(url, headers=school.student).status_code == 403

    everything = client.get("/admin/late-missing", headers=school.admin).json()
    assert everything["missing"] == 1 and everything["items"][0]["course_code"] == "ICT102"
    assert client.get("/admin/late-missing", headers=school.lecturer).status_code == 403

    # An extension takes the work off the missing list until it runs out.
    client.put(
        f"{missing_url}/submissions/{school.student_id}/resubmission", json={"until": days(3)}, headers=school.lecturer
    )
    assert client.get(url, headers=school.lecturer).json()["missing"] == 0


# Gradebook (#49)
def test_gradebook_grid_totals_and_inline_editing(client, school):
    essay_url, essay = create(client, school, title="Essay", max_mark=20, weight=30, due_at=days(-5))
    quiz_url, quiz = create(client, school, kind="quiz", title="Quiz 1", max_mark=10, weight=10, due_at=days(-3))
    _, later = create(client, school, title="Project", max_mark=50, weight=60, due_at=days(10))
    client.post(f"{essay_url}/submission", json={"text": "essay"}, headers=school.student)
    client.put(f"{essay_url}/submissions/{school.student_id}/grade", json={"mark": 15}, headers=school.lecturer)

    url = f"/courses/{school.course_id}/gradebook"
    assert client.get(url, headers=school.student).status_code == 403
    book = client.get(url, headers=school.lecturer).json()
    assert [c["title"] for c in book["columns"]] == ["Essay", "Quiz 1", "Project"]
    [row] = book["rows"]
    assert row["name"] == "Jordan Lee"
    assert row["cells"][essay["id"]]["status"] == "graded" and row["cells"][essay["id"]]["late"] is True
    assert row["cells"][quiz["id"]]["status"] == "missing"
    assert row["cells"][later["id"]]["status"] == "upcoming"
    assert (row["points_earned"], row["points_possible"], row["percent"]) == (15, 20, 75.0)
    assert row["missing"] == 1

    # Inline edit: mark a quiz the student sat in class, with no online submission.
    cell = f"{quiz_url}/submissions/{school.student_id}/grade"
    assert client.put(cell, json={"mark": 9}, headers=school.lecturer).status_code == 200
    row = client.get(url, headers=school.lecturer).json()["rows"][0]
    assert row["cells"][quiz["id"]]["mark"] == 9 and row["missing"] == 0
    assert (row["points_earned"], row["points_possible"]) == (24, 30)
    # Essay 75% at weight 30, quiz 90% at weight 10: (22.5 + 9) / 40.
    assert row["weighted_percent"] == 78.8

    # Clearing a cell with no submission removes it entirely.
    assert client.delete(cell, headers=school.lecturer).status_code == 204
    row = client.get(url, headers=school.lecturer).json()["rows"][0]
    assert row["cells"][quiz["id"]]["status"] == "missing"
    # Clearing a submitted cell keeps the submission.
    client.delete(f"{essay_url}/submissions/{school.student_id}/grade", headers=school.lecturer)
    row = client.get(url, headers=school.lecturer).json()["rows"][0]
    assert row["cells"][essay["id"]]["status"] == "submitted"

    # Only enrolled students can be graded.
    outsider_cell = f"{quiz_url}/submissions/nobody/grade"
    assert client.put(outsider_cell, json={"mark": 5}, headers=school.lecturer).status_code == 404


def test_release_all_marks_and_csv_export(client, school):
    url, _ = create(client, school, title="Essay", max_mark=20)
    client.post(f"{url}/submission", json={"text": "x"}, headers=school.student)
    client.put(f"{url}/submissions/{school.student_id}/grade", json={"mark": 17}, headers=school.lecturer)
    assert client.get("/me/grades", headers=school.student).json() == []
    assert client.post(f"{url}/release", json={"release": True}, headers=school.lecturer).json() == {"updated": 1}
    assert [g["mark"] for g in client.get("/me/grades", headers=school.student).json()] == [17]

    csv = client.get(f"/courses/{school.course_id}/gradebook.csv", headers=school.lecturer)
    assert csv.status_code == 200
    assert csv.headers["content-type"].startswith("text/csv")
    assert 'filename="ICT102-gradebook.csv"' in csv.headers["content-disposition"]
    lines = csv.text.strip().splitlines()
    assert lines[0].startswith('Student,Email,"Essay (/20, 10%)",Points')
    assert lines[1].startswith("Jordan Lee,jordan.lee@example.edu,17,17,20,85.0")
