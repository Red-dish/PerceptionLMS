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


# Modules (folders) and materials (course files)
Folder = Annotated[
    str,
    Field(
        default="",
        max_length=200,
        pattern=r"^[^/\\]+(/[^/\\]+)*$|^$",
        description='Folder path inside the course, such as "Week 1/Slides". Empty means the top level',
    ),
]


class Material(BaseModel):
    id: str
    module_id: str
    title: str
    description: str = ""
    folder: str = ""
    file_name: str
    content_type: str
    position: int = 0
    created_at: datetime
    updated_at: datetime | None = None


class Module(BaseModel):
    id: str
    title: str
    published: bool
    position: int = 0
    created_at: datetime
    materials: list[Material] = []


class ModuleCreate(BaseModel):
    title: Title
    published: bool = False


class ModuleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    published: bool | None = None
    position: int | None = Field(default=None, ge=0)


class ModuleOrder(BaseModel):
    module_ids: list[str] = Field(description="Every module ID in the course, in the order to show them")


class FileInfo(BaseModel):
    file_name: str = Field(min_length=1, max_length=200)
    content_type: str = Field(default="application/octet-stream", max_length=100)


class MaterialCreate(FileInfo):
    title: Title
    description: str = Field(default="", max_length=2_000)
    folder: Folder = ""


class MaterialUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2_000)
    folder: Annotated[str, Field(max_length=200, pattern=r"^[^/\\]+(/[^/\\]+)*$|^$")] | None = None
    position: int | None = Field(default=None, ge=0)
    module_id: str | None = Field(default=None, description="Move the file into this module")


class UploadTicket(BaseModel):
    """POST the file to url as multipart/form-data: every entry in fields, then the file as "file"."""

    url: str
    fields: dict[str, str]


class MaterialCreated(BaseModel):
    material: Material
    upload: UploadTicket


class CourseFile(Material):
    module_title: str
    module_published: bool


class CourseDetail(BaseModel):
    course: Course
    my_role: MyCourseRole
    modules: list[Module]


class DownloadLink(BaseModel):
    url: str


# Assignments, submissions and grades
AssignmentKind = Literal["assignment", "quiz"]
SubmissionType = Literal["file", "text", "both", "none"]
WorkStatus = Literal["graded", "submitted", "missing", "upcoming"]


def check_window(available_from: datetime | None, due_at: datetime | None, available_until: datetime | None) -> None:
    if available_from and due_at and available_from > due_at:
        raise ValueError("The assignment must open before it is due")
    if available_until and due_at and available_until < due_at:
        raise ValueError("Submissions can't close before the due date")
    if available_from and available_until and available_from >= available_until:
        raise ValueError("The assignment must open before it closes")


Instructions = Annotated[
    str, Field(max_length=10_000, description="Rich text as Markdown. The frontend renders it safely")
]


class Assignment(BaseModel):
    id: str
    course_id: str
    kind: AssignmentKind = "assignment"
    title: str
    instructions: str
    submission_type: SubmissionType = Field(
        default="both", description='What students hand in: a file, typed text, either ("both"), or nothing online'
    )
    published: bool = True
    module_id: str | None = None
    due_at: datetime
    # Students can't see the assignment before available_from or submit after available_until.
    available_from: datetime | None = None
    available_until: datetime | None = None
    weight: int
    max_mark: int = Field(description="Points possible")
    late_penalty_percent: int = Field(default=0, description="Percent of the mark taken off for each day late")
    max_attempts: int | None = Field(default=None, description="Empty means unlimited until marked")
    created_at: datetime
    updated_at: datetime | None = None


class AssignmentCreate(BaseModel):
    kind: AssignmentKind = "assignment"
    title: Title
    instructions: Instructions = ""
    submission_type: SubmissionType = "both"
    published: bool = True
    module_id: str | None = None
    due_at: AwareDatetime
    available_from: AwareDatetime | None = None
    available_until: AwareDatetime | None = None
    weight: int = Field(default=0, ge=0, le=100, description="Percent of the final grade")
    max_mark: int = Field(default=100, ge=1, le=1000, description="Points possible")
    late_penalty_percent: int = Field(default=0, ge=0, le=100)
    max_attempts: int | None = Field(default=None, ge=1, le=50)

    @model_validator(mode="after")
    def window_makes_sense(self) -> Self:
        check_window(self.available_from, self.due_at, self.available_until)
        return self


class AssignmentUpdate(BaseModel):
    """Only the fields you send are changed. Send null for available_from, available_until,
    module_id or max_attempts to clear it."""

    kind: AssignmentKind | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    instructions: str | None = Field(default=None, max_length=10_000)
    submission_type: SubmissionType | None = None
    published: bool | None = None
    module_id: str | None = None
    due_at: AwareDatetime | None = None
    available_from: AwareDatetime | None = None
    available_until: AwareDatetime | None = None
    weight: int | None = Field(default=None, ge=0, le=100)
    max_mark: int | None = Field(default=None, ge=1, le=1000)
    late_penalty_percent: int | None = Field(default=None, ge=0, le=100)
    max_attempts: int | None = Field(default=None, ge=1, le=50)


class Attempt(BaseModel):
    """An earlier attempt, kept when a student resubmits. Its file stays downloadable."""

    attempt: int
    submitted_at: datetime | None
    text: str | None = None
    file_name: str | None = None
    late: bool = False
    mark: int | None = None
    feedback: str | None = None


class Submission(BaseModel):
    assignment_id: str
    course_id: str
    student_id: str
    student_name: str
    text: str | None = None
    file_name: str | None = None
    # Empty when the lecturer entered a mark without a submission (for example, a quiz done in class).
    submitted_at: datetime | None = None
    late: bool = False
    days_late: int = 0
    attempt: int = 1
    # Students only see mark and feedback once the lecturer releases them.
    mark: int | None = None
    final_mark: int | None = Field(default=None, description="The mark after any late penalty")
    feedback: str | None = None
    released: bool = False
    graded_at: datetime | None = None
    history: list[Attempt] = []


class Grant(BaseModel):
    """A lecturer lets one student submit again, or later than the window allows."""

    assignment_id: str
    course_id: str
    student_id: str
    student_name: str
    until: datetime | None = Field(description="The new deadline. Empty means open until the lecturer removes it")
    note: str = ""
    granted_by: str
    granted_at: datetime


class GrantSet(BaseModel):
    until: AwareDatetime | None = None
    note: str = Field(default="", max_length=1_000)


class ReleaseSet(BaseModel):
    release: bool = True


class ReleaseResult(BaseModel):
    updated: int


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
    # Filled in for students only.
    my_submission: Submission | None = None
    my_grant: Grant | None = None
    accepting_submissions: bool | None = None


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
    final_mark: int | None = Field(default=None, description="The mark after any late penalty")
    feedback: str


# Gradebook
class GradebookColumn(BaseModel):
    id: str
    kind: AssignmentKind
    title: str
    due_at: datetime
    weight: int
    max_mark: int
    graded: int
    released: int
    average_percent: float | None


class GradebookCell(BaseModel):
    status: WorkStatus
    mark: int | None = None
    final_mark: int | None = Field(default=None, description="After any late penalty; totals use this")
    released: bool = False
    late: bool = False
    submitted_at: datetime | None = None
    has_grant: bool = False


class GradebookRow(BaseModel):
    student_id: str
    name: str
    email: str
    cells: dict[str, GradebookCell] = Field(description="Keyed by assignment ID")
    points_earned: int
    points_possible: int = Field(description="Points of the work marked so far")
    percent: float | None = Field(description="Points earned out of points marked")
    weighted_percent: float | None = Field(description="Average of marked work, using each item's weight")
    missing: int
    late: int


class Gradebook(BaseModel):
    course: Course
    columns: list[GradebookColumn]
    rows: list[GradebookRow]


# Late and missing work
class WorkItem(BaseModel):
    course_id: str
    course_code: str
    assignment_id: str
    assignment_title: str
    kind: AssignmentKind
    due_at: datetime
    student_id: str
    student_name: str
    student_email: str
    status: Literal["missing", "late"]
    submitted_at: datetime | None = None
    days_late: int
    mark: int | None = None
    grant: Grant | None = None


class WorkReport(BaseModel):
    missing: int
    late: int
    items: list[WorkItem]


# Announcements and dashboard
class Announcement(BaseModel):
    id: str
    course_id: str
    title: str
    body: str
    pinned: bool
    author_name: str
    created_at: datetime
    # Students don't see an announcement until publish_at.
    publish_at: datetime | None = None
    updated_at: datetime | None = None


class AnnouncementCreate(BaseModel):
    title: Title
    body: str = Field(min_length=1, max_length=10_000)
    pinned: bool = False
    publish_at: AwareDatetime | None = Field(default=None, description="Leave empty to publish straight away")


class AnnouncementUpdate(BaseModel):
    """Only the fields you send are changed. Send null for publish_at to publish straight away."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = Field(default=None, min_length=1, max_length=10_000)
    pinned: bool | None = None
    publish_at: AwareDatetime | None = None


class Dashboard(BaseModel):
    courses: list[MyCourse]
    upcoming: list[Assignment]
    announcements: list[Announcement]
