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


class PageSummary(BaseModel):
    """A page without its content, for lists and module outlines."""

    id: str
    course_id: str
    title: str
    module_id: str | None = None
    published: bool
    position: int = 0
    created_at: datetime
    updated_at: datetime | None = None


class Page(PageSummary):
    body: str = Field(description="The page as HTML, already sanitised on save")
    author_name: str


class PageCreate(BaseModel):
    title: Title
    body: str = Field(
        default="",
        max_length=200_000,
        description="HTML from the rich-text editor. Anything unsafe (scripts, event handlers, "
        "javascript: links, embeds from unknown sites) is removed on save",
    )
    module_id: str | None = Field(default=None, description="Put the page in this module")
    published: bool = Field(default=False, description="Students only see published pages")


class PageUpdate(BaseModel):
    """Only the fields you send are changed. Send null for module_id to take the page out of its module."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = Field(default=None, max_length=200_000)
    module_id: str | None = None
    published: bool | None = None
    position: int | None = Field(default=None, ge=0)


class Module(BaseModel):
    id: str
    title: str
    published: bool
    position: int = 0
    created_at: datetime
    materials: list[Material] = []
    pages: list[PageSummary] = []


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
    # Quiz settings. Only used when kind is "quiz" and the quiz has questions.
    time_limit_minutes: int | None = Field(default=None, description="Empty means no time limit")
    shuffle_answers: bool = False
    show_score: bool = Field(default=True, description="Students see their score as soon as they submit")
    show_correct_answers: bool = Field(default=False, description="Students see the right answers after submitting")
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
    time_limit_minutes: int | None = Field(default=None, ge=1, le=600)
    shuffle_answers: bool = False
    show_score: bool = True
    show_correct_answers: bool = False

    @model_validator(mode="after")
    def window_makes_sense(self) -> Self:
        check_window(self.available_from, self.due_at, self.available_until)
        return self


class AssignmentUpdate(BaseModel):
    """Only the fields you send are changed. Send null for available_from, available_until,
    module_id, max_attempts or time_limit_minutes to clear it."""

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
    time_limit_minutes: int | None = Field(default=None, ge=1, le=600)
    shuffle_answers: bool | None = None
    show_score: bool | None = None
    show_correct_answers: bool | None = None


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


# Quizzes. A quiz is an assignment with kind "quiz"; its score is saved as the
# student's submission, so it shows in the gradebook and the student's grades.
QuestionType = Literal["multiple_choice", "true_false", "short_answer"]
AttemptStatus = Literal["in_progress", "submitted", "graded"]
Answer = bool | str | list[str]
AcceptedAnswer = Annotated[str, Field(min_length=1, max_length=500)]


class OptionCreate(BaseModel):
    text: str = Field(min_length=1, max_length=1_000)
    correct: bool = False


class Option(BaseModel):
    id: str
    text: str
    correct: bool | None = Field(default=None, description="Only shown to lecturers, or after submitting if allowed")


def check_question(kind: str, options: list | None, answer: bool | None, accepted_answers: list | None) -> None:
    """Each type has its own answer field, and only that one."""
    if kind != "multiple_choice" and options is not None:
        raise ValueError("Only multiple-choice questions have options")
    if kind != "true_false" and answer is not None:
        raise ValueError("Only true/false questions have answer")
    if kind != "short_answer" and accepted_answers is not None:
        raise ValueError("Only short-answer questions have accepted_answers")
    if kind == "multiple_choice":
        if not options or not 2 <= len(options) <= 10:
            raise ValueError("A multiple-choice question needs 2 to 10 options")
        if not any(option["correct"] if isinstance(option, dict) else option.correct for option in options):
            raise ValueError("Mark at least one option as correct")
    elif kind == "true_false" and answer is None:
        raise ValueError("Set answer to true or false")


class QuestionCreate(BaseModel):
    type: QuestionType
    text: str = Field(min_length=1, max_length=5_000, description="The question, as Markdown")
    points: int = Field(default=1, ge=0, le=100)
    options: list[OptionCreate] | None = Field(
        default=None, description="Multiple choice only: 2 to 10 options, at least one correct"
    )
    answer: bool | None = Field(default=None, description="True/false only: the right answer")
    accepted_answers: list[AcceptedAnswer] | None = Field(
        default=None,
        description="Short answer only: answers marked right automatically (case and spacing ignored). "
        "Anything else is left for the lecturer to mark",
    )

    @model_validator(mode="after")
    def fits_type(self) -> Self:
        check_question(self.type, self.options, self.answer, self.accepted_answers)
        return self


class QuestionUpdate(BaseModel):
    """Only the fields you send are changed. Once students have started the quiz, only text can change."""

    text: str | None = Field(default=None, min_length=1, max_length=5_000)
    points: int | None = Field(default=None, ge=0, le=100)
    options: list[OptionCreate] | None = None
    answer: bool | None = None
    accepted_answers: list[AcceptedAnswer] | None = None


class Question(BaseModel):
    id: str
    quiz_id: str
    type: QuestionType
    text: str
    points: int
    position: int
    options: list[Option] | None = None
    answer: bool | None = Field(default=None, description="True/false: only shown to lecturers")
    accepted_answers: list[str] | None = Field(default=None, description="Short answer: only shown to lecturers")


class QuestionOrder(BaseModel):
    question_ids: list[str] = Field(description="Every question ID in the quiz, in the order to show them")


class QuestionResult(BaseModel):
    points: int = Field(description="Points awarded")
    max_points: int
    correct: bool | None = Field(description="Empty while a short answer waits for marking")
    needs_marking: bool = False


class QuizAttempt(BaseModel):
    id: str
    quiz_id: str
    course_id: str
    student_id: str
    student_name: str
    number: int
    status: AttemptStatus
    started_at: datetime
    deadline: datetime | None = Field(description="When time runs out. Empty means no time limit")
    seconds_left: int | None = Field(default=None, description="While in progress with a time limit")
    submitted_at: datetime | None = None
    auto_submitted: bool = Field(default=False, description="Time ran out, so the saved answers were submitted")
    late: bool = False
    days_late: int = 0
    score: int | None = Field(default=None, description="Hidden from students until the score is released")
    max_score: int
    needs_marking: int = Field(default=0, description="Short answers waiting for the lecturer")
    questions: list[Question] = Field(default=[], description="In the order this student sees them")
    answers: dict[str, Answer] = Field(default={}, description="Keyed by question ID")
    results: dict[str, QuestionResult] | None = Field(
        default=None, description="Keyed by question ID. Hidden from students until the score is released"
    )


class AnswersSave(BaseModel):
    answers: dict[str, Answer] = Field(
        default={},
        description="Keyed by question ID. Multiple choice: a list of option IDs. True/false: true or false. "
        "Short answer: text. Merged with answers saved earlier",
    )


class QuestionMarks(BaseModel):
    marks: dict[str, Annotated[int, Field(ge=0)]] = Field(
        description="Points for each question ID, usually the short answers"
    )


class QuizView(Assignment):
    question_count: int
    # Lecturers only.
    questions: list[Question] | None = None
    # Students only.
    my_attempts: list[QuizAttempt] | None = None
    attempts_left: int | None = Field(default=None, description="Empty means unlimited")
    can_start: bool | None = None


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
