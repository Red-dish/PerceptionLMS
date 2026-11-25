"""Rubrics: criteria x rating levels, each rating worth some points.

A rubric belongs to a course and can be used by any of its assignments (rubric_id on
the assignment). Grading with a rubric is in assignments.py:
PUT .../submissions/{studentId}/rubric-grade.
"""

from fastapi import APIRouter, HTTPException, Response, status

from app import coursework as cw
from app import db
from app.access import require_teacher
from app.auth import CurrentUser
from app.models import Rubric, RubricCreate, RubricUpdate

router = APIRouter(prefix="/courses/{course_id}/rubrics", tags=["rubrics"])


def _criteria(criteria) -> list[dict]:
    """Give every criterion and rating an ID, and work out each criterion's top score."""
    built = []
    for criterion in criteria:
        ratings = [{"id": db.new_id(), **rating.model_dump()} for rating in criterion.ratings]
        built.append(
            {
                "id": db.new_id(),
                "title": criterion.title,
                "description": criterion.description,
                "ratings": ratings,
                "max_points": max(rating["points"] for rating in ratings),
            }
        )
    return built


def _points_possible(criteria: list[dict]) -> int:
    return sum(int(criterion["max_points"]) for criterion in criteria)


def rubric_or_404(course_id: str, rubric_id: str) -> dict:
    rubric = db.get(db.rubric_key(course_id, rubric_id))
    if rubric is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rubric not found")
    return db.strip_keys(rubric)


def rubric_must_exist(course_id: str, rubric_id: str | None) -> None:
    if rubric_id and db.get(db.rubric_key(course_id, rubric_id)) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "That rubric doesn't exist in this course")


def _used_by(course_id: str) -> dict[str, list[dict]]:
    used: dict[str, list[dict]] = {}
    for assignment in cw.course_assignments(course_id):
        if assignment.get("rubric_id"):
            used.setdefault(assignment["rubric_id"], []).append(assignment)
    return used


def with_usage(rubric: dict, used: dict[str, list[dict]] | None = None) -> dict:
    used = _used_by(rubric["course_id"]) if used is None else used
    return {**rubric, "assignment_ids": [assignment["id"] for assignment in used.get(rubric["id"], [])]}


@router.get("", response_model=list[Rubric])
def list_rubrics(course_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    used = _used_by(course_id)
    rubrics = [db.strip_keys(item) for item in db.query(f"COURSE#{course_id}", "RUBRIC#")]
    return [with_usage(rubric, used) for rubric in sorted(rubrics, key=lambda r: r["title"].lower())]


@router.post("", response_model=Rubric, status_code=status.HTTP_201_CREATED)
def create_rubric(course_id: str, body: RubricCreate, user: CurrentUser):
    require_teacher(course_id, user)
    rubric_id = db.new_id()
    criteria = _criteria(body.criteria)
    rubric = {
        "id": rubric_id,
        "course_id": course_id,
        "title": body.title,
        "criteria": criteria,
        "points_possible": _points_possible(criteria),
        "created_at": db.now_iso(),
        "updated_at": None,
    }
    return with_usage(db.put(db.rubric_key(course_id, rubric_id), rubric), {})


@router.get("/{rubric_id}", response_model=Rubric)
def get_rubric(course_id: str, rubric_id: str, user: CurrentUser):
    """Lecturers only. Students see an assignment's rubric on the assignment itself."""
    require_teacher(course_id, user)
    return with_usage(rubric_or_404(course_id, rubric_id))


@router.patch("/{rubric_id}", response_model=Rubric)
def update_rubric(course_id: str, rubric_id: str, body: RubricUpdate, user: CurrentUser):
    require_teacher(course_id, user)
    rubric = rubric_or_404(course_id, rubric_id)
    if body.title is not None:
        rubric["title"] = body.title
    if body.criteria is not None:
        rubric["criteria"] = _criteria(body.criteria)
        rubric["points_possible"] = _points_possible(rubric["criteria"])
    rubric["updated_at"] = db.now_iso()
    return with_usage(db.put(db.rubric_key(course_id, rubric_id), rubric))


@router.delete("/{rubric_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rubric(course_id: str, rubric_id: str, user: CurrentUser):
    """Refused while an assignment still uses the rubric. Marks already given keep their completed rubric."""
    require_teacher(course_id, user)
    rubric_or_404(course_id, rubric_id)
    using = _used_by(course_id).get(rubric_id, [])
    if using:
        titles = ", ".join(assignment["title"] for assignment in using)
        raise HTTPException(status.HTTP_409_CONFLICT, f"Remove this rubric from these assignments first: {titles}")
    db.delete(db.rubric_key(course_id, rubric_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
