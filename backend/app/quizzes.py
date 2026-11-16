"""Quiz rules: questions, attempts, the time limit and automatic marking.

A quiz is an assignment with kind "quiz". Its questions and each student's attempts
live in the assignment's partition. When an attempt is finished, the student's best
fully marked score is saved as their submission, so it shows in the gradebook, the
late and missing report and the student's grades like any other mark.

- Multiple choice and true/false are marked automatically. A multiple-choice question
  with several right options only scores when exactly those options are chosen.
- Short answers matching one of the accepted answers are marked right automatically.
  Anything else waits for the lecturer, and the attempt has no score until then.
- The time limit is enforced here, not by the browser. Answers can be saved and
  submitted until the deadline plus a short grace period for slow connections. An
  attempt left open past that is submitted with the answers saved before time ran out.
"""

import random
import re
from datetime import timedelta

from fastapi import HTTPException, status

from app import coursework as cw
from app import db

GRACE = timedelta(seconds=30)


def questions(quiz_id: str) -> list[dict]:
    items = [db.strip_keys(item) for item in db.query(f"ASSIGNMENT#{quiz_id}", "QUESTION#")]
    return sorted(items, key=lambda question: (int(question.get("position", 0)), question["id"]))


def total_points(quiz_questions: list[dict]) -> int:
    return sum(int(question["points"]) for question in quiz_questions)


def has_attempts(quiz_id: str) -> bool:
    """Once any student has started the quiz, its questions are locked (apart from wording)."""
    return bool(db.query(f"ASSIGNMENT#{quiz_id}", "ATTEMPT#"))


def sync_points(quiz: dict) -> dict:
    """Keep the quiz's max_mark equal to the total of its questions' points."""
    quiz_questions = questions(quiz["id"])
    if quiz_questions and int(quiz["max_mark"]) != total_points(quiz_questions):
        quiz = {**quiz, "max_mark": total_points(quiz_questions), "updated_at": db.now_iso()}
        db.put(db.assignment_key(quiz["course_id"], quiz["id"]), quiz)
    return quiz


def full_question(question: dict) -> dict:
    """A question as the lecturer sees it, with numbers as ints."""
    return {
        **question,
        "points": int(question["points"]),
        "position": int(question.get("position", 0)),
    }


def public_question(question: dict, reveal: bool = False) -> dict:
    """A question as a student sees it: without the right answers unless reveal is set."""
    if reveal:
        return full_question(question)
    shown = {
        name: question[name] for name in ("id", "quiz_id", "type", "text") if name in question
    }
    shown.update(points=int(question["points"]), position=int(question.get("position", 0)))
    if question.get("options") is not None:
        shown["options"] = [{"id": option["id"], "text": option["text"]} for option in question["options"]]
    return shown


# Attempts
def attempts(quiz_id: str, student_id: str | None = None) -> list[dict]:
    items = [db.strip_keys(item) for item in db.query(f"ASSIGNMENT#{quiz_id}", "ATTEMPT#")]
    if student_id:
        items = [item for item in items if item["student_id"] == student_id]
    return sorted(items, key=lambda attempt: (attempt["student_name"].lower(), int(attempt["number"])))


def save_attempt(attempt: dict) -> dict:
    return db.put(db.quiz_attempt_key(attempt["quiz_id"], attempt["id"]), attempt)


def deadline_for(quiz: dict, grant: dict | None, started) -> str | None:
    """The earliest of: the time limit running out, and the quiz closing for this student."""
    limits = []
    if quiz.get("time_limit_minutes"):
        limits.append(started + timedelta(minutes=int(quiz["time_limit_minutes"])))
    if grant:
        if grant.get("until"):
            limits.append(cw.parse(grant["until"]))
    elif quiz.get("available_until"):
        limits.append(cw.parse(quiz["available_until"]))
    return cw.utc_iso(min(limits)) if limits else None


def new_attempt(quiz: dict, user: dict, number: int, grant: dict | None) -> dict:
    moment = cw.now()
    quiz_questions = questions(quiz["id"])
    option_order = {}
    for question in quiz_questions:
        if question.get("options"):
            ids = [option["id"] for option in question["options"]]
            if quiz.get("shuffle_answers"):
                random.shuffle(ids)
            option_order[question["id"]] = ids
    return save_attempt(
        {
            "id": db.new_id(),
            "quiz_id": quiz["id"],
            "course_id": quiz["course_id"],
            "student_id": user["id"],
            "student_name": user["name"],
            "number": number,
            "status": "in_progress",
            "started_at": cw.utc_iso(moment),
            "deadline": deadline_for(quiz, grant, moment),
            "submitted_at": None,
            "auto_submitted": False,
            "late": False,
            "days_late": 0,
            "score": None,
            "max_score": total_points(quiz_questions),
            "needs_marking": 0,
            "question_order": [question["id"] for question in quiz_questions],
            "option_order": option_order,
            "answers": {},
            "results": None,
        }
    )


def time_is_up(attempt: dict, moment) -> bool:
    deadline = cw.parse(attempt.get("deadline"))
    return deadline is not None and moment > deadline + GRACE


def check_answers(quiz_questions: dict[str, dict], answers: dict) -> dict:
    """Refuse answers that don't fit their question, so marking never guesses."""
    for question_id, answer in answers.items():
        question = quiz_questions.get(question_id)
        if question is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"No question {question_id} in this quiz")
        kind = question["type"]
        if kind == "multiple_choice":
            option_ids = {option["id"] for option in question["options"]}
            if not isinstance(answer, list) or not set(answer) <= option_ids:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT, "Answer a multiple-choice question with a list of option IDs"
                )
        elif kind == "true_false" and not isinstance(answer, bool):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Answer a true/false question with true or false")
        elif kind == "short_answer" and (not isinstance(answer, str) or len(answer) > 5_000):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "Answer a short-answer question with text (up to 5,000 characters)"
            )
    return answers


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().casefold()


def mark_answer(question: dict, answer) -> dict:
    points = int(question["points"])
    result = {"points": 0, "max_points": points, "correct": False, "needs_marking": False}
    kind = question["type"]
    if kind == "multiple_choice":
        right = {option["id"] for option in question["options"] if option["correct"]}
        result["correct"] = isinstance(answer, list) and set(answer) == right
    elif kind == "true_false":
        result["correct"] = isinstance(answer, bool) and answer == question.get("answer")
    else:
        given = _normalise(answer) if isinstance(answer, str) else ""
        if not given:
            result["correct"] = False
        elif given in {_normalise(accepted) for accepted in question.get("accepted_answers") or []}:
            result["correct"] = True
        else:
            result.update(correct=None, needs_marking=True)
    if result["correct"]:
        result["points"] = points
    return result


def add_up(attempt: dict) -> dict:
    """Score, marking count and status from the per-question results."""
    results = attempt["results"] or {}
    waiting = sum(1 for result in results.values() if result["needs_marking"])
    attempt["needs_marking"] = waiting
    attempt["status"] = "submitted" if waiting else "graded"
    attempt["score"] = None if waiting else sum(int(result["points"]) for result in results.values())
    return attempt


def finish(quiz: dict, attempt: dict, *, auto: bool = False) -> dict:
    """Mark an attempt and record the score. auto means time ran out before the student submitted."""
    moment = cw.now()
    submitted = cw.parse(attempt["deadline"]) if auto else moment
    by_id = {question["id"]: question for question in questions(quiz["id"])}
    answers = attempt.get("answers") or {}
    attempt["results"] = {
        question_id: mark_answer(by_id[question_id], answers.get(question_id))
        for question_id in attempt["question_order"]
        if question_id in by_id
    }
    grant = db.get(db.grant_key(quiz["id"], attempt["student_id"]))
    due = cw.effective_due(quiz, grant and db.strip_keys(grant))
    attempt.update(
        submitted_at=cw.utc_iso(submitted),
        auto_submitted=auto,
        late=submitted > due,
        days_late=cw.days_after(submitted, due),
    )
    attempt = save_attempt(add_up(attempt))
    record_score(quiz, attempt["student_id"], attempt["student_name"])
    return attempt


def settle(quiz: dict, student_id: str | None = None) -> None:
    """Submit any attempt whose time ran out while the student was away."""
    moment = cw.now()
    for attempt in attempts(quiz["id"], student_id):
        if attempt["status"] == "in_progress" and time_is_up(attempt, moment):
            finish(quiz, attempt, auto=True)


def record_score(quiz: dict, student_id: str, student_name: str) -> None:
    """Save the student's best fully marked attempt as their submission for the gradebook."""
    done = [attempt for attempt in attempts(quiz["id"], student_id) if attempt["status"] != "in_progress"]
    if not done:
        return
    marked = [attempt for attempt in done if attempt["status"] == "graded"]
    counted = (
        max(marked, key=lambda attempt: (int(attempt["score"]), int(attempt["number"])))
        if marked
        else max(done, key=lambda attempt: int(attempt["number"]))
    )
    mark = int(counted["score"]) if marked else None
    previous = db.get(db.submission_key(quiz["id"], student_id))
    previous = db.strip_keys(previous) if previous else {}
    already_released = bool(previous.get("released")) and previous.get("mark") is not None
    db.put(
        db.submission_key(quiz["id"], student_id),
        {
            "assignment_id": quiz["id"],
            "course_id": quiz["course_id"],
            "student_id": student_id,
            "student_name": student_name,
            "text": None,
            "file_name": None,
            "content_type": None,
            "s3_key": None,
            "submitted_at": counted["submitted_at"],
            "late": bool(counted["late"]),
            "days_late": int(counted["days_late"]),
            "attempt": len(done),
            "mark": mark,
            "feedback": previous.get("feedback"),
            "released": mark is not None and (bool(quiz.get("show_score", True)) or already_released),
            "graded_at": db.now_iso() if mark is not None else None,
            "history": [],
        },
        gsi1=(f"USER#{student_id}", f"SUBMISSION#{quiz['id']}"),
    )


def score_released(quiz: dict, student_id: str) -> bool:
    submission = db.get(db.submission_key(quiz["id"], student_id))
    return bool(quiz.get("show_score", True)) or bool(submission and submission.get("released"))


def attempt_view(quiz: dict, attempt: dict, *, as_lecturer: bool, with_questions: bool = True) -> dict:
    """An attempt with its questions in the student's order. Students only see the score,
    the per-question results and (if allowed) the right answers once the score is released."""
    view = {name: value for name, value in attempt.items() if name not in ("question_order", "option_order")}
    moment = cw.now()
    deadline = cw.parse(attempt.get("deadline"))
    if attempt["status"] == "in_progress" and deadline:
        view["seconds_left"] = max(0, int((deadline - moment).total_seconds()))
    finished = attempt["status"] != "in_progress"
    visible = as_lecturer or (finished and score_released(quiz, attempt["student_id"]))
    if not visible:
        view.update(score=None, results=None)
    if with_questions:
        reveal = as_lecturer or (visible and bool(quiz.get("show_correct_answers")))
        by_id = {question["id"]: question for question in questions(quiz["id"])}
        shown = []
        for question_id in attempt["question_order"]:
            question = by_id.get(question_id)
            if question is None:
                continue
            public = public_question(question, reveal)
            order = (attempt.get("option_order") or {}).get(question_id)
            if order and public.get("options"):
                options = {option["id"]: option for option in public["options"]}
                public["options"] = [options[i] for i in order if i in options]
            shown.append(public)
        view["questions"] = shown
    return view
