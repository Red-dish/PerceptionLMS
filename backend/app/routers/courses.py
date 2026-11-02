from fastapi import APIRouter, HTTPException, Response, status

from app import db, storage
from app.access import course_role, my_courses, require_teacher
from app.auth import CurrentUser
from app.models import (
    CourseDetail,
    DownloadLink,
    MaterialCreate,
    MaterialCreated,
    Module,
    ModuleCreate,
    ModuleUpdate,
    MyCourse,
)

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
    modules = {item["id"]: {**item, "materials": []} for item in items if item["SK"].startswith("MODULE#")}
    for item in items:
        if item["SK"].startswith("MATERIAL#") and item["module_id"] in modules:
            modules[item["module_id"]]["materials"].append(item)
    # Students only see published modules.
    visible = [module for module in modules.values() if role != "student" or module["published"]]
    return {"course": course, "my_role": role, "modules": visible}


@router.post("/{course_id}/modules", response_model=Module, status_code=status.HTTP_201_CREATED)
def create_module(course_id: str, body: ModuleCreate, user: CurrentUser):
    require_teacher(course_id, user)
    module_id = db.new_id()
    module = {"id": module_id, "course_id": course_id, **body.model_dump(), "created_at": db.now_iso()}
    return db.put(db.module_key(course_id, module_id), module)


@router.patch("/{course_id}/modules/{module_id}", response_model=Module)
def update_module(course_id: str, module_id: str, body: ModuleUpdate, user: CurrentUser):
    require_teacher(course_id, user)
    module = _module_or_404(course_id, module_id)
    module.update(body.model_dump(exclude_none=True))
    return db.put(db.module_key(course_id, module_id), module)


@router.delete("/{course_id}/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(course_id: str, module_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    _module_or_404(course_id, module_id)
    for material in db.query(f"COURSE#{course_id}", f"MATERIAL#{module_id}#"):
        storage.delete_file(material["s3_key"])
        db.delete(db.material_key(course_id, module_id, material["id"]))
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
            "file_name": file_name,
            "content_type": body.content_type,
            "s3_key": s3_key,
            "created_at": db.now_iso(),
        },
    )
    return {"material": material, "upload": storage.upload_ticket(s3_key, body.content_type)}


@router.delete(
    "/{course_id}/modules/{module_id}/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_material(course_id: str, module_id: str, material_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    material = _material_or_404(course_id, module_id, material_id)
    storage.delete_file(material["s3_key"])
    db.delete(db.material_key(course_id, module_id, material_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{course_id}/modules/{module_id}/materials/{material_id}/download", response_model=DownloadLink)
def download_material(course_id: str, module_id: str, material_id: str, user: CurrentUser):
    role = course_role(course_id, user)
    module = _module_or_404(course_id, module_id)
    if role == "student" and not module["published"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material not found")
    material = _material_or_404(course_id, module_id, material_id)
    return {"url": storage.download_url(material["s3_key"], material["file_name"])}
