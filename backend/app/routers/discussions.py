"""Course discussion topics, threaded replies and lecturer moderation."""

import boto3
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app import db
from app.access import course_role, require_teacher
from app.auth import CurrentUser
from app.models import Instructions, Title

router = APIRouter(prefix="/courses/{course_id}/discussions", tags=["discussions"])


class TopicCreate(BaseModel):
    title: Title
    body: Instructions


class ReplyCreate(BaseModel):
    body: Instructions
    parent_id: str | None = None


class LockDiscussion(BaseModel):
    locked: bool


def topic_key(course_id, topic_id):
    return f"COURSE#{course_id}", f"DISCUSSION#{topic_id}"


def reply_partition(topic_id):
    return f"DISCUSSION#{topic_id}"


def get_topic(course_id, topic_id):
    topic = db.get(topic_key(course_id, topic_id))
    if not topic or topic.get("deleted"):
        raise HTTPException(404, "Discussion not found")
    return topic


def post_fields(user, body):
    if not body.strip():
        raise HTTPException(422, "Enter a message")
    return {
        "id": db.new_id(),
        "body": body.strip(),
        "author_id": user["id"],
        "author_name": user["name"],
        "created_at": db.now_iso(),
    }


@router.get("")
def topics(course_id: str, user: CurrentUser):
    course_role(course_id, user)
    return [
        db.strip_keys(item)
        for item in db.query(f"COURSE#{course_id}", "DISCUSSION#", newest_first=True)
        if not item.get("deleted")
    ]


@router.post("", status_code=201)
def create_topic(course_id: str, body: TopicCreate, user: CurrentUser):
    course_role(course_id, user)
    if not body.title.strip():
        raise HTTPException(422, "Enter a title")
    topic = {**post_fields(user, body.body), "title": body.title.strip(), "locked": False}
    return db.put(topic_key(course_id, topic["id"]), topic)


@router.get("/{topic_id}")
def topic_detail(course_id: str, topic_id: str, user: CurrentUser):
    course_role(course_id, user)
    topic = get_topic(course_id, topic_id)
    return {
        **db.strip_keys(topic),
        "replies": [
            db.strip_keys(reply)
            for reply in db.query(reply_partition(topic_id), "REPLY#")
        ],
    }


@router.post("/{topic_id}/replies", status_code=201)
def reply(course_id: str, topic_id: str, body: ReplyCreate, user: CurrentUser):
    course_role(course_id, user)
    topic = get_topic(course_id, topic_id)
    if topic["locked"]:
        raise HTTPException(409, "This discussion is locked")
    message = {**post_fields(user, body.body), "parent_id": body.parent_id}
    serializer = TypeSerializer()

    def encode(item):
        return {key: serializer.serialize(value) for key, value in item.items()}

    table_name = db.table().name
    checks = [{"ConditionCheck": {
        "TableName": table_name,
        "Key": encode({"PK": topic["PK"], "SK": topic["SK"]}),
        "ConditionExpression": "attribute_exists(PK) AND #locked = :false AND attribute_not_exists(deleted)",
        "ExpressionAttributeNames": {"#locked": "locked"},
        "ExpressionAttributeValues": encode({":false": False}),
    }}]
    partition = reply_partition(topic_id)
    if body.parent_id is not None:
        checks.append({"ConditionCheck": {
            "TableName": table_name,
            "Key": encode({"PK": partition, "SK": f"REPLY#{body.parent_id}"}),
            "ConditionExpression": "attribute_exists(PK) AND attribute_not_exists(deleted)",
        }})
    try:
        boto3.client("dynamodb").transact_write_items(TransactItems=[
            *checks,
            {"Put": {"TableName": table_name, "Item": encode({
                **message, "PK": partition, "SK": f"REPLY#{message['id']}",
            })}},
        ])
    except ClientError as error:
        if error.response["Error"]["Code"] != "TransactionCanceledException":
            raise
        reasons = error.response.get("CancellationReasons") or []
        if reasons and reasons[0].get("Code") == "ConditionalCheckFailed":
            raise HTTPException(409, "This discussion was locked or deleted") from error
        if len(reasons) > 2 and reasons[1].get("Code") == "ConditionalCheckFailed":
            raise HTTPException(404, "Parent reply not found") from error
        if any(reason.get("Code") == "TransactionConflict" for reason in reasons):
            raise HTTPException(409, "The discussion changed. Try again.") from error
        raise
    return message


@router.patch("/{topic_id}")
def lock_topic(course_id: str, topic_id: str, body: LockDiscussion, user: CurrentUser):
    require_teacher(course_id, user)
    topic = get_topic(course_id, topic_id)
    result = db.table().update_item(
        Key={"PK": topic["PK"], "SK": topic["SK"]},
        UpdateExpression="SET #locked = :locked",
        ExpressionAttributeNames={"#locked": "locked"},
        ExpressionAttributeValues={":locked": body.locked},
        ReturnValues="ALL_NEW",
    )
    if result["Attributes"].get("deleted"):
        raise HTTPException(404, "Discussion not found")
    return db.strip_keys(result["Attributes"])


@router.delete("/{topic_id}", status_code=204)
def delete_topic(course_id: str, topic_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    topic = get_topic(course_id, topic_id)
    db.put(topic_key(course_id, topic_id), {"id": topic["id"], "deleted": True})
    return Response(status_code=204)


@router.delete("/{topic_id}/replies/{reply_id}", status_code=204)
def delete_reply(course_id: str, topic_id: str, reply_id: str, user: CurrentUser):
    require_teacher(course_id, user)
    get_topic(course_id, topic_id)
    key = (reply_partition(topic_id), f"REPLY#{reply_id}")
    item = db.get(key)
    if not item or item.get("deleted"):
        raise HTTPException(404, "Reply not found")
    # Keep the thread structure while removing the content and author.
    db.put(key, {field: item[field] for field in ("id", "parent_id", "created_at")} | {"deleted": True})
    return Response(status_code=204)
