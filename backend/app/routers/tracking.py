"""Late and missing work, for one course (its lecturers) or every course (admins)."""

from typing import Literal

from fastapi import APIRouter

from app import coursework as cw
from app import db, quizzes
from app.access import require_teacher
from app.auth import AdminUser, CurrentUser
from app.models import WorkReport

router = APIRouter(tags=["late and missing work"])

StatusFilter = Literal["missing", "late"] | None


def course_work(course: dict, only: StatusFilter = None) -> list[dict]:
    moment = cw.now()
    students = cw.course_students(course["id"])
    items = []
    for assignment in cw.course_assignments(course["id"]):
        if assignment.get("kind") == "quiz":
            quizzes.settle(assignment)  # submit attempts whose time ran out
        submissions, grants = cw.assignment_records(assignment["id"])
        for student in students:
            submission = submissions.get(student["user_id"])
            grant = grants.get(student["user_id"])
            work = cw.work_status(assignment, submission, grant, moment)
            due = cw.effective_due(assignment, grant)
            if work == "missing":
                kind, days = "missing", cw.days_after(moment, due)
            elif submission and submission.get("late"):
                kind, days = "late", cw.days_after(cw.parse(submission["submitted_at"]), due)
            else:
                continue
            if only and kind != only:
                continue
            items.append(
                {
                    "course_id": course["id"],
                    "course_code": course["code"],
                    "assignment_id": assignment["id"],
                    "assignment_title": assignment["title"],
                    "kind": assignment.get("kind", "assignment"),
                    "due_at": assignment["due_at"],
                    "student_id": student["user_id"],
                    "student_name": student["name"],
                    "student_email": student["email"],
                    "status": kind,
                    "submitted_at": submission and submission.get("submitted_at"),
                    "days_late": days,
                    "mark": int(submission["mark"]) if submission and submission.get("mark") is not None else None,
                    "grant": grant,
                }
            )
    return items


def _report(items: list[dict]) -> dict:
    # Missing work first, the most overdue at the top.
    items.sort(key=lambda item: (item["status"] != "missing", -item["days_late"], item["student_name"].lower()))
    return {
        "missing": sum(item["status"] == "missing" for item in items),
        "late": sum(item["status"] == "late" for item in items),
        "items": items,
    }


@router.get("/courses/{course_id}/late-missing", response_model=WorkReport)
def course_late_and_missing(course_id: str, user: CurrentUser, status: StatusFilter = None):
    require_teacher(course_id, user)
    course = db.strip_keys(db.get(db.course_key(course_id)))
    return _report(course_work(course, status))


@router.get("/admin/late-missing", response_model=WorkReport)
def all_late_and_missing(_: AdminUser, status: StatusFilter = None):
    items = []
    for course in db.query(db.ORG, "COURSE#"):
        items += course_work(db.strip_keys(course), status)
    return _report(items)
