"""Course events and a calendar combining events with coursework due dates."""

from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException, Response
from pydantic import AwareDatetime, BaseModel, model_validator

from app import coursework as cw, db
from app.access import course_role, my_courses, require_teacher
from app.auth import CurrentUser
from app.models import Instructions, Title

router = APIRouter(tags=["calendar"])


class EventBody(BaseModel):
    title: Title
    description: Instructions = ""
    starts_at: AwareDatetime
    ends_at: AwareDatetime

    @model_validator(mode="after")
    def validate_event(self):
        self.title = self.title.strip()
        if not self.title:
            raise ValueError("Enter an event title")
        if self.ends_at <= self.starts_at:
            raise ValueError("The event must end after it starts")
        return self


def event_key(course_id, event_id):
    return f"COURSE#{course_id}", f"EVENT#{event_id}"


def fields(body):
    return {
        **body.model_dump(),
        "starts_at": body.starts_at.isoformat(),
        "ends_at": body.ends_at.isoformat(),
    }


@router.get("/courses/{course_id}/events")
def course_events(course_id: str, user: CurrentUser):
    course_role(course_id, user)
    events = db.query(f"COURSE#{course_id}", "EVENT#")
    return sorted(map(db.strip_keys, events), key=lambda item: cw.parse(item["starts_at"]))


@router.post("/courses/{course_id}/events", status_code=201)
def create_event(course_id: str, body: EventBody, user: CurrentUser):
    require_teacher(course_id, user)
    event_id = db.new_id()
    return db.put(event_key(course_id, event_id), {**fields(body), "id": event_id, "course_id": course_id})


@router.put("/courses/{course_id}/events/{event_id}")
def edit_event(course_id: str, event_id: str, body: EventBody, user: CurrentUser):
    require_teacher(course_id, user)
    key = event_key(course_id, event_id)
    changes = fields(body)
    names = {f"#{name}": name for name in changes}
    values = {f":{name}": value for name, value in changes.items()}
    try:
        result = db.table().update_item(
            Key={"PK": key[0], "SK": key[1]},
            ConditionExpression="attribute_exists(PK)",
            UpdateExpression="SET " + ", ".join(f"#{name} = :{name}" for name in changes),
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues="ALL_NEW",
        )
    except ClientError as error:
        if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(404, "Event not found") from error
        raise
    return db.strip_keys(result["Attributes"])


@router.delete("/courses/{course_id}/events/{event_id}", status_code=204)
def delete_event(course_id: str, event_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    key = event_key(course_id, event_id)
    if not db.get(key):
        raise HTTPException(404, "Event not found")
    db.delete(key)
    return Response(status_code=204)


@router.get("/me/calendar")
def my_calendar(user: CurrentUser, start: AwareDatetime | None = None, end: AwareDatetime | None = None):
    if start and end and start >= end:
        raise HTTPException(422, "The calendar end must be after its start")
    moment = cw.now()
    entries = []
    for course in my_courses(user):
        course_id = course["id"]
        partition = f"COURSE#{course_id}"
        course_fields = {"course_id": course_id, "course_code": course["code"]}
        for item in db.query(partition, "EVENT#"):
            opens, closes = cw.parse(item["starts_at"]), cw.parse(item["ends_at"])
            if (start is None or closes > start) and (end is None or opens < end):
                entries.append({**db.strip_keys(item), **course_fields, "kind": "event"})
        for item in db.query(partition, "ASSIGNMENT#"):
            if course["my_role"] == "student" and not cw.is_visible_to_students(item, moment):
                continue
            grant = db.get(db.grant_key(item["id"], user["id"])) if course["my_role"] == "student" else None
            due = cw.effective_due(item, grant)
            if (start is None or due >= start) and (end is None or due < end):
                entries.append({
                    **course_fields, "id": item["id"], "title": item["title"],
                    "kind": item.get("kind", "assignment"), "starts_at": due.isoformat(),
                    "ends_at": None,
                })
    return sorted(entries, key=lambda item: cw.parse(item["starts_at"]))
