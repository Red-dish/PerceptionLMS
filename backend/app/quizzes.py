"""Quiz rules shared by the quiz endpoints.

A quiz is an assignment with kind "quiz". Its questions live in the assignment's
partition, and its points (max_mark) are always the total of its questions' points,
so the gradebook shows it like any other assignment.
"""

from app import db


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
