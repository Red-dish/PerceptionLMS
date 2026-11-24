"""Perception LMS API. Runs on AWS Lambda through Mangum, or locally with uvicorn."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.config import get_settings
from app.routers import (
    admin,
    announcements,
    assignments,
    calendar,
    courses,
    discussions,
    gradebook,
    inbox,
    login,
    me,
    notifications,
    quiz_attempts,
    quizzes,
    tracking,
)

app = FastAPI(
    title="Perception LMS API",
    version="0.1.0",
    description="Courses, materials, assignments, grades and announcements for ASA College.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().allowed_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

for router in (
    login.router,
    me.router,
    admin.router,
    courses.router,
    assignments.router,
    quizzes.router,
    quiz_attempts.router,
    gradebook.router,
    tracking.router,
    announcements.router,
    discussions.router,
    inbox.router,
    calendar.router,
    notifications.router,
):
    app.include_router(router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


# The Lambda entry point (see the CMD in the Containerfile).
handler = Mangum(app, lifespan="off")
