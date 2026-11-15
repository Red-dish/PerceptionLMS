from fastapi import APIRouter, HTTPException, Response, status

from app import coursework as cw
from app import db, quizzes, storage
from app.access import course_role, require_student, require_teacher
from app.auth import CurrentUser
from app.models import (
    Assignment,
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentView,
    DownloadLink,
    Grant,
    GrantSet,
    GradeSet,
    ReleaseResult,
    ReleaseSet,
    Submission,
    SubmissionCreate,
    SubmissionCreated,
    check_window,
)

router = APIRouter(prefix="/courses/{course_id}/assignments", tags=["assignments"])


def _assignment_or_404(course_id: str, assignment_id: str, role: str = "lecturer") -> dict:
    assignment = db.get(db.assignment_key(course_id, assignment_id))
    # Students can't tell an assignment exists until it opens.
    if assignment is None or (role == "student" and not cw.is_visible_to_students(assignment, cw.now())):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    return db.strip_keys(assignment)


def _submission_or_404(assignment_id: str, student_id: str) -> dict:
    submission = db.get(db.submission_key(assignment_id, student_id))
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    return db.strip_keys(submission)


def _grant(assignment_id: str, student_id: str) -> dict | None:
    grant = db.get(db.grant_key(assignment_id, student_id))
    return grant and db.strip_keys(grant)


def _save_submission(submission: dict) -> dict:
    return db.put(
        db.submission_key(submission["assignment_id"], submission["student_id"]),
        submission,
        gsi1=(f"USER#{submission['student_id']}", f"SUBMISSION#{submission['assignment_id']}"),
    )


def _with_final_mark(assignment: dict, submission: dict) -> dict:
    return {**submission, "final_mark": cw.final_mark(assignment, submission)}


def _student_view(assignment: dict, submission: dict | None) -> dict | None:
    """Hide the mark and feedback from the student until the lecturer releases them."""
    if submission is None:
        return None
    if submission.get("released"):
        return _with_final_mark(assignment, submission)
    return {**submission, "mark": None, "final_mark": None, "feedback": None}


def _module_must_exist(course_id: str, module_id: str | None) -> None:
    if module_id and db.get(db.module_key(course_id, module_id)) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "That module doesn't exist in this course")


def _with_my_submission(assignment: dict, role: str, user: dict) -> dict:
    if role != "student":
        return assignment
    submission = db.get(db.submission_key(assignment["id"], user["id"]))
    grant = _grant(assignment["id"], user["id"])
    if not cw.grant_is_active(grant, cw.now()):
        grant = None
    return {
        **assignment,
        "my_submission": _student_view(assignment, submission and db.strip_keys(submission)),
        "my_grant": grant,
        "accepting_submissions": cw.accepting_submissions(assignment, grant, cw.now()),
    }


@router.get("", response_model=list[AssignmentView])
def list_assignments(course_id: str, user: CurrentUser):
    role = course_role(course_id, user)
    assignments = cw.course_assignments(course_id)
    if role == "student":
        moment = cw.now()
        assignments = [assignment for assignment in assignments if cw.is_visible_to_students(assignment, moment)]
    return [_with_my_submission(assignment, role, user) for assignment in assignments]


@router.post("", response_model=Assignment, status_code=status.HTTP_201_CREATED)
def create_assignment(course_id: str, body: AssignmentCreate, user: CurrentUser):
    require_teacher(course_id, user)
    _module_must_exist(course_id, body.module_id)
    assignment_id = db.new_id()
    assignment = {
        **body.model_dump(),
        "id": assignment_id,
        "course_id": course_id,
        "due_at": cw.utc_iso(body.due_at),
        "available_from": cw.utc_iso(body.available_from),
        "available_until": cw.utc_iso(body.available_until),
        "created_at": db.now_iso(),
    }
    return db.put(db.assignment_key(course_id, assignment_id), assignment)


@router.get("/{assignment_id}", response_model=AssignmentView)
def get_assignment(course_id: str, assignment_id: str, user: CurrentUser):
    role = course_role(course_id, user)
    return _with_my_submission(_assignment_or_404(course_id, assignment_id, role), role, user)


@router.patch("/{assignment_id}", response_model=Assignment)
def update_assignment(course_id: str, assignment_id: str, body: AssignmentUpdate, user: CurrentUser):
    require_teacher(course_id, user)
    assignment = _assignment_or_404(course_id, assignment_id)
    changes = body.model_dump(exclude_unset=True)
    nullable = {"available_from", "available_until", "module_id", "max_attempts", "time_limit_minutes"}
    _module_must_exist(course_id, changes.get("module_id"))
    # null only means "remove" for the window; for other fields it means "leave as it is".
    changes = {name: value for name, value in changes.items() if value is not None or name in nullable}
    for name in ("due_at", "available_from", "available_until"):
        if name in changes:
            changes[name] = cw.utc_iso(changes[name])
    assignment.update(changes)
    try:
        check_window(
            cw.parse(assignment.get("available_from")),
            cw.parse(assignment["due_at"]),
            cw.parse(assignment.get("available_until")),
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from None
    assignment["updated_at"] = db.now_iso()
    assignment = db.put(db.assignment_key(course_id, assignment_id), assignment)
    # A quiz with questions is worth the total of its questions' points.
    return quizzes.sync_points(assignment) if assignment.get("kind") == "quiz" else assignment


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(course_id: str, assignment_id: str, user: CurrentUser):
    """Deletes the assignment with every submission, file, mark and grant."""
    require_teacher(course_id, user)
    _assignment_or_404(course_id, assignment_id)
    for item in db.query(f"ASSIGNMENT#{assignment_id}"):
        for s3_key in [item.get("s3_key")] + [attempt.get("s3_key") for attempt in item.get("history", [])]:
            if s3_key:
                storage.delete_file(s3_key)
        db.delete((item["PK"], item["SK"]))
    db.delete(db.assignment_key(course_id, assignment_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{assignment_id}/submission", response_model=SubmissionCreated, status_code=status.HTTP_201_CREATED)
def submit(course_id: str, assignment_id: str, body: SubmissionCreate, user: CurrentUser):
    """Submit or resubmit. If a file is included, upload it with the returned signed form."""
    require_student(course_id, user)
    assignment = _assignment_or_404(course_id, assignment_id, "student")
    moment = cw.now()
    grant = _grant(assignment_id, user["id"])
    has_grant = cw.grant_is_active(grant, moment)
    if not cw.accepting_submissions(assignment, grant if has_grant else None, moment):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Submissions for this assignment have closed")
    kind = assignment.get("submission_type", "both")
    has_text = bool(body.text and body.text.strip())
    if kind == "none":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This work is handed in in class, not online")
    if kind == "file" and not body.file:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Attach a file for this assignment")
    if kind == "text" and (body.file or not has_text):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "This assignment takes a typed answer, not a file")
    if body.file:
        storage.check_file_type(body.file.file_name)

    previous = db.get(db.submission_key(assignment_id, user["id"]))
    previous = previous and db.strip_keys(previous)
    marked = bool(previous and previous.get("released"))
    if marked and not has_grant:
        raise HTTPException(status.HTTP_409_CONFLICT, "This submission has already been marked")
    attempts_used = int(previous.get("attempt", 1)) if previous and previous.get("submitted_at") else 0
    max_attempts = assignment.get("max_attempts")
    if max_attempts and attempts_used >= int(max_attempts) and not has_grant:
        raise HTTPException(status.HTTP_409_CONFLICT, f"You've used all {int(max_attempts)} attempts")

    file_name = s3_key = content_type = None
    if body.file:
        file_name = storage.safe_file_name(body.file.file_name)
        content_type = body.file.content_type
        s3_key = f"courses/{course_id}/submissions/{assignment_id}/{user['id']}/{db.new_id()}/{file_name}"

    # Every earlier attempt is kept, file and all.
    history = list(previous.get("history", [])) if previous else []
    if previous and (previous.get("submitted_at") or previous.get("mark") is not None):
        history.append(
            {
                "attempt": int(previous.get("attempt", 1)),
                "submitted_at": previous.get("submitted_at"),
                "text": previous.get("text"),
                "file_name": previous.get("file_name"),
                "s3_key": previous.get("s3_key"),
                "late": bool(previous.get("late")),
                "mark": previous.get("mark") if previous.get("released") else None,
                "feedback": previous.get("feedback") if previous.get("released") else None,
            }
        )
    due = cw.effective_due(assignment, grant if has_grant else None)
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
            "submitted_at": cw.utc_iso(moment),
            "late": moment > due,
            "days_late": cw.days_after(moment, due),
            "attempt": attempts_used + 1,
            "mark": None,
            "feedback": None,
            "released": False,
            "graded_at": None,
            "history": history,
        }
    )
    # A grant used to resubmit marked work is spent; an extension lasts until its date.
    if marked:
        db.delete(db.grant_key(assignment_id, user["id"]))
    upload = storage.upload_ticket(s3_key, content_type) if s3_key else None
    return {"submission": submission, "upload": upload}


@router.get("/{assignment_id}/submissions", response_model=list[Submission])
def list_submissions(course_id: str, assignment_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    assignment = _assignment_or_404(course_id, assignment_id)
    submissions = db.query(f"ASSIGNMENT#{assignment_id}", "SUBMISSION#")
    submissions = [_with_final_mark(assignment, db.strip_keys(submission)) for submission in submissions]
    return sorted(submissions, key=lambda submission: submission["student_name"].lower())


@router.get("/{assignment_id}/submissions/{student_id}/download", response_model=DownloadLink)
def download_submission(course_id: str, assignment_id: str, student_id: str, user: CurrentUser):
    role = course_role(course_id, user)
    if role == "student" and student_id != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    _assignment_or_404(course_id, assignment_id, role)
    submission = _submission_or_404(assignment_id, student_id)
    if not submission.get("s3_key"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This submission has no file")
    return {"url": storage.download_url(submission["s3_key"], submission["file_name"])}


@router.get(
    "/{assignment_id}/submissions/{student_id}/attempts/{attempt}/download", response_model=DownloadLink
)
def download_attempt(course_id: str, assignment_id: str, student_id: str, attempt: int, user: CurrentUser):
    """Download the file from an earlier attempt."""
    role = course_role(course_id, user)
    if role == "student" and student_id != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    _assignment_or_404(course_id, assignment_id, role)
    submission = _submission_or_404(assignment_id, student_id)
    earlier = next((a for a in submission.get("history", []) if int(a["attempt"]) == attempt), None)
    if earlier is None or not earlier.get("s3_key"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That attempt has no file")
    return {"url": storage.download_url(earlier["s3_key"], earlier["file_name"])}


@router.put("/{assignment_id}/submissions/{student_id}/grade", response_model=Submission)
def grade(course_id: str, assignment_id: str, student_id: str, body: GradeSet, user: CurrentUser):
    """Save a mark and feedback. Set release to true when the student should see them.

    Works for students who haven't submitted too, so the gradebook can record marks for
    work done offline, such as a quiz sat in class.
    """
    require_teacher(course_id, user)
    assignment = _assignment_or_404(course_id, assignment_id)
    if body.mark > assignment["max_mark"]:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"The mark cannot be more than {assignment['max_mark']}"
        )
    submission = db.get(db.submission_key(assignment_id, student_id))
    if submission is None:
        student = cw.enrolled_student_or_404(course_id, student_id)
        submission = {
            "assignment_id": assignment_id,
            "course_id": course_id,
            "student_id": student_id,
            "student_name": student["name"],
            "submitted_at": None,
            "late": False,
            "attempt": 0,
        }
    submission = db.strip_keys(submission)
    submission.update(mark=body.mark, feedback=body.feedback, released=body.release, graded_at=db.now_iso())
    return _with_final_mark(assignment, _save_submission(submission))


@router.delete("/{assignment_id}/submissions/{student_id}/grade", status_code=status.HTTP_204_NO_CONTENT)
def clear_grade(course_id: str, assignment_id: str, student_id: str, user: CurrentUser):
    """Remove a mark. The student's submission, if there is one, is kept."""
    require_teacher(course_id, user)
    _assignment_or_404(course_id, assignment_id)
    submission = _submission_or_404(assignment_id, student_id)
    if not submission.get("submitted_at"):
        db.delete(db.submission_key(assignment_id, student_id))
    else:
        submission.update(mark=None, feedback=None, released=False, graded_at=None)
        _save_submission(submission)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{assignment_id}/release", response_model=ReleaseResult)
def release_all(course_id: str, assignment_id: str, body: ReleaseSet, user: CurrentUser):
    """Release (or hide again) every mark saved for this assignment."""
    require_teacher(course_id, user)
    _assignment_or_404(course_id, assignment_id)
    updated = 0
    for item in db.query(f"ASSIGNMENT#{assignment_id}", "SUBMISSION#"):
        if item.get("mark") is not None and bool(item.get("released")) != body.release:
            _save_submission({**db.strip_keys(item), "released": body.release})
            updated += 1
    return {"updated": updated}


@router.get("/{assignment_id}/resubmissions", response_model=list[Grant])
def list_grants(course_id: str, assignment_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    _assignment_or_404(course_id, assignment_id)
    grants = db.query(f"ASSIGNMENT#{assignment_id}", "GRANT#")
    return sorted(grants, key=lambda grant: grant["student_name"].lower())


@router.put("/{assignment_id}/submissions/{student_id}/resubmission", response_model=Grant)
def allow_resubmission(course_id: str, assignment_id: str, student_id: str, body: GrantSet, user: CurrentUser):
    """Let one student submit again after marking, or after the window has closed.

    With until, it is an extension: their work counts as on time up to that date.
    """
    require_teacher(course_id, user)
    _assignment_or_404(course_id, assignment_id)
    student = cw.enrolled_student_or_404(course_id, student_id)
    grant = {
        "assignment_id": assignment_id,
        "course_id": course_id,
        "student_id": student_id,
        "student_name": student["name"],
        "until": cw.utc_iso(body.until),
        "note": body.note,
        "granted_by": user["name"],
        "granted_at": db.now_iso(),
    }
    return db.put(db.grant_key(assignment_id, student_id), grant)


@router.delete("/{assignment_id}/submissions/{student_id}/resubmission", status_code=status.HTTP_204_NO_CONTENT)
def remove_resubmission(course_id: str, assignment_id: str, student_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    _assignment_or_404(course_id, assignment_id)
    db.delete(db.grant_key(assignment_id, student_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
