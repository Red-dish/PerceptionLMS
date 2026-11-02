from fastapi import APIRouter, HTTPException, Response, status

from app import db
from app.auth import AdminUser
from app.models import Course, CourseCreate, Member, MemberSet, User, UserCreate, UserUpdate

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[User])
def list_users(_: AdminUser):
    users = [db.strip_keys(item) for item in db.query(db.ORG, "USER#")]
    return sorted(users, key=lambda user: user["name"].lower())


@router.post("/users", response_model=User, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, _: AdminUser):
    if db.find_user_by_email(body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")
    return db.create_user(email=body.email, name=body.name, role=body.role)


@router.patch("/users/{user_id}", response_model=User)
def update_user(user_id: str, body: UserUpdate, admin: AdminUser):
    user = db.get_user(user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    changes = body.model_dump(exclude_none=True)
    if user_id == admin["id"] and (changes.get("active") is False or changes.get("role", "admin") != "admin"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot remove your own admin access")
    user.update(changes)
    db.save_user(user)
    if "name" in changes:
        # Enrolments keep a copy of the name for course member lists.
        for membership in db.query(f"USER#{user_id}", "COURSE#", by_gsi1=True):
            db.table().put_item(Item={**membership, "name": user["name"]})
    return user


@router.get("/courses", response_model=list[Course])
def list_courses(_: AdminUser):
    return sorted(db.query(db.ORG, "COURSE#"), key=lambda course: course["code"])


@router.post("/courses", response_model=Course, status_code=status.HTTP_201_CREATED)
def create_course(body: CourseCreate, _: AdminUser):
    code = body.code.strip().upper()
    if any(course["code"] == code for course in db.query(db.ORG, "COURSE#")):
        raise HTTPException(status.HTTP_409_CONFLICT, f"A course with code {code} already exists")
    course_id = db.new_id()
    course = {"id": course_id, "code": code, "title": body.title, "term": body.term, "created_at": db.now_iso()}
    return db.put(db.course_key(course_id), course)


@router.get("/courses/{course_id}/members", response_model=list[Member])
def list_members(course_id: str, _: AdminUser):
    if db.get(db.course_key(course_id)) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    return sorted(db.query(f"COURSE#{course_id}", "MEMBER#"), key=lambda member: member["name"].lower())


@router.put("/courses/{course_id}/members/{user_id}", response_model=Member)
def enrol(course_id: str, user_id: str, body: MemberSet, _: AdminUser):
    if db.get(db.course_key(course_id)) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    user = db.get_user(user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if not user["active"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This user is deactivated")
    member = {
        "course_id": course_id,
        "user_id": user_id,
        "name": user["name"],
        "email": user["email"],
        "role": body.role,
    }
    return db.put(db.member_key(course_id, user_id), member, gsi1=(f"USER#{user_id}", f"COURSE#{course_id}"))


@router.delete("/courses/{course_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def unenrol(course_id: str, user_id: str, _: AdminUser):
    db.delete(db.member_key(course_id, user_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
