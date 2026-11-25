from fastapi import APIRouter, HTTPException, Response, status

from app import db, storage
from app.routers.pages import unlink_files
from app.access import course_role, my_courses, require_teacher
from app.auth import CurrentUser
from app.models import (
    CourseDetail,
    CourseFile,
    DownloadLink,
    FileInfo,
    Material,
    MaterialCreate,
    MaterialCreated,
    MaterialUpdate,
    Module,
    ModuleCreate,
    ModuleOrder,
    ModuleUpdate,
    MyCourse,
    UploadTicket,
)


def _ordered(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda item: (int(item.get("position", 0)), item["created_at"]))

router = APIRouter(prefix="/courses", tags=["courses"])


def _module_or_404(course_id: str, module_id: str) -> dict:
    module = db.get(db.module_key(course_id, module_id))
    if module is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found")
    return db.strip_keys(module)


def _material_or_404(course_id: str, module_id: str, material_id: str) -> dict:
    material = db.get(db.material_key(course_id, module_id, material_id))
    if material is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material not found")
    return material


@router.get("", response_model=list[MyCourse])
def list_my_courses(user: CurrentUser):
    return sorted(my_courses(user), key=lambda course: course["code"])


@router.get("/{course_id}", response_model=CourseDetail)
def get_course(course_id: str, user: CurrentUser):
    role = course_role(course_id, user)
    course = db.get(db.course_key(course_id))
    items = db.query(f"COURSE#{course_id}")
    modules = {
        item["id"]: {**item, "materials": [], "pages": []} for item in items if item["SK"].startswith("MODULE#")
    }
    for item in items:
        if item["SK"].startswith("MATERIAL#") and item["module_id"] in modules:
            modules[item["module_id"]]["materials"].append(item)
        # Pages show in their module's outline; students only see published ones.
        elif item["SK"].startswith("PAGE#") and item.get("module_id") in modules:
            if role != "student" or item["published"]:
                modules[item["module_id"]]["pages"].append(item)
    # Students only see published modules.
    visible = [module for module in modules.values() if role != "student" or module["published"]]
    for module in visible:
        module["materials"] = _ordered(module["materials"])
        module["pages"] = _ordered(module["pages"])
    return {"course": course, "my_role": role, "modules": _ordered(visible)}


@router.get("/{course_id}/files", response_model=list[CourseFile])
def list_files(course_id: str, user: CurrentUser, folder: str | None = None):
    """Every file in the course, sorted by folder then title. Students see files in published modules only.

    Pass folder to list one folder and everything inside it.
    """
    role = course_role(course_id, user)
    modules = {module["id"]: module for module in db.query(f"COURSE#{course_id}", "MODULE#")}
    files = []
    for material in db.query(f"COURSE#{course_id}", "MATERIAL#"):
        module = modules.get(material["module_id"])
        if module is None or (role == "student" and not module["published"]):
            continue
        path = material.get("folder", "")
        if folder and path != folder and not path.startswith(f"{folder}/"):
            continue
        files.append({**material, "module_title": module["title"], "module_published": module["published"]})
    return sorted(files, key=lambda f: (f.get("folder", "").lower(), f["title"].lower()))


@router.post("/{course_id}/modules", response_model=Module, status_code=status.HTTP_201_CREATED)
def create_module(course_id: str, body: ModuleCreate, user: CurrentUser):
    require_teacher(course_id, user)
    module_id = db.new_id()
    position = len(db.query(f"COURSE#{course_id}", "MODULE#"))
    module = {
        "id": module_id,
        "course_id": course_id,
        **body.model_dump(),
        "position": position,
        "created_at": db.now_iso(),
    }
    return db.put(db.module_key(course_id, module_id), module)


@router.put("/{course_id}/modules/order", response_model=list[Module])
def reorder_modules(course_id: str, body: ModuleOrder, user: CurrentUser):
    """Set the order modules are shown in, for example after dragging them."""
    require_teacher(course_id, user)
    modules = {module["id"]: db.strip_keys(module) for module in db.query(f"COURSE#{course_id}", "MODULE#")}
    if sorted(body.module_ids) != sorted(modules):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "List every module in the course exactly once")
    ordered = []
    for position, module_id in enumerate(body.module_ids):
        module = {**modules[module_id], "position": position}
        ordered.append(db.put(db.module_key(course_id, module_id), module))
    return ordered


@router.patch("/{course_id}/modules/{module_id}", response_model=Module)
def update_module(course_id: str, module_id: str, body: ModuleUpdate, user: CurrentUser):
    require_teacher(course_id, user)
    module = _module_or_404(course_id, module_id)
    module.update(body.model_dump(exclude_none=True))
    return db.put(db.module_key(course_id, module_id), module)


@router.delete("/{course_id}/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(course_id: str, module_id: str, user: CurrentUser):
    """Deletes the module and its files. Its pages are kept, moved out of the module and unpublished."""
    require_teacher(course_id, user)
    _module_or_404(course_id, module_id)
    deleted = set()
    for material in db.query(f"COURSE#{course_id}", f"MATERIAL#{module_id}#"):
        storage.delete_file(material["s3_key"])
        db.delete(db.material_key(course_id, module_id, material["id"]))
        deleted.add(material["id"])
    unlink_files(course_id, deleted)
    # Pages are kept: they leave the module and are unpublished, so nothing hidden becomes visible.
    for page in db.query(f"COURSE#{course_id}", "PAGE#"):
        if page.get("module_id") == module_id:
            moved = {**db.strip_keys(page), "module_id": None, "published": False, "updated_at": db.now_iso()}
            db.put(db.page_key(course_id, page["id"]), moved)
    db.delete(db.module_key(course_id, module_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{course_id}/modules/{module_id}/materials",
    response_model=MaterialCreated,
    status_code=status.HTTP_201_CREATED,
)
def add_material(course_id: str, module_id: str, body: MaterialCreate, user: CurrentUser):
    """Saves the material and returns a signed form for uploading its file to S3."""
    require_teacher(course_id, user)
    _module_or_404(course_id, module_id)
    storage.check_file_type(body.file_name)
    material_id = db.new_id()
    file_name = storage.safe_file_name(body.file_name)
    s3_key = f"courses/{course_id}/materials/{material_id}/{file_name}"
    material = db.put(
        db.material_key(course_id, module_id, material_id),
        {
            "id": material_id,
            "course_id": course_id,
            "module_id": module_id,
            "title": body.title,
            "description": body.description,
            "folder": body.folder,
            "file_name": file_name,
            "content_type": body.content_type,
            "s3_key": s3_key,
            "position": len(db.query(f"COURSE#{course_id}", f"MATERIAL#{module_id}#")),
            "created_at": db.now_iso(),
        },
    )
    return {"material": material, "upload": storage.upload_ticket(s3_key, body.content_type)}


@router.patch("/{course_id}/modules/{module_id}/materials/{material_id}", response_model=Material)
def update_material(course_id: str, module_id: str, material_id: str, body: MaterialUpdate, user: CurrentUser):
    """Rename a file, change its description or folder, reorder it, or move it to another module."""
    require_teacher(course_id, user)
    material = db.strip_keys(_material_or_404(course_id, module_id, material_id))
    changes = body.model_dump(exclude_none=True)
    target = changes.pop("module_id", module_id)
    if target != module_id:
        _module_or_404(course_id, target)
        db.delete(db.material_key(course_id, module_id, material_id))
        if "position" not in changes:
            changes["position"] = len(db.query(f"COURSE#{course_id}", f"MATERIAL#{target}#"))
    material.update(changes, module_id=target, updated_at=db.now_iso())
    return db.put(db.material_key(course_id, target, material_id), material)


@router.post("/{course_id}/modules/{module_id}/materials/{material_id}/file", response_model=UploadTicket)
def replace_material_file(course_id: str, module_id: str, material_id: str, body: FileInfo, user: CurrentUser):
    """Swap in a new version of the file. Upload it with the returned signed form."""
    require_teacher(course_id, user)
    material = db.strip_keys(_material_or_404(course_id, module_id, material_id))
    storage.check_file_type(body.file_name)
    storage.delete_file(material["s3_key"])
    file_name = storage.safe_file_name(body.file_name)
    s3_key = f"courses/{course_id}/materials/{material_id}/{db.new_id()}/{file_name}"
    material.update(file_name=file_name, content_type=body.content_type, s3_key=s3_key, updated_at=db.now_iso())
    db.put(db.material_key(course_id, module_id, material_id), material)
    return storage.upload_ticket(s3_key, body.content_type)


@router.delete(
    "/{course_id}/modules/{module_id}/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_material(course_id: str, module_id: str, material_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    material = _material_or_404(course_id, module_id, material_id)
    storage.delete_file(material["s3_key"])
    db.delete(db.material_key(course_id, module_id, material_id))
    unlink_files(course_id, {material_id})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{course_id}/modules/{module_id}/materials/{material_id}/download", response_model=DownloadLink)
def download_material(course_id: str, module_id: str, material_id: str, user: CurrentUser):
    role = course_role(course_id, user)
    module = _module_or_404(course_id, module_id)
    if role == "student" and not module["published"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material not found")
    material = _material_or_404(course_id, module_id, material_id)
    return {"url": storage.download_url(material["s3_key"], material["file_name"])}
