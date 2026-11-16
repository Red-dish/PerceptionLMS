"""Quizzes: the builder (#47)."""

from datetime import UTC, datetime, timedelta


def days(n):
    return (datetime.now(UTC) + timedelta(days=n)).isoformat()


def make_quiz(client, school, **settings):
    body = {"kind": "quiz", "title": "Week 4 quiz", "due_at": days(3), "weight": 15, **settings}
    response = client.post(f"/courses/{school.course_id}/assignments", json=body, headers=school.lecturer)
    assert response.status_code == 201, response.text
    return f"/courses/{school.course_id}/quizzes/{response.json()['id']}", response.json()


MULTIPLE_CHOICE = {
    "type": "multiple_choice",
    "text": "How many times does `for i in range(2, 8, 2)` run?",
    "points": 2,
    "options": [{"text": "3", "correct": True}, {"text": "4"}, {"text": "6"}],
}
TRUE_FALSE = {"type": "true_false", "text": "A while loop always runs at least once.", "answer": False}
SHORT_ANSWER = {
    "type": "short_answer",
    "text": "Which keyword skips to the next loop iteration?",
    "points": 3,
    "accepted_answers": ["continue"],
}


def add(client, school, url, question):
    response = client.post(f"{url}/questions", json=question, headers=school.lecturer)
    assert response.status_code == 201, response.text
    return response.json()


def test_teacher_builds_a_quiz_with_each_question_type(client, school):
    url, quiz = make_quiz(
        client, school, time_limit_minutes=20, max_attempts=2, shuffle_answers=True, show_correct_answers=True
    )
    assert (quiz["time_limit_minutes"], quiz["max_attempts"], quiz["shuffle_answers"]) == (20, 2, True)
    assert quiz["show_score"] is True

    mc = add(client, school, url, MULTIPLE_CHOICE)
    assert [o["text"] for o in mc["options"]] == ["3", "4", "6"]
    assert [o["correct"] for o in mc["options"]] == [True, False, False]
    assert all(o["id"] for o in mc["options"])
    tf = add(client, school, url, TRUE_FALSE)
    assert (tf["answer"], tf["points"]) == (False, 1)
    sa = add(client, school, url, SHORT_ANSWER)
    assert sa["accepted_answers"] == ["continue"]
    assert add(client, school, url, {"type": "short_answer", "text": "Explain why."})["accepted_answers"] == []

    view = client.get(url, headers=school.lecturer).json()
    assert view["question_count"] == 4
    assert [q["type"] for q in view["questions"]] == ["multiple_choice", "true_false", "short_answer", "short_answer"]
    # The quiz is worth the total of its questions' points, so the gradebook uses that.
    assert view["max_mark"] == 2 + 1 + 3 + 1
    gradebook = client.get(f"/courses/{school.course_id}/gradebook", headers=school.lecturer).json()
    assert [(c["kind"], c["max_mark"]) for c in gradebook["columns"]] == [("quiz", 7)]


def test_students_see_the_quiz_but_not_its_questions_or_answers(client, school):
    url, _ = make_quiz(client, school)
    add(client, school, url, MULTIPLE_CHOICE)
    view = client.get(url, headers=school.student).json()
    assert view["question_count"] == 1
    assert view["questions"] is None
    assert client.get(f"{url}/questions", headers=school.student).status_code == 403
    assert client.post(f"{url}/questions", json=TRUE_FALSE, headers=school.student).status_code == 403
    assert client.get(url, headers=school.outsider).status_code == 404


def test_questions_must_fit_their_type(client, school):
    url, _ = make_quiz(client, school)
    bad = [
        {"type": "multiple_choice", "text": "Q", "options": [{"text": "Only one", "correct": True}]},
        {"type": "multiple_choice", "text": "Q", "options": [{"text": "A"}, {"text": "B"}]},
        {"type": "true_false", "text": "Q"},
        {"type": "true_false", "text": "Q", "answer": True, "options": [{"text": "A"}, {"text": "B", "correct": True}]},
        {"type": "short_answer", "text": "Q", "answer": True},
        {"type": "essay", "text": "Q"},
        {**TRUE_FALSE, "points": 101},
    ]
    for question in bad:
        assert client.post(f"{url}/questions", json=question, headers=school.lecturer).status_code == 422, question
    # Only quizzes have questions.
    assignment = client.post(
        f"/courses/{school.course_id}/assignments", json={"title": "Essay", "due_at": days(3)}, headers=school.lecturer
    ).json()
    not_a_quiz = f"/courses/{school.course_id}/quizzes/{assignment['id']}/questions"
    assert client.post(not_a_quiz, json=TRUE_FALSE, headers=school.lecturer).status_code == 404


def test_questions_can_be_edited_reordered_and_deleted(client, school):
    url, _ = make_quiz(client, school)
    first = add(client, school, url, MULTIPLE_CHOICE)
    second = add(client, school, url, TRUE_FALSE)
    third = add(client, school, url, SHORT_ANSWER)

    edited = client.patch(
        f"{url}/questions/{first['id']}",
        json={"text": "Pick the even numbers", "points": 4, "options": [{"text": "2", "correct": True}, {"text": "3"}]},
        headers=school.lecturer,
    )
    assert edited.status_code == 200, edited.text
    assert (edited.json()["text"], edited.json()["points"]) == ("Pick the even numbers", 4)
    assert [o["text"] for o in edited.json()["options"]] == ["2", "3"]
    # Options without a right answer, or options on a true/false question, are refused.
    no_answer = {"options": [{"text": "2"}, {"text": "3"}]}
    assert client.patch(f"{url}/questions/{first['id']}", json=no_answer, headers=school.lecturer).status_code == 422
    assert client.patch(f"{url}/questions/{second['id']}", json=no_answer, headers=school.lecturer).status_code == 422
    assert client.get(url, headers=school.lecturer).json()["max_mark"] == 4 + 1 + 3

    order = f"{url}/questions/order"
    assert client.put(order, json={"question_ids": [third["id"], first["id"]]}, headers=school.lecturer).status_code == 422
    response = client.put(
        order, json={"question_ids": [third["id"], first["id"], second["id"]]}, headers=school.lecturer
    )
    assert response.status_code == 200
    listed = client.get(f"{url}/questions", headers=school.lecturer).json()
    assert [q["id"] for q in listed] == [third["id"], first["id"], second["id"]]

    assert client.delete(f"{url}/questions/{third['id']}", headers=school.lecturer).status_code == 204
    assert client.delete(f"{url}/questions/{third['id']}", headers=school.lecturer).status_code == 404
    assert client.get(url, headers=school.lecturer).json()["max_mark"] == 4 + 1


def test_quiz_points_follow_its_questions_and_settings_can_change(client, school):
    url, quiz = make_quiz(client, school, time_limit_minutes=30)
    add(client, school, url, SHORT_ANSWER)
    assignment_url = f"/courses/{school.course_id}/assignments/{quiz['id']}"
    changed = client.patch(
        assignment_url, json={"max_mark": 50, "time_limit_minutes": None, "shuffle_answers": True}, headers=school.lecturer
    )
    assert changed.status_code == 200, changed.text
    # max_mark can't drift from the questions' total.
    assert changed.json()["max_mark"] == 3
    assert changed.json()["time_limit_minutes"] is None
    assert changed.json()["shuffle_answers"] is True
    # Deleting the quiz deletes its questions too.
    assert client.delete(assignment_url, headers=school.lecturer).status_code == 204
    assert client.get(url, headers=school.lecturer).status_code == 404
