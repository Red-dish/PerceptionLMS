"""Rules shared by assignments, the gradebook and late/missing tracking.

- An assignment can have an availability window. Students can't see it before
  available_from, and can't submit after available_until.
- A lecturer can grant one student a resubmission or an extension. While the grant
  is active the student may submit even if the window has closed or their work has
  been marked, and "late" is measured against the grant's date instead of due_at.
"""

import math
from datetime import UTC, datetime

from fastapi import HTTPException, status

from app import db


def parse(moment: str | None) -> datetime | None:
    return datetime.fromisoformat(moment) if moment else None


def utc_iso(moment: datetime | None) -> str | None:
    return moment.astimezone(UTC).isoformat(timespec="seconds") if moment else None


def now() -> datetime:
    return datetime.now(UTC)


def course_students(course_id: str) -> list[dict]:
    members = db.query(f"COURSE#{course_id}", "MEMBER#")
    students = [member for member in members if member["role"] == "student"]
    return sorted(students, key=lambda member: member["name"].lower())


def enrolled_student_or_404(course_id: str, student_id: str) -> dict:
    member = db.get(db.member_key(course_id, student_id))
    if member is None or member["role"] != "student":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This student isn't enrolled in the course")
    return member


def is_visible_to_students(assignment: dict, moment: datetime) -> bool:
    if not assignment.get("published", True):
        return False
    opens = parse(assignment.get("available_from"))
    return opens is None or moment >= opens


def final_mark(assignment: dict, submission: dict | None) -> int | None:
    """The mark after the assignment's late penalty (a percent off per day late)."""
    if not submission or submission.get("mark") is None:
        return None
    mark = int(submission["mark"])
    penalty = min(100, int(assignment.get("late_penalty_percent") or 0) * int(submission.get("days_late") or 0))
    return max(0, round(mark * (100 - penalty) / 100))


def grant_is_active(grant: dict | None, moment: datetime) -> bool:
    if grant is None:
        return False
    until = parse(grant.get("until"))
    return until is None or moment <= until


def effective_due(assignment: dict, grant: dict | None) -> datetime:
    """The due date that applies to one student: an extension's date if they have one."""
    if grant and grant.get("until"):
        return max(parse(grant["until"]), parse(assignment["due_at"]))
    return parse(assignment["due_at"])


def accepting_submissions(assignment: dict, grant: dict | None, moment: datetime) -> bool:
    if grant_is_active(grant, moment):
        return True
    closes = parse(assignment.get("available_until"))
    return is_visible_to_students(assignment, moment) and (closes is None or moment <= closes)


def work_status(assignment: dict, submission: dict | None, grant: dict | None, moment: datetime) -> str:
    """One of graded, submitted, missing or upcoming."""
    if submission and submission.get("mark") is not None:
        return "graded"
    if submission and submission.get("submitted_at"):
        return "submitted"
    if moment > effective_due(assignment, grant) and not grant_is_active(grant, moment):
        return "missing"
    return "upcoming"


def days_after(later: datetime, earlier: datetime) -> int:
    """Whole days, rounded up, so one minute late counts as one day."""
    return max(0, math.ceil((later - earlier).total_seconds() / 86400))


def course_assignments(course_id: str) -> list[dict]:
    items = db.query(f"COURSE#{course_id}", "ASSIGNMENT#")
    return sorted((db.strip_keys(item) for item in items), key=lambda assignment: assignment["due_at"])


def assignment_records(assignment_id: str) -> tuple[dict[str, dict], dict[str, dict]]:
    """Submissions and resubmission grants for one assignment, each keyed by student ID."""
    submissions, grants = {}, {}
    for item in db.query(f"ASSIGNMENT#{assignment_id}"):
        if item["SK"].startswith("SUBMISSION#"):
            submissions[item["student_id"]] = db.strip_keys(item)
        elif item["SK"].startswith("GRANT#"):
            grants[item["student_id"]] = db.strip_keys(item)
    return submissions, grants
