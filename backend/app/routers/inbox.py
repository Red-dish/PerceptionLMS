"""Private, course-scoped threads with per-participant read positions."""

import hashlib

from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import db
from app.access import my_courses
from app.auth import CurrentUser
from app.models import Instructions

router = APIRouter(prefix="/inbox", tags=["inbox"])


class MessageBody(BaseModel):
    body: Instructions


class StartConversation(MessageBody):
    recipient_ids: list[str] = Field(min_length=1, max_length=30)


class ReadConversation(BaseModel):
    message_id: str


def enrolled(course_id, user_id):
    return db.get(db.course_key(course_id)) and db.get(db.member_key(course_id, user_id))


def require_enrolment(course_id, user_id):
    if not enrolled(course_id, user_id):
        raise HTTPException(404, "Course not found")


def course_threads(course_id, user_id):
    return [
        thread for thread in db.query(f"COURSE#{course_id}", "THREAD#")
        if user_id in thread["participant_ids"]
    ]


def messages(thread_id):
    return db.query(f"THREAD#{thread_id}", "MESSAGE#")


def read_position(thread_id, user_id):
    return db.table().get_item(
        Key={"PK": f"THREAD#{thread_id}", "SK": f"READ#{user_id}"},
        ConsistentRead=True,
    ).get("Item", {})


def private_thread(course_id, thread_id, user):
    require_enrolment(course_id, user["id"])
    thread = db.get((f"COURSE#{course_id}", f"THREAD#{thread_id}"))
    if not thread or user["id"] not in thread["participant_ids"]:
        raise HTTPException(404, "Conversation not found")
    return thread


def require_recipients(course_id, recipient_ids):
    for user_id in recipient_ids:
        recipient = db.get_user(user_id)
        if not recipient or not recipient.get("active") or not enrolled(course_id, user_id):
            raise HTTPException(403, "Every recipient must be an active member of this course")


def send(thread_id, user, body):
    if not body.strip():
        raise HTTPException(422, "Enter a message")
    message = {
        "id": db.new_id(), "sender_id": user["id"], "sender_name": user["name"],
        "body": body.strip(), "created_at": db.now_iso(),
    }
    return db.put((f"THREAD#{thread_id}", f"MESSAGE#{message['id']}"), message)


@router.get("/courses/{course_id}/recipients")
def recipients(course_id: str, user: CurrentUser):
    require_enrolment(course_id, user["id"])
    result = []
    for member in db.query(f"COURSE#{course_id}", "MEMBER#"):
        if member["user_id"] != user["id"]:
            person = db.get_user(member["user_id"])
            if person and person.get("active"):
                result.append({"id": person["id"], "name": person["name"]})
    return sorted(result, key=lambda person: person["name"].casefold())


@router.get("/conversations")
def conversations(user: CurrentUser):
    found = []
    for course in my_courses(user):
        if not enrolled(course["id"], user["id"]):
            continue
        for thread in course_threads(course["id"], user["id"]):
            thread_messages = messages(thread["id"])
            if not thread_messages:
                continue
            cursor = read_position(thread["id"], user["id"]).get("message_id", "")
            found.append({
                **db.strip_keys(thread),
                "last_message": db.strip_keys(thread_messages[-1]),
                "unread_count": sum(m["id"] > cursor and m["sender_id"] != user["id"] for m in thread_messages),
            })
    found.sort(key=lambda thread: thread["last_message"]["id"], reverse=True)
    return {"conversations": found, "unread_count": sum(thread["unread_count"] for thread in found)}


@router.post("/courses/{course_id}/conversations", status_code=201)
def start(course_id: str, body: StartConversation, user: CurrentUser):
    require_enrolment(course_id, user["id"])
    recipient_ids = set(body.recipient_ids)
    if user["id"] in recipient_ids:
        raise HTTPException(422, "Choose recipients other than yourself")
    if not body.body.strip():
        raise HTTPException(422, "Enter a message")
    require_recipients(course_id, recipient_ids)
    participant_ids = sorted({user["id"], *recipient_ids})
    thread_id = hashlib.sha256("\0".join([course_id, *participant_ids]).encode()).hexdigest()
    thread = {"id": thread_id, "course_id": course_id, "participant_ids": participant_ids}
    db.put((f"COURSE#{course_id}", f"THREAD#{thread_id}"), thread)
    return {**thread, "message": send(thread_id, user, body.body)}


@router.get("/courses/{course_id}/conversations/{thread_id}")
def thread_detail(course_id: str, thread_id: str, user: CurrentUser):
    thread = private_thread(course_id, thread_id, user)
    return {**db.strip_keys(thread), "messages": [db.strip_keys(item) for item in messages(thread_id)]}


@router.post("/courses/{course_id}/conversations/{thread_id}/messages", status_code=201)
def reply(course_id: str, thread_id: str, body: MessageBody, user: CurrentUser):
    thread = private_thread(course_id, thread_id, user)
    require_recipients(course_id, set(thread["participant_ids"]) - {user["id"]})
    return send(thread_id, user, body.body)


@router.put("/courses/{course_id}/conversations/{thread_id}/read")
def mark_read(course_id: str, thread_id: str, body: ReadConversation, user: CurrentUser):
    private_thread(course_id, thread_id, user)
    partition = f"THREAD#{thread_id}"
    if not db.get((partition, f"MESSAGE#{body.message_id}")):
        raise HTTPException(404, "Message not found")
    try:
        db.table().update_item(
            Key={"PK": partition, "SK": f"READ#{user['id']}"},
            UpdateExpression="SET message_id = :message",
            ConditionExpression="attribute_not_exists(message_id) OR message_id < :message",
            ExpressionAttributeValues={":message": body.message_id},
        )
    except ClientError as error:
        if error.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
    return {"message_id": read_position(thread_id, user["id"])["message_id"]}
