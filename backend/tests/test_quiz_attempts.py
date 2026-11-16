"""Quizzes: taking a quiz and automatic marking (#48)."""

from datetime import UTC, datetime, timedelta

import pytest

from app import coursework
from tests.test_quizzes import MULTIPLE_CHOICE, SHORT_ANSWER, TRUE_FALSE, add, days, make_quiz

PICK_TWO = {
    "type": "multiple_choice",
    "text": "Which are comparison operators?",
    "points": 2,
    "options": [{"text": "==", "correct": True}, {"text": "=", "correct": False}, {"text": "<=", "correct": True}],
}
EXPLAIN = {"type": "short_answer", "text": "When would you use a while loop?", "points": 4}


@pytest.fixture
def clock(monkeypatch):
    """Move time forward with clock.skip(minutes=...)."""

    class Clock:
        offset = timedelta()

        def skip(self, **amount):
            self.offset += timedelta(**amount)

    fake = Clock()
    monkeypatch.setattr(coursework, "now", lambda: datetime.now(UTC) + fake.offset)
    return fake


def build(client, school, questions, **settings):
    url, quiz = make_quiz(client, school, **settings)
    made = [add(client, school, url, question) for question in questions]
    return url, quiz, made


def right(question):
    return [option["id"] for option in question["options"] if option["correct"]]


def wrong(question):
    return [next(option["id"] for option in question["options"] if not option["correct"])]


def start(client, school, url, expected=201):
    response = client.post(f"{url}/attempts", headers=school.student)
    assert response.status_code == expected, response.text
    return response.json()


def gradebook_cell(client, school, quiz_id):
    book = client.get(f"/courses/{school.course_id}/gradebook", headers=school.lecturer).json()
    return book["rows"][0]["cells"][quiz_id]


def test_quiz_is_marked_automatically_and_short_answers_go_to_the_lecturer(client, school):
    url, quiz, (mc, multi, tf, sa, explain) = build(
        client, school, [MULTIPLE_CHOICE, PICK_TWO, TRUE_FALSE, SHORT_ANSWER, EXPLAIN]
    )
    attempt = start(client, school, url)
    assert attempt["status"] == "in_progress" and attempt["max_score"] == 2 + 2 + 1 + 3 + 4
    # Students never see the right answers while taking the quiz.
    shown = {q["id"]: q for q in attempt["questions"]}
    assert all(option["correct"] is None for option in shown[mc["id"]]["options"])
    assert shown[tf["id"]]["answer"] is None and shown[sa["id"]]["accepted_answers"] is None

    attempt_url = f"{url}/attempts/{attempt['id']}"
    saved = client.put(f"{attempt_url}/answers", json={"answers": {mc["id"]: right(mc)}}, headers=school.student)
    assert saved.status_code == 200 and saved.json()["answers"] == {mc["id"]: right(mc)}
    answers = {
        multi["id"]: right(multi)[:1],  # only one of the two right options: no points
        tf["id"]: False,
        sa["id"]: "  CONTINUE ",  # case and spacing are ignored
        explain["id"]: "When I don't know how many times it should run.",
    }
    done = client.post(f"{attempt_url}/submit", json={"answers": answers}, headers=school.student)
    assert done.status_code == 200, done.text
    result = done.json()
    assert (result["status"], result["needs_marking"], result["score"]) == ("submitted", 1, None)
    assert result["results"][mc["id"]] == {"points": 2, "max_points": 2, "correct": True, "needs_marking": False}
    assert result["results"][multi["id"]]["points"] == 0
    assert result["results"][tf["id"]]["correct"] is True
    assert result["results"][sa["id"]]["points"] == 3
    assert result["results"][explain["id"]] == {"points": 0, "max_points": 4, "correct": None, "needs_marking": True}
    assert gradebook_cell(client, school, quiz["id"])["status"] == "submitted"
    # Submitting again is refused.
    assert client.post(f"{attempt_url}/submit", json={}, headers=school.student).status_code == 409

    # The lecturer marks the short answer; the score then reaches the gradebook and the student.
    waiting = client.get(f"{url}/attempts", params={"needs_marking": True}, headers=school.lecturer).json()
    assert [a["id"] for a in waiting] == [attempt["id"]]
    assert client.put(f"{attempt_url}/marks", json={"marks": {explain["id"]: 5}}, headers=school.lecturer).status_code == 422
    assert client.put(f"{attempt_url}/marks", json={"marks": {explain["id"]: 3}}, headers=school.student).status_code == 403
    marked = client.put(f"{attempt_url}/marks", json={"marks": {explain["id"]: 3}}, headers=school.lecturer)
    assert marked.status_code == 200, marked.text
    assert (marked.json()["status"], marked.json()["score"]) == ("graded", 2 + 0 + 1 + 3 + 3)
    cell = gradebook_cell(client, school, quiz["id"])
    assert (cell["status"], cell["mark"], cell["released"]) == ("graded", 9, True)
    grades = client.get("/me/grades", headers=school.student).json()
    assert [(g["assignment_title"], g["mark"], g["max_mark"]) for g in grades] == [("Week 4 quiz", 9, 12)]
    assert client.get(f"{url}/attempts", params={"needs_marking": True}, headers=school.lecturer).json() == []


def test_students_see_their_score_straight_away_and_right_answers_if_allowed(client, school):
    url, _, (mc, tf) = build(client, school, [MULTIPLE_CHOICE, TRUE_FALSE], show_correct_answers=True)
    attempt = start(client, school, url)
    answers = {mc["id"]: wrong(mc), tf["id"]: False}
    result = client.post(f"{url}/attempts/{attempt['id']}/submit", json={"answers": answers}, headers=school.student)
    assert (result.json()["status"], result.json()["score"]) == ("graded", 1)
    shown = {q["id"]: q for q in result.json()["questions"]}
    assert [o["correct"] for o in shown[mc["id"]]["options"]] == [True, False, False]
    assert shown[tf["id"]]["answer"] is False

    # Without show_correct_answers the score is shown but not the answers.
    url2, _, (tf2,) = build(client, school, [TRUE_FALSE], title="Quiz 2")
    attempt = start(client, school, url2)
    result = client.post(
        f"{url2}/attempts/{attempt['id']}/submit", json={"answers": {tf2["id"]: True}}, headers=school.student
    ).json()
    assert result["score"] == 0 and result["questions"][0]["answer"] is None


def test_scores_can_be_held_back_until_the_lecturer_releases_them(client, school):
    url, quiz, (tf,) = build(client, school, [TRUE_FALSE], show_score=False)
    attempt = start(client, school, url)
    result = client.post(
        f"{url}/attempts/{attempt['id']}/submit", json={"answers": {tf["id"]: False}}, headers=school.student
    ).json()
    assert (result["status"], result["score"], result["results"]) == ("graded", None, None)
    assert client.get("/me/grades", headers=school.student).json() == []
    lecturer_view = client.get(f"{url}/attempts/{attempt['id']}", headers=school.lecturer).json()
    assert lecturer_view["score"] == 1

    release = f"/courses/{school.course_id}/assignments/{quiz['id']}/release"
    assert client.post(release, json={"release": True}, headers=school.lecturer).json() == {"updated": 1}
    assert client.get(f"{url}/attempts/{attempt['id']}", headers=school.student).json()["score"] == 1


def test_the_time_limit_is_enforced_by_the_server(client, school, clock):
    url, quiz, (mc, tf) = build(client, school, [MULTIPLE_CHOICE, TRUE_FALSE], time_limit_minutes=10)
    attempt = start(client, school, url)
    assert 590 <= attempt["seconds_left"] <= 600
    attempt_url = f"{url}/attempts/{attempt['id']}"
    client.put(f"{attempt_url}/answers", json={"answers": {mc["id"]: right(mc)}}, headers=school.student)

    # Closing the page doesn't stop the clock: starting again resumes the same attempt.
    clock.skip(minutes=4)
    resumed = start(client, school, url, expected=200)
    assert resumed["id"] == attempt["id"] and resumed["answers"] == {mc["id"]: right(mc)}
    assert 350 <= resumed["seconds_left"] <= 360

    # After the time limit (and a short grace period), new answers are refused and the
    # answers saved in time are submitted.
    clock.skip(minutes=7)
    late_save = client.put(f"{attempt_url}/answers", json={"answers": {tf["id"]: False}}, headers=school.student)
    assert late_save.status_code == 409
    result = client.get(attempt_url, headers=school.student).json()
    assert (result["status"], result["auto_submitted"], result["score"]) == ("graded", True, 2)
    assert result["submitted_at"] == attempt["deadline"]


def test_a_student_who_leaves_still_gets_their_saved_answers_marked(client, school, clock):
    url, quiz, (tf,) = build(client, school, [TRUE_FALSE], time_limit_minutes=5)
    attempt = start(client, school, url)
    client.put(f"{url}/attempts/{attempt['id']}/answers", json={"answers": {tf["id"]: False}}, headers=school.student)
    clock.skip(minutes=6)
    # The gradebook submits attempts whose time ran out.
    cell = gradebook_cell(client, school, quiz["id"])
    assert (cell["status"], cell["mark"]) == ("graded", 1)
    # Submitting late only counts what was saved in time.
    response = client.post(
        f"{url}/attempts/{attempt['id']}/submit", json={"answers": {tf["id"]: True}}, headers=school.student
    )
    assert response.status_code == 409


def test_attempt_limits_best_score_and_extra_attempts(client, school):
    url, quiz, (mc, tf) = build(client, school, [MULTIPLE_CHOICE, TRUE_FALSE], max_attempts=2)

    def take(answers):
        attempt = start(client, school, url)
        response = client.post(f"{url}/attempts/{attempt['id']}/submit", json={"answers": answers}, headers=school.student)
        return response.json()

    assert take({mc["id"]: right(mc), tf["id"]: False})["score"] == 3
    assert client.get(url, headers=school.student).json()["attempts_left"] == 1
    assert take({mc["id"]: wrong(mc)})["score"] == 0
    view = client.get(url, headers=school.student).json()
    assert (view["attempts_left"], view["can_start"], len(view["my_attempts"])) == (0, False, 2)
    assert client.post(f"{url}/attempts", headers=school.student).status_code == 409
    # The best score counts, not the latest.
    assert gradebook_cell(client, school, quiz["id"])["mark"] == 3

    # A resubmission grant allows one more attempt, then is used up.
    grant = f"/courses/{school.course_id}/assignments/{quiz['id']}/submissions/{school.student_id}/resubmission"
    assert client.put(grant, json={"note": "Missed class"}, headers=school.lecturer).status_code == 200
    assert client.get(url, headers=school.student).json()["can_start"] is True
    take({mc["id"]: right(mc), tf["id"]: False})
    assert client.post(f"{url}/attempts", headers=school.student).status_code == 409


def test_late_quizzes_are_flagged(client, school):
    url, quiz, (tf,) = build(client, school, [TRUE_FALSE], due_at=days(-2.5))
    attempt = start(client, school, url)
    result = client.post(
        f"{url}/attempts/{attempt['id']}/submit", json={"answers": {tf["id"]: False}}, headers=school.student
    ).json()
    assert (result["late"], result["days_late"]) == (True, 3)
    report = client.get(f"/courses/{school.course_id}/late-missing", headers=school.lecturer).json()
    assert [(i["assignment_title"], i["status"]) for i in report["items"]] == [("Week 4 quiz", "late")]


def test_quiz_rules_and_privacy(client, school):
    url, quiz, (mc, tf) = build(client, school, [MULTIPLE_CHOICE, TRUE_FALSE])
    empty_url, _ = make_quiz(client, school, title="Empty")
    assert client.post(f"{empty_url}/attempts", headers=school.student).status_code == 409
    assert client.post(f"{url}/attempts", headers=school.lecturer).status_code == 403
    assert client.post(f"{url}/attempts", headers=school.outsider).status_code == 404
    # Quizzes with questions are taken through attempts, not the file/text submission.
    submission = f"/courses/{school.course_id}/assignments/{quiz['id']}/submission"
    assert client.post(submission, json={"text": "hi"}, headers=school.student).status_code == 409

    attempt = start(client, school, url)
    attempt_url = f"{url}/attempts/{attempt['id']}"
    bad_answers = [
        {mc["id"]: "not a list"},
        {mc["id"]: ["no-such-option"]},
        {tf["id"]: "true"},
        {"no-such-question": True},
    ]
    for answers in bad_answers:
        assert client.put(f"{attempt_url}/answers", json={"answers": answers}, headers=school.student).status_code == 422
    # The lecturer can't mark an attempt that's still in progress.
    assert client.put(f"{attempt_url}/marks", json={"marks": {}}, headers=school.lecturer).status_code == 409

    # Once students have started, questions are locked apart from their wording.
    question_url = f"{url}/questions/{tf['id']}"
    assert client.patch(question_url, json={"answer": True}, headers=school.lecturer).status_code == 409
    assert client.post(f"{url}/questions", json=TRUE_FALSE, headers=school.lecturer).status_code == 409
    assert client.delete(question_url, headers=school.lecturer).status_code == 409
    assert client.patch(question_url, json={"text": "Fixed typo"}, headers=school.lecturer).status_code == 200

    # Lecturers see every attempt; students only their own.
    assert len(client.get(f"{url}/attempts", headers=school.lecturer).json()) == 1
    assert client.get(attempt_url, headers=school.lecturer).status_code == 200
    classmate = client.post(
        "/admin/users", json={"email": "ali@example.edu", "name": "Ali Khan", "role": "student"}, headers=school.admin
    ).json()
    client.put(f"/admin/courses/{school.course_id}/members/{classmate['id']}", json={"role": "student"}, headers=school.admin)
    from tests.helpers import sign_in

    ali = sign_in(client, "ali@example.edu")
    assert client.get(attempt_url, headers=ali).status_code == 404
    assert client.get(f"{url}/attempts", headers=ali).json() == []
