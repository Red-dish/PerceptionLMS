from fastapi import APIRouter, HTTPException, Response, status

from app import db
from app.access import course_role, require_teacher
from app.auth import CurrentUser
from app.models import Announcement, AnnouncementCreate

router = APIRouter(prefix="/courses/{course_id}/announcements", tags=["announcements"])


@router.get("", response_model=list[Announcement])
def list_announcements(course_id: str, user: CurrentUser):
    course_role(course_id, user)
    announcements = db.query(f"COURSE#{course_id}", "ANNOUNCEMENT#", newest_first=True)
    # Pinned first, then newest first (the sort keeps the newest-first order within each group).
    return sorted(announcements, key=lambda announcement: not announcement["pinned"])


@router.post("", response_model=Announcement, status_code=status.HTTP_201_CREATED)
def post_announcement(course_id: str, body: AnnouncementCreate, user: CurrentUser):
    require_teacher(course_id, user)
    announcement_id = db.new_id()
    announcement = {
        **body.model_dump(),
        "id": announcement_id,
        "course_id": course_id,
        "author_name": user["name"],
        "created_at": db.now_iso(),
    }
    return db.put(db.announcement_key(course_id, announcement_id), announcement)


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(course_id: str, announcement_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    if db.get(db.announcement_key(course_id, announcement_id)) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Announcement not found")
    db.delete(db.announcement_key(course_id, announcement_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
