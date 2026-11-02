from datetime import UTC, datetime

from fastapi import APIRouter

from app import db
from app.access import my_courses
from app.auth import CurrentUser
from app.models import Dashboard, Grade, User

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=User)
def me(user: CurrentUser):
    return user


@router.get("/dashboard", response_model=Dashboard)
def dashboard(user: CurrentUser):
    courses = my_courses(user)
    now = datetime.now(UTC)
    upcoming, announcements = [], []
    for course in courses:
        partition = f"COURSE#{course['id']}"
        upcoming += [
            assignment
            for assignment in db.query(partition, "ASSIGNMENT#")
            if datetime.fromisoformat(assignment["due_at"]) >= now
        ]
        announcements += db.query(partition, "ANNOUNCEMENT#", newest_first=True)[:5]
    upcoming.sort(key=lambda assignment: assignment["due_at"])
    announcements.sort(key=lambda announcement: announcement["created_at"], reverse=True)
    return {"courses": courses, "upcoming": upcoming[:10], "announcements": announcements[:5]}


@router.get("/grades", response_model=list[Grade])
def my_grades(user: CurrentUser):
    grades = []
    for submission in db.query(f"USER#{user['id']}", "SUBMISSION#", by_gsi1=True):
        if not submission.get("released"):
            continue
        assignment = db.get(db.assignment_key(submission["course_id"], submission["assignment_id"]))
        course = db.get(db.course_key(submission["course_id"]))
        if assignment is None or course is None:
            continue
        grades.append(
            {
                "course_id": course["id"],
                "course_code": course["code"],
                "assignment_id": assignment["id"],
                "assignment_title": assignment["title"],
                "weight": assignment["weight"],
                "max_mark": assignment["max_mark"],
                "mark": submission["mark"],
                "feedback": submission.get("feedback") or "",
            }
        )
    return grades
