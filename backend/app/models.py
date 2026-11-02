"""Request and response shapes."""

from datetime import datetime
from typing import Annotated, Literal, Self

from pydantic import AwareDatetime, BaseModel, Field, model_validator

Role = Literal["student", "lecturer", "admin"]
CourseRole = Literal["student", "lecturer"]
MyCourseRole = Literal["student", "lecturer", "admin"]

Title = Annotated[str, Field(min_length=1, max_length=200)]


# Sign-in and users
class GoogleLogin(BaseModel):
    credential: str = Field(description="The ID token from Google's Sign in with Google button")


class User(BaseModel):
    id: str
    email: str
    name: str
    role: Role
    active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: User


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    name: str = Field(min_length=1, max_length=120)
    role: Role = "student"


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    role: Role | None = None
    active: bool | None = None


# Courses and enrolments
class Course(BaseModel):
    id: str
    code: str
    title: str
    term: str
    created_at: datetime


class CourseCreate(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    title: Title
    term: str = Field(min_length=1, max_length=50)


class MyCourse(Course):
    my_role: MyCourseRole


class Member(BaseModel):
    user_id: str
    name: str
    email: str
    role: CourseRole


class MemberSet(BaseModel):
    role: CourseRole = "student"


# Modules and materials
class Material(BaseModel):
    id: str
    module_id: str
    title: str
    file_name: str
    content_type: str
    created_at: datetime


class Module(BaseModel):
    id: str
    title: str
    published: bool
    created_at: datetime
    materials: list[Material] = []


class ModuleCreate(BaseModel):
    title: Title
    published: bool = False


class ModuleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    published: bool | None = None


class FileInfo(BaseModel):
    file_name: str = Field(min_length=1, max_length=200)
    content_type: str = Field(default="application/octet-stream", max_length=100)


class MaterialCreate(FileInfo):
    title: Title


class UploadTicket(BaseModel):
    """POST the file to url as multipart/form-data: every entry in fields, then the file as "file"."""

    url: str
    fields: dict[str, str]


class MaterialCreated(BaseModel):
    material: Material
    upload: UploadTicket


class CourseDetail(BaseModel):
    course: Course
    my_role: MyCourseRole
    modules: list[Module]


class DownloadLink(BaseModel):
    url: str


# Assignments, submissions and grades
class Assignment(BaseModel):
    id: str
    course_id: str
    title: str
    instructions: str
    due_at: datetime
    weight: int
    max_mark: int
    created_at: datetime


class AssignmentCreate(BaseModel):
    title: Title
    instructions: str = Field(default="", max_length=10_000)
    due_at: AwareDatetime
    weight: int = Field(default=0, ge=0, le=100, description="Percent of the final grade")
    max_mark: int = Field(default=100, ge=1, le=1000)


class AssignmentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    instructions: str | None = Field(default=None, max_length=10_000)
    due_at: AwareDatetime | None = None
    weight: int | None = Field(default=None, ge=0, le=100)
    max_mark: int | None = Field(default=None, ge=1, le=1000)


class Submission(BaseModel):
    assignment_id: str
    course_id: str
    student_id: str
    student_name: str
    text: str | None
    file_name: str | None
    submitted_at: datetime
    late: bool
    # Students only see mark and feedback once the lecturer releases them.
    mark: int | None = None
    feedback: str | None = None
    released: bool = False


class SubmissionCreate(BaseModel):
    text: str | None = Field(default=None, max_length=20_000)
    file: FileInfo | None = None

    @model_validator(mode="after")
    def needs_text_or_file(self) -> Self:
        if not (self.text and self.text.strip()) and self.file is None:
            raise ValueError("Add a file or type an answer")
        return self


class SubmissionCreated(BaseModel):
    submission: Submission
    upload: UploadTicket | None


class AssignmentView(Assignment):
    my_submission: Submission | None = None


class GradeSet(BaseModel):
    mark: int = Field(ge=0)
    feedback: str = Field(default="", max_length=5_000)
    release: bool = False


class Grade(BaseModel):
    course_id: str
    course_code: str
    assignment_id: str
    assignment_title: str
    weight: int
    max_mark: int
    mark: int
    feedback: str


# Announcements and dashboard
class Announcement(BaseModel):
    id: str
    course_id: str
    title: str
    body: str
    pinned: bool
    author_name: str
    created_at: datetime


class AnnouncementCreate(BaseModel):
    title: Title
    body: str = Field(min_length=1, max_length=10_000)
    pinned: bool = False


class Dashboard(BaseModel):
    courses: list[MyCourse]
    upcoming: list[Assignment]
    announcements: list[Announcement]
