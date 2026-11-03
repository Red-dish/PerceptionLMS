from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status

from app import db, storage
from app.access import course_role, require_student, require_teacher
from app.auth import CurrentUser
from app.models import (
    Assignment,
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentView,
    DownloadLink,
    GradeSet,
    Submission,
    SubmissionCreate,
    SubmissionCreated,
)

router = APIRouter(prefix="/courses/{course_id}/assignments", tags=["assignments"])


def _utc_iso(moment: datetime) -> str:
    return moment.astimezone(UTC).isoformat(timespec="seconds")


def _assignment_or_404(course_id: str, assignment_id: str) -> dict:
    assignment = db.get(db.assignment_key(course_id, assignment_id))
    if assignment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    return db.strip_keys(assignment)


def _submission_or_404(assignment_id: str, student_id: str) -> dict:
    submission = db.get(db.submission_key(assignment_id, student_id))
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    return db.strip_keys(submission)


def _save_submission(submission: dict) -> dict:
    return db.put(
        db.submission_key(submission["assignment_id"], submission["student_id"]),
        submission,
        gsi1=(f"USER#{submission['student_id']}", f"SUBMISSION#{submission['assignment_id']}"),
    )


def _student_view(submission: dict | None) -> dict | None:
    """Hide the mark and feedback from the student until the lecturer releases them."""
    if submission is None or submission.get("released"):
        return submission
    return {**submission, "mark": None, "feedback": None}


def _with_my_submission(assignment: dict, role: str, user: dict) -> dict:
    if role != "student":
        return assignment
    submission = db.get(db.submission_key(assignment["id"], user["id"]))
    return {**assignment, "my_submission": _student_view(submission and db.strip_keys(submission))}


@router.get("", response_model=list[AssignmentView])
def list_assignments(course_id: str, user: CurrentUser):
    role = course_role(course_id, user)
    assignments = sorted(db.query(f"COURSE#{course_id}", "ASSIGNMENT#"), key=lambda a: a["due_at"])
    return [_with_my_submission(db.strip_keys(assignment), role, user) for assignment in assignments]


@router.post("", response_model=Assignment, status_code=status.HTTP_201_CREATED)
def create_assignment(course_id: str, body: AssignmentCreate, user: CurrentUser):
    require_teacher(course_id, user)
    assignment_id = db.new_id()
    assignment = {
        **body.model_dump(),
        "id": assignment_id,
        "course_id": course_id,
        "due_at": _utc_iso(body.due_at),
        "created_at": db.now_iso(),
    }
    return db.put(db.assignment_key(course_id, assignment_id), assignment)


@router.get("/{assignment_id}", response_model=AssignmentView)
def get_assignment(course_id: str, assignment_id: str, user: CurrentUser):
    role = course_role(course_id, user)
    return _with_my_submission(_assignment_or_404(course_id, assignment_id), role, user)


@router.patch("/{assignment_id}", response_model=Assignment)
def update_assignment(course_id: str, assignment_id: str, body: AssignmentUpdate, user: CurrentUser):
    require_teacher(course_id, user)
    assignment = _assignment_or_404(course_id, assignment_id)
    changes = body.model_dump(exclude_none=True)
    if body.due_at is not None:
        changes["due_at"] = _utc_iso(body.due_at)
    assignment.update(changes)
    return db.put(db.assignment_key(course_id, assignment_id), assignment)


@router.post("/{assignment_id}/submission", response_model=SubmissionCreated, status_code=status.HTTP_201_CREATED)
def submit(course_id: str, assignment_id: str, body: SubmissionCreate, user: CurrentUser):
    """Submit or resubmit. If a file is included, upload it with the returned signed form."""
    require_student(course_id, user)
    assignment = _assignment_or_404(course_id, assignment_id)
    previous = db.get(db.submission_key(assignment_id, user["id"]))
    if previous and previous.get("released"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This submission has already been marked")

    now = datetime.now(UTC)
    file_name = s3_key = content_type = None
    if body.file:
        file_name = storage.safe_file_name(body.file.file_name)
        content_type = body.file.content_type
        s3_key = f"courses/{course_id}/submissions/{assignment_id}/{user['id']}/{db.new_id()}/{file_name}"
    if previous and previous.get("s3_key"):
        storage.delete_file(previous["s3_key"])

    submission = _save_submission(
        {
            "assignment_id": assignment_id,
            "course_id": course_id,
            "student_id": user["id"],
            "student_name": user["name"],
            "text": body.text,
            "file_name": file_name,
            "content_type": content_type,
            "s3_key": s3_key,
            "submitted_at": _utc_iso(now),
            "late": now > datetime.fromisoformat(assignment["due_at"]),
            "mark": None,
            "feedback": None,
            "released": False,
        }
    )
    upload = storage.upload_ticket(s3_key, content_type) if s3_key else None
    return {"submission": submission, "upload": upload}


@router.get("/{assignment_id}/submissions", response_model=list[Submission])
def list_submissions(course_id: str, assignment_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    _assignment_or_404(course_id, assignment_id)
    submissions = db.query(f"ASSIGNMENT#{assignment_id}", "SUBMISSION#")
    return sorted(submissions, key=lambda submission: submission["student_name"].lower())


@router.get("/{assignment_id}/submissions/{student_id}/download", response_model=DownloadLink)
def download_submission(course_id: str, assignment_id: str, student_id: str, user: CurrentUser):
    role = course_role(course_id, user)
    if role == "student" and student_id != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    _assignment_or_404(course_id, assignment_id)
    submission = _submission_or_404(assignment_id, student_id)
    if not submission.get("s3_key"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This submission has no file")
    return {"url": storage.download_url(submission["s3_key"], submission["file_name"])}


@router.put("/{assignment_id}/submissions/{student_id}/grade", response_model=Submission)
def grade(course_id: str, assignment_id: str, student_id: str, body: GradeSet, user: CurrentUser):
    """Save a mark and feedback. Set release to true when the student should see them."""
    require_teacher(course_id, user)
    assignment = _assignment_or_404(course_id, assignment_id)
    if body.mark > assignment["max_mark"]:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"The mark cannot be more than {assignment['max_mark']}"
        )
    submission = _submission_or_404(assignment_id, student_id)
    submission.update(
        mark=body.mark, feedback=body.feedback, released=body.release, graded_at=db.now_iso()
    )
    return _save_submission(submission)
