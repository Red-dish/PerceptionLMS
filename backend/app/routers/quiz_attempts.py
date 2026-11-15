"""Taking a quiz: start an attempt, save answers, submit, and see the score.

Lecturers list attempts and mark the short answers that weren't marked
automatically. The rules (time limit, marking, best score) are in app/quizzes.py.
"""

from fastapi import APIRouter, HTTPException, Response, status

from app import coursework as cw
from app import db
from app import quizzes as qz
from app.access import course_role, require_student, require_teacher
from app.auth import CurrentUser
from app.models import AnswersSave, QuestionMarks, QuizAttempt
from app.routers.quizzes import quiz_or_404

router = APIRouter(prefix="/courses/{course_id}/quizzes/{quiz_id}/attempts", tags=["quizzes"])


def _attempt_or_404(quiz: dict, attempt_id: str, role: str, user: dict) -> dict:
    attempt = db.get(db.quiz_attempt_key(quiz["id"], attempt_id))
    # Students can only see their own attempts.
    if attempt is None or (role == "student" and attempt["student_id"] != user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attempt not found")
    attempt = db.strip_keys(attempt)
    if attempt["status"] == "in_progress" and qz.time_is_up(attempt, cw.now()):
        attempt = qz.finish(quiz, attempt, auto=True)
    return attempt


def _active_grant(quiz_id: str, student_id: str) -> dict | None:
    grant = db.get(db.grant_key(quiz_id, student_id))
    grant = grant and db.strip_keys(grant)
    return grant if cw.grant_is_active(grant, cw.now()) else None


@router.post("", response_model=QuizAttempt, status_code=status.HTTP_201_CREATED)
def start_attempt(course_id: str, quiz_id: str, user: CurrentUser, response: Response):
    """Start the quiz. If an attempt is already in progress, it is returned instead (200),
    with the time left on it: the clock doesn't stop when the page is closed."""
    require_student(course_id, user)
    quiz = quiz_or_404(course_id, quiz_id, "student")
    if not qz.questions(quiz_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "This quiz has no questions yet")
    qz.settle(quiz, user["id"])
    mine = qz.attempts(quiz_id, user["id"])
    open_attempt = next((a for a in mine if a["status"] == "in_progress"), None)
    if open_attempt:
        response.status_code = status.HTTP_200_OK
        return qz.attempt_view(quiz, open_attempt, as_lecturer=False)

    grant = _active_grant(quiz_id, user["id"])
    if not cw.accepting_submissions(quiz, grant, cw.now()):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This quiz has closed")
    used = len(mine)
    max_attempts = quiz.get("max_attempts")
    over_limit = bool(max_attempts) and used >= int(max_attempts)
    if over_limit and not grant:
        raise HTTPException(status.HTTP_409_CONFLICT, f"You've used all {int(max_attempts)} attempts")
    attempt = qz.new_attempt(quiz, user, used + 1, grant)
    # A resubmission (a grant with no date) is used up by the extra attempt it allowed.
    if over_limit and grant and not grant.get("until"):
        db.delete(db.grant_key(quiz_id, user["id"]))
    return qz.attempt_view(quiz, attempt, as_lecturer=False)


@router.get("", response_model=list[QuizAttempt])
def list_attempts(
    course_id: str, quiz_id: str, user: CurrentUser, student_id: str | None = None, needs_marking: bool = False
):
    """Students get their own attempts. Lecturers get everyone's, optionally only one
    student's, or only those with short answers waiting to be marked."""
    role = course_role(course_id, user)
    quiz = quiz_or_404(course_id, quiz_id, role)
    lecturer = role != "student"
    if not lecturer:
        student_id = user["id"]
    qz.settle(quiz, student_id)
    found = qz.attempts(quiz_id, student_id)
    if lecturer and needs_marking:
        found = [attempt for attempt in found if int(attempt.get("needs_marking") or 0)]
    return [qz.attempt_view(quiz, attempt, as_lecturer=lecturer, with_questions=lecturer) for attempt in found]


@router.get("/{attempt_id}", response_model=QuizAttempt)
def get_attempt(course_id: str, quiz_id: str, attempt_id: str, user: CurrentUser):
    """The attempt with its questions in this student's order. After submitting, students
    see their score and results once released, and the right answers if the quiz allows it."""
    role = course_role(course_id, user)
    quiz = quiz_or_404(course_id, quiz_id, role)
    attempt = _attempt_or_404(quiz, attempt_id, role, user)
    return qz.attempt_view(quiz, attempt, as_lecturer=role != "student")


def _open_attempt(course_id: str, quiz_id: str, attempt_id: str, user: dict) -> tuple[dict, dict]:
    require_student(course_id, user)
    quiz = quiz_or_404(course_id, quiz_id, "student")
    attempt = db.get(db.quiz_attempt_key(quiz_id, attempt_id))
    if attempt is None or attempt["student_id"] != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attempt not found")
    attempt = db.strip_keys(attempt)
    if attempt["status"] != "in_progress":
        raise HTTPException(status.HTTP_409_CONFLICT, "This attempt has already been submitted")
    return quiz, attempt


@router.put("/{attempt_id}/answers", response_model=QuizAttempt)
def save_answers(course_id: str, quiz_id: str, attempt_id: str, body: AnswersSave, user: CurrentUser):
    """Save answers as the student goes, so nothing is lost if time runs out."""
    quiz, attempt = _open_attempt(course_id, quiz_id, attempt_id, user)
    if qz.time_is_up(attempt, cw.now()):
        qz.finish(quiz, attempt, auto=True)
        raise HTTPException(status.HTTP_409_CONFLICT, "Time is up. Your saved answers have been submitted")
    by_id = {question["id"]: question for question in qz.questions(quiz_id)}
    attempt["answers"] = {**(attempt.get("answers") or {}), **qz.check_answers(by_id, body.answers)}
    return qz.attempt_view(quiz, qz.save_attempt(attempt), as_lecturer=False)


@router.post("/{attempt_id}/submit", response_model=QuizAttempt)
def submit_attempt(course_id: str, quiz_id: str, attempt_id: str, body: AnswersSave, user: CurrentUser):
    """Hand the quiz in. Multiple choice, true/false and matching short answers are marked
    straight away. If time has already run out, only the answers saved in time count."""
    quiz, attempt = _open_attempt(course_id, quiz_id, attempt_id, user)
    if qz.time_is_up(attempt, cw.now()):
        return qz.attempt_view(quiz, qz.finish(quiz, attempt, auto=True), as_lecturer=False)
    by_id = {question["id"]: question for question in qz.questions(quiz_id)}
    attempt["answers"] = {**(attempt.get("answers") or {}), **qz.check_answers(by_id, body.answers)}
    return qz.attempt_view(quiz, qz.finish(quiz, attempt), as_lecturer=False)


@router.put("/{attempt_id}/marks", response_model=QuizAttempt)
def mark_questions(course_id: str, quiz_id: str, attempt_id: str, body: QuestionMarks, user: CurrentUser):
    """Mark short answers (or change any question's points). When nothing is left to mark,
    the attempt gets its score and the student's gradebook mark is updated."""
    role = require_teacher(course_id, user)
    quiz = quiz_or_404(course_id, quiz_id)
    attempt = _attempt_or_404(quiz, attempt_id, role, user)
    if attempt["status"] == "in_progress":
        raise HTTPException(status.HTTP_409_CONFLICT, "The student is still taking this quiz")
    results = attempt["results"] or {}
    for question_id, points in body.marks.items():
        result = results.get(question_id)
        if result is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"No question {question_id} in this attempt")
        if points > int(result["max_points"]):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, f"That question is worth {int(result['max_points'])} points"
            )
        results[question_id] = {**result, "points": points, "correct": points == int(result["max_points"]), "needs_marking": False}
    attempt["results"] = results
    attempt = qz.save_attempt(qz.add_up(attempt))
    qz.record_score(quiz, attempt["student_id"], attempt["student_name"])
    return qz.attempt_view(quiz, attempt, as_lecturer=True)
