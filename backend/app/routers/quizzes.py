"""The quiz builder: lecturers add, edit, reorder and delete a quiz's questions.

Create the quiz itself with POST /courses/{id}/assignments and kind "quiz"; its
settings (time limit, attempts, due date, shuffling) live on the assignment.
"""

from fastapi import APIRouter, HTTPException, Response, status

from app import coursework as cw
from app import db
from app import quizzes as qz
from app.access import course_role, require_teacher
from app.auth import CurrentUser
from app.models import Question, QuestionCreate, QuestionOrder, QuestionUpdate, QuizView, check_question

router = APIRouter(prefix="/courses/{course_id}/quizzes/{quiz_id}", tags=["quizzes"])


def quiz_or_404(course_id: str, quiz_id: str, role: str = "lecturer") -> dict:
    quiz = db.get(db.assignment_key(course_id, quiz_id))
    if (
        quiz is None
        or quiz.get("kind") != "quiz"
        or (role == "student" and not cw.is_visible_to_students(quiz, cw.now()))
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found")
    return db.strip_keys(quiz)


def _question_or_404(quiz_id: str, question_id: str) -> dict:
    question = db.get(db.question_key(quiz_id, question_id))
    if question is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    return db.strip_keys(question)


def _must_be_unlocked(quiz_id: str) -> None:
    if qz.has_attempts(quiz_id):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Students have started this quiz, so questions can't be added, removed, reordered or re-marked. "
            "You can still fix a question's wording",
        )


def _options(options) -> list[dict] | None:
    if options is None:
        return None
    return [{"id": db.new_id(), "text": option.text, "correct": option.correct} for option in options]


def _save(question: dict) -> dict:
    return db.put(db.question_key(question["quiz_id"], question["id"]), question)


@router.get("", response_model=QuizView)
def get_quiz(course_id: str, quiz_id: str, user: CurrentUser):
    """The quiz and its settings. Lecturers also get every question with its answers."""
    role = course_role(course_id, user)
    quiz = quiz_or_404(course_id, quiz_id, role)
    quiz_questions = qz.questions(quiz_id)
    view = {**quiz, "question_count": len(quiz_questions)}
    if role != "student":
        view["questions"] = [qz.full_question(question) for question in quiz_questions]
    return view


@router.get("/questions", response_model=list[Question])
def list_questions(course_id: str, quiz_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    quiz_or_404(course_id, quiz_id)
    return [qz.full_question(question) for question in qz.questions(quiz_id)]


@router.post("/questions", response_model=Question, status_code=status.HTTP_201_CREATED)
def add_question(course_id: str, quiz_id: str, body: QuestionCreate, user: CurrentUser):
    require_teacher(course_id, user)
    quiz = quiz_or_404(course_id, quiz_id)
    _must_be_unlocked(quiz_id)
    existing = qz.questions(quiz_id)
    question = _save(
        {
            "id": db.new_id(),
            "quiz_id": quiz_id,
            "type": body.type,
            "text": body.text,
            "points": body.points,
            "position": max((int(q.get("position", 0)) for q in existing), default=-1) + 1,
            "options": _options(body.options),
            "answer": body.answer,
            "accepted_answers": (body.accepted_answers or []) if body.type == "short_answer" else None,
            "created_at": db.now_iso(),
        }
    )
    qz.sync_points(quiz)
    return qz.full_question(question)


@router.patch("/questions/{question_id}", response_model=Question)
def edit_question(course_id: str, quiz_id: str, question_id: str, body: QuestionUpdate, user: CurrentUser):
    """Only the fields you send are changed. Sending options replaces all of them."""
    require_teacher(course_id, user)
    quiz = quiz_or_404(course_id, quiz_id)
    question = _question_or_404(quiz_id, question_id)
    changes = {name: value for name, value in body.model_dump(exclude_unset=True).items() if value is not None}
    if set(changes) - {"text"}:
        _must_be_unlocked(quiz_id)
    if "options" in changes:
        changes["options"] = _options(body.options)
    question.update(changes)
    try:
        check_question(question["type"], question.get("options"), question.get("answer"), question.get("accepted_answers"))
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from None
    question["updated_at"] = db.now_iso()
    question = _save(question)
    qz.sync_points(quiz)
    return qz.full_question(question)


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(course_id: str, quiz_id: str, question_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    quiz = quiz_or_404(course_id, quiz_id)
    _question_or_404(quiz_id, question_id)
    _must_be_unlocked(quiz_id)
    db.delete(db.question_key(quiz_id, question_id))
    qz.sync_points(quiz)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/questions/order", response_model=list[Question])
def reorder_questions(course_id: str, quiz_id: str, body: QuestionOrder, user: CurrentUser):
    require_teacher(course_id, user)
    quiz_or_404(course_id, quiz_id)
    _must_be_unlocked(quiz_id)
    existing = {question["id"]: question for question in qz.questions(quiz_id)}
    if sorted(body.question_ids) != sorted(existing):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Send every question ID in the quiz, once each")
    ordered = []
    for position, question_id in enumerate(body.question_ids):
        ordered.append(_save({**existing[question_id], "position": position}))
    return [qz.full_question(question) for question in ordered]
