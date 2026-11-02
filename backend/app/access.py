"""Who can see and change a course."""

from fastapi import HTTPException, status

from app import db


def course_role(course_id: str, user: dict) -> str:
    """The user's role on this course: "admin", "lecturer" or "student".

    People who are not enrolled get 404, so they cannot tell which courses exist.
    """
    if db.get(db.course_key(course_id)) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    if user["role"] == "admin":
        return "admin"
    member = db.get(db.member_key(course_id, user["id"]))
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    return member["role"]


def require_teacher(course_id: str, user: dict) -> str:
    """Only the course's lecturers and admins can change course content."""
    role = course_role(course_id, user)
    if role == "student":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the course lecturer can do this")
    return role


def require_student(course_id: str, user: dict) -> None:
    if course_role(course_id, user) != "student":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only enrolled students can do this")


def my_courses(user: dict) -> list[dict]:
    """Courses the user is enrolled in, with their role on each. Admins see every course."""
    if user["role"] == "admin":
        return [{**db.strip_keys(course), "my_role": "admin"} for course in db.query(db.ORG, "COURSE#")]
    courses = []
    for membership in db.query(f"USER#{user['id']}", "COURSE#", by_gsi1=True):
        course = db.get(db.course_key(membership["course_id"]))
        if course:
            courses.append({**db.strip_keys(course), "my_role": membership["role"]})
    return courses
