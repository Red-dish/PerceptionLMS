"""Rich-text content pages inside a course.

Lecturers write pages in a rich-text editor; the HTML is sanitised before it is
saved (see app/rich_text.py). A page can sit in a module, next to its files, or on
its own. Students only see a page when it is published and, if it's in a module,
the module is published too.

A page can also link course files (file_ids). Linking doesn't change who can see a
file: students only get linked files whose module is published, the same rule as
everywhere else.
"""

from fastapi import APIRouter, HTTPException, Response, status

from app import db
from app.access import course_role, require_teacher
from app.auth import CurrentUser
from app.models import Page, PageCreate, PageSummary, PageUpdate
from app.rich_text import sanitise

router = APIRouter(prefix="/courses/{course_id}/pages", tags=["pages"])


def published_module_ids(course_id: str) -> set[str]:
    return {module["id"] for module in db.query(f"COURSE#{course_id}", "MODULE#") if module["published"]}


def visible_to_students(page: dict, published_modules: set[str]) -> bool:
    return bool(page["published"]) and (not page.get("module_id") or page["module_id"] in published_modules)


def course_pages(course_id: str) -> list[dict]:
    pages = [db.strip_keys(page) for page in db.query(f"COURSE#{course_id}", "PAGE#")]
    return sorted(pages, key=lambda page: (int(page.get("position", 0)), page["created_at"]))


def _module_must_exist(course_id: str, module_id: str | None) -> None:
    if module_id and db.get(db.module_key(course_id, module_id)) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "That module doesn't exist in this course")


def _next_position(course_id: str, module_id: str | None) -> int:
    return sum(1 for page in db.query(f"COURSE#{course_id}", "PAGE#") if page.get("module_id") == module_id)


def _course_files(course_id: str) -> dict[str, dict]:
    return {material["id"]: material for material in db.query(f"COURSE#{course_id}", "MATERIAL#")}


def _check_files(course_id: str, file_ids: list[str]) -> list[str]:
    """The IDs once each, in order. Every one must be a file in this course."""
    unique = list(dict.fromkeys(file_ids))
    files = _course_files(course_id)
    missing = [file_id for file_id in unique if file_id not in files]
    if missing:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"These files aren't in this course: {', '.join(missing)}"
        )
    return unique


def with_files(page: dict, role: str) -> dict:
    """The page with its linked files. Files deleted since, and (for students) files in
    unpublished modules, are left out."""
    course_id = page["course_id"]
    file_ids = page.get("file_ids") or []
    if not file_ids:
        return {**page, "files": []}
    files = _course_files(course_id)
    published = published_module_ids(course_id)
    linked = []
    for file_id in file_ids:
        material = files.get(file_id)
        if material is None:
            continue
        visible = material["module_id"] in published
        if role == "student" and not visible:
            continue
        linked.append(
            {
                "id": material["id"],
                "module_id": material["module_id"],
                "title": material["title"],
                "file_name": material["file_name"],
                "content_type": material["content_type"],
                "folder": material.get("folder", ""),
                "download_path": (
                    f"/courses/{course_id}/modules/{material['module_id']}/materials/{material['id']}/download"
                ),
                "visible_to_students": visible,
            }
        )
    return {**page, "files": linked}


def unlink_files(course_id: str, file_ids: set[str]) -> None:
    """Take deleted files off every page that linked them."""
    for page in db.query(f"COURSE#{course_id}", "PAGE#"):
        current = page.get("file_ids") or []
        if any(file_id in file_ids for file_id in current):
            kept = [file_id for file_id in current if file_id not in file_ids]
            db.put(db.page_key(course_id, page["id"]), {**db.strip_keys(page), "file_ids": kept})


def _page_or_404(course_id: str, page_id: str, role: str) -> dict:
    page = db.get(db.page_key(course_id, page_id))
    # Students can't tell a hidden page exists.
    if page is None or (role == "student" and not visible_to_students(page, published_module_ids(course_id))):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Page not found")
    return db.strip_keys(page)


@router.get("", response_model=list[PageSummary])
def list_pages(course_id: str, user: CurrentUser, module_id: str | None = None):
    """Every page in the course, without content. Pass module_id to list one module's pages."""
    role = course_role(course_id, user)
    pages = course_pages(course_id)
    if role == "student":
        published = published_module_ids(course_id)
        pages = [page for page in pages if visible_to_students(page, published)]
    if module_id:
        pages = [page for page in pages if page.get("module_id") == module_id]
    return pages


@router.post("", response_model=Page, status_code=status.HTTP_201_CREATED)
def create_page(course_id: str, body: PageCreate, user: CurrentUser):
    require_teacher(course_id, user)
    _module_must_exist(course_id, body.module_id)
    page_id = db.new_id()
    page = {
        "id": page_id,
        "course_id": course_id,
        "title": body.title,
        "body": sanitise(body.body),
        "module_id": body.module_id,
        "published": body.published,
        "position": _next_position(course_id, body.module_id),
        "file_ids": _check_files(course_id, body.file_ids or []),
        "author_id": user["id"],
        "author_name": user["name"],
        "created_at": db.now_iso(),
        "updated_at": None,
    }
    return with_files(db.put(db.page_key(course_id, page_id), page), "lecturer")


@router.get("/{page_id}", response_model=Page)
def get_page(course_id: str, page_id: str, user: CurrentUser):
    role = course_role(course_id, user)
    return with_files(_page_or_404(course_id, page_id, role), role)


@router.patch("/{page_id}", response_model=Page)
def update_page(course_id: str, page_id: str, body: PageUpdate, user: CurrentUser):
    require_teacher(course_id, user)
    page = _page_or_404(course_id, page_id, "lecturer")
    changes = body.model_dump(exclude_unset=True)
    # null only means "remove" for module_id; for other fields it means "leave as it is".
    changes = {name: value for name, value in changes.items() if value is not None or name == "module_id"}
    if "module_id" in changes and changes["module_id"] != page.get("module_id"):
        _module_must_exist(course_id, changes["module_id"])
        changes.setdefault("position", _next_position(course_id, changes["module_id"]))
    if "body" in changes:
        changes["body"] = sanitise(changes["body"])
    if "file_ids" in changes:
        changes["file_ids"] = _check_files(course_id, changes["file_ids"])
    page.update(changes, updated_at=db.now_iso())
    return with_files(db.put(db.page_key(course_id, page_id), page), "lecturer")


@router.delete("/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_page(course_id: str, page_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    _page_or_404(course_id, page_id, "lecturer")
    db.delete(db.page_key(course_id, page_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
