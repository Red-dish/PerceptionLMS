from fastapi import APIRouter, HTTPException, Response, status

from app import coursework as cw
from app import db
from app.access import course_role, require_teacher
from app.auth import CurrentUser
from app.models import Announcement, AnnouncementCreate, AnnouncementUpdate

router = APIRouter(prefix="/courses/{course_id}/announcements", tags=["announcements"])


def is_published(announcement: dict) -> bool:
    publish_at = cw.parse(announcement.get("publish_at"))
    return publish_at is None or publish_at <= cw.now()


def shown_at(announcement: dict) -> str:
    """When readers first saw it: the scheduled time if there was one."""
    return announcement.get("publish_at") or announcement["created_at"]


def _announcement_or_404(course_id: str, announcement_id: str) -> dict:
    announcement = db.get(db.announcement_key(course_id, announcement_id))
    if announcement is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Announcement not found")
    return db.strip_keys(announcement)


@router.get("", response_model=list[Announcement])
def list_announcements(course_id: str, user: CurrentUser):
    """Pinned first, then newest first. Students don't see scheduled announcements until they publish."""
    role = course_role(course_id, user)
    announcements = db.query(f"COURSE#{course_id}", "ANNOUNCEMENT#")
    if role == "student":
        announcements = [announcement for announcement in announcements if is_published(announcement)]
    announcements.sort(key=shown_at, reverse=True)
    return sorted(announcements, key=lambda announcement: not announcement["pinned"])


@router.post("", response_model=Announcement, status_code=status.HTTP_201_CREATED)
def post_announcement(course_id: str, body: AnnouncementCreate, user: CurrentUser):
    require_teacher(course_id, user)
    announcement_id = db.new_id()
    announcement = {
        **body.model_dump(),
        "id": announcement_id,
        "course_id": course_id,
        "publish_at": cw.utc_iso(body.publish_at),
        "author_id": user["id"],
        "author_name": user["name"],
        "created_at": db.now_iso(),
    }
    return db.put(db.announcement_key(course_id, announcement_id), announcement)


@router.patch("/{announcement_id}", response_model=Announcement)
def edit_announcement(course_id: str, announcement_id: str, body: AnnouncementUpdate, user: CurrentUser):
    require_teacher(course_id, user)
    announcement = _announcement_or_404(course_id, announcement_id)
    changes = body.model_dump(exclude_unset=True)
    changes = {name: value for name, value in changes.items() if value is not None or name == "publish_at"}
    if "publish_at" in changes:
        changes["publish_at"] = cw.utc_iso(changes["publish_at"])
    announcement.update(changes, updated_at=db.now_iso())
    return db.put(db.announcement_key(course_id, announcement_id), announcement)


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(course_id: str, announcement_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    _announcement_or_404(course_id, announcement_id)
    db.delete(db.announcement_key(course_id, announcement_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
