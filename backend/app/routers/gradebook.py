"""The gradebook: every student against every assignment and quiz in a course.

Cells are edited with the grade endpoints in assignments.py (PUT and DELETE
.../submissions/{studentId}/grade), so marks entered here and marks given while
reviewing a submission are the same data.
"""

import csv
import io

from fastapi import APIRouter, Response

from app import coursework as cw
from app import db
from app.access import require_teacher
from app.auth import CurrentUser
from app.models import Gradebook

router = APIRouter(prefix="/courses/{course_id}/gradebook", tags=["gradebook"])


def _percent(part: float, whole: float) -> float | None:
    return round(part / whole * 100, 1) if whole else None


def build_gradebook(course_id: str) -> dict:
    course = db.strip_keys(db.get(db.course_key(course_id)))
    assignments = cw.course_assignments(course_id)
    students = cw.course_students(course_id)
    records = {assignment["id"]: cw.assignment_records(assignment["id"]) for assignment in assignments}
    moment = cw.now()

    columns = []
    for assignment in assignments:
        submissions, _ = records[assignment["id"]]
        enrolled = [submissions[s["user_id"]] for s in students if s["user_id"] in submissions]
        marks = [cw.final_mark(assignment, s) for s in enrolled if s.get("mark") is not None]
        columns.append(
            {
                "id": assignment["id"],
                "kind": assignment.get("kind", "assignment"),
                "title": assignment["title"],
                "due_at": assignment["due_at"],
                "weight": int(assignment["weight"]),
                "max_mark": int(assignment["max_mark"]),
                "graded": len(marks),
                "released": sum(1 for s in enrolled if s.get("mark") is not None and s.get("released")),
                "average_percent": _percent(sum(marks), len(marks) * int(assignment["max_mark"])),
            }
        )

    rows = []
    for student in students:
        cells = {}
        earned = possible = weighted = weight_marked = 0.0
        missing = late = 0
        for assignment in assignments:
            submissions, grants = records[assignment["id"]]
            submission = submissions.get(student["user_id"])
            grant = grants.get(student["user_id"])
            work = cw.work_status(assignment, submission, grant, moment)
            mark = int(submission["mark"]) if submission and submission.get("mark") is not None else None
            final = cw.final_mark(assignment, submission)
            is_late = bool(submission and submission.get("late"))
            cells[assignment["id"]] = {
                "status": work,
                "mark": mark,
                "final_mark": final,
                "released": bool(submission and submission.get("released")),
                "late": is_late,
                "submitted_at": submission and submission.get("submitted_at"),
                "has_grant": cw.grant_is_active(grant, moment),
            }
            missing += work == "missing"
            late += is_late
            if final is not None:
                max_mark, weight = int(assignment["max_mark"]), int(assignment["weight"])
                earned += final
                possible += max_mark
                weighted += final / max_mark * weight
                weight_marked += weight
        rows.append(
            {
                "student_id": student["user_id"],
                "name": student["name"],
                "email": student["email"],
                "cells": cells,
                "points_earned": int(earned),
                "points_possible": int(possible),
                "percent": _percent(earned, possible),
                # If nothing marked so far carries weight, fall back to points.
                "weighted_percent": _percent(weighted, weight_marked) if weight_marked else _percent(earned, possible),
                "missing": missing,
                "late": late,
            }
        )
    return {"course": course, "columns": columns, "rows": rows}


@router.get("", response_model=Gradebook)
def gradebook(course_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    return build_gradebook(course_id)


@router.get(".csv", response_class=Response, responses={200: {"content": {"text/csv": {}}}})
def gradebook_csv(course_id: str, user: CurrentUser):
    """The same grid as a spreadsheet: one row per student, one column per assignment."""
    require_teacher(course_id, user)
    book = build_gradebook(course_id)
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(
        ["Student", "Email"]
        + [f"{c['title']} (/{c['max_mark']}, {c['weight']}%)" for c in book["columns"]]
        + ["Points", "Out of", "Percent", "Weighted percent", "Missing", "Late"]
    )
    for row in book["rows"]:
        marks = []
        for column in book["columns"]:
            cell = row["cells"][column["id"]]
            if cell["final_mark"] is not None:
                marks.append(cell["final_mark"])
            else:
                marks.append("MISSING" if cell["status"] == "missing" else "")
        writer.writerow(
            [row["name"], row["email"], *marks]
            + [row["points_earned"], row["points_possible"], row["percent"] if row["percent"] is not None else "",
               row["weighted_percent"] if row["weighted_percent"] is not None else "", row["missing"], row["late"]]
        )
    file_name = f"{book['course']['code']}-gradebook.csv"
    return Response(
        out.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )
