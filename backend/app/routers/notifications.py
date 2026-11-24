"""In-app notifications assembled from course activity and private messages."""

import hashlib
from datetime import timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import coursework as cw, db
from app.access import my_courses
from app.auth import CurrentUser
from app.routers import inbox
from app.routers.announcements import shown_at

router = APIRouter(prefix="/me", tags=["notifications"])


class Preferences(BaseModel):
    grades: bool = True
    announcements: bool = True
    messages: bool = True
    due_dates: bool = True


def user_partition(user):
    return f"USER#{user['id']}"


def get_preferences(user):
    record = db.get((user_partition(user), "NOTIFICATION_PREFERENCES")) or {}
    return Preferences.model_validate(record)


def notification(kind, source_id, timestamp, course, title, path, version=""):
    identity = f"{kind}:{source_id}:{version}".encode()
    return {
        "id": hashlib.sha256(identity).hexdigest(), "kind": kind,
        "created_at": timestamp, "course_id": course["id"], "title": title, "path": path,
    }


def course_notifications(user, course, prefs, now):
    course_id = course["id"]
    partition = f"COURSE#{course_id}"
    base = f"/courses/{course_id}"
    if prefs.announcements:
        for item in db.query(partition, "ANNOUNCEMENT#"):
            timestamp = shown_at(item)
            if item["author_id"] != user["id"] and cw.parse(timestamp) <= now:
                yield notification("announcement", item["id"], timestamp, course, item["title"], base)
    if course["my_role"] == "student" and (prefs.grades or prefs.due_dates):
        for item in db.query(partition, "ASSIGNMENT#"):
            if not cw.is_visible_to_students(item, now):
                continue
            assignment_id = item["id"]
            submission = db.get(db.submission_key(assignment_id, user["id"])) or {}
            path = f"{base}/assignments/{assignment_id}"
            if prefs.grades and submission.get("released") and submission.get("mark") is not None:
                timestamp = submission.get("released_at") or submission.get("graded_at")
                if timestamp:
                    yield notification("grade", assignment_id, timestamp, course, f"New grade: {item['title']}", path, timestamp)
            if prefs.due_dates and not (submission.get("submitted_at") or submission.get("mark") is not None):
                grant = db.get(db.grant_key(assignment_id, user["id"]))
                due = cw.effective_due(item, grant)
                if now < due <= now + timedelta(hours=24) and cw.accepting_submissions(item, grant, now):
                    timestamp = (due - timedelta(hours=24)).isoformat()
                    yield notification("due", assignment_id, timestamp, course, f"Due within 24 hours: {item['title']}", path, due.isoformat())
    if prefs.messages and inbox.enrolled(course_id, user["id"]):
        for thread in inbox.course_threads(course_id, user["id"]):
            for item in inbox.messages(thread["id"]):
                if item["sender_id"] != user["id"]:
                    yield notification(
                        "message", item["id"], item["created_at"], course,
                        f"New message from {item['sender_name']}",
                        f"/inbox?course={course_id}&conversation={thread['id']}",
                    )


def visible_notifications(user):
    prefs = get_preferences(user)
    now = cw.now()
    for course in my_courses(user):
        yield from course_notifications(user, course, prefs, now)


@router.get("/notification-preferences", response_model=Preferences)
def preferences(user: CurrentUser):
    return get_preferences(user)


@router.put("/notification-preferences", response_model=Preferences)
def save_preferences(body: Preferences, user: CurrentUser):
    return db.put((user_partition(user), "NOTIFICATION_PREFERENCES"), body.model_dump())


@router.get("/notifications")
def notifications(user: CurrentUser):
    read = {item["id"] for item in db.query(user_partition(user), "NOTIFICATION_READ#")}
    items = [{**item, "read": item["id"] in read} for item in visible_notifications(user)]
    items.sort(key=lambda item: (cw.parse(item["created_at"]), item["id"]), reverse=True)
    return {"notifications": items, "unread_count": sum(not item["read"] for item in items)}


@router.put("/notifications/{notification_id}/read")
def mark_read(notification_id: str, user: CurrentUser):
    key = (user_partition(user), f"NOTIFICATION_READ#{notification_id}")
    if db.get(key) is None:
        if not any(item["id"] == notification_id for item in visible_notifications(user)):
            raise HTTPException(404, "Notification not found")
        db.put(key, {"id": notification_id})
    return {"id": notification_id, "read": True}
