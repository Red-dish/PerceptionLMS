"""DynamoDB access.

Everything lives in one table with a partition key (PK), a sort key (SK) and one
secondary index (GSI1). The key layout is described in docs/system-design.md.
"""

import uuid
from datetime import UTC, datetime
from functools import cache
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

from app.config import get_settings

ORG = "ORG"
GSI1 = "GSI1"
KEY_ATTRIBUTES = ("PK", "SK", "GSI1PK", "GSI1SK")

type Item = dict[str, Any]


@cache
def table():
    # AWS_ENDPOINT_URL, if set, points boto3 at the local Podman services instead of AWS.
    return boto3.resource("dynamodb").Table(get_settings().table_name)


def new_id() -> str:
    """Time-ordered ID, so sorting by ID sorts by creation time."""
    return uuid.uuid7().hex


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


# Keys for each kind of item.
def user_key(user_id: str) -> tuple[str, str]:
    return ORG, f"USER#{user_id}"


def course_key(course_id: str) -> tuple[str, str]:
    return ORG, f"COURSE#{course_id}"


def member_key(course_id: str, user_id: str) -> tuple[str, str]:
    return f"COURSE#{course_id}", f"MEMBER#{user_id}"


def module_key(course_id: str, module_id: str) -> tuple[str, str]:
    return f"COURSE#{course_id}", f"MODULE#{module_id}"


def material_key(course_id: str, module_id: str, material_id: str) -> tuple[str, str]:
    return f"COURSE#{course_id}", f"MATERIAL#{module_id}#{material_id}"


def assignment_key(course_id: str, assignment_id: str) -> tuple[str, str]:
    return f"COURSE#{course_id}", f"ASSIGNMENT#{assignment_id}"


def submission_key(assignment_id: str, student_id: str) -> tuple[str, str]:
    return f"ASSIGNMENT#{assignment_id}", f"SUBMISSION#{student_id}"


def announcement_key(course_id: str, announcement_id: str) -> tuple[str, str]:
    return f"COURSE#{course_id}", f"ANNOUNCEMENT#{announcement_id}"


# Basic operations.
def get(key: tuple[str, str]) -> Item | None:
    pk, sk = key
    return table().get_item(Key={"PK": pk, "SK": sk}).get("Item")


def put(key: tuple[str, str], item: Item, *, gsi1: tuple[str, str] | None = None) -> Item:
    """Save an item and return it without its key attributes."""
    stored = {**item, "PK": key[0], "SK": key[1]}
    if gsi1:
        stored["GSI1PK"], stored["GSI1SK"] = gsi1
    table().put_item(Item=stored)
    return strip_keys(stored)


def delete(key: tuple[str, str]) -> None:
    pk, sk = key
    table().delete_item(Key={"PK": pk, "SK": sk})


def query(pk: str, sk_prefix: str = "", *, by_gsi1: bool = False, newest_first: bool = False) -> list[Item]:
    """All items in one partition whose sort key starts with sk_prefix."""
    pk_name, sk_name = ("GSI1PK", "GSI1SK") if by_gsi1 else ("PK", "SK")
    condition = Key(pk_name).eq(pk)
    if sk_prefix:
        condition &= Key(sk_name).begins_with(sk_prefix)
    kwargs: dict[str, Any] = {"KeyConditionExpression": condition, "ScanIndexForward": not newest_first}
    if by_gsi1:
        kwargs["IndexName"] = GSI1
    items: list[Item] = []
    while True:
        response = table().query(**kwargs)
        items.extend(response["Items"])
        if "LastEvaluatedKey" not in response:
            return items
        kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]


def strip_keys(item: Item) -> Item:
    return {name: value for name, value in item.items() if name not in KEY_ATTRIBUTES}


# Users are needed by sign-in as well as the admin screens, so they live here.
def get_user(user_id: str) -> Item | None:
    item = get(user_key(user_id))
    return strip_keys(item) if item else None


def find_user_by_email(email: str) -> Item | None:
    matches = query(f"EMAIL#{email.lower()}", by_gsi1=True)
    return strip_keys(matches[0]) if matches else None


def save_user(user: Item) -> Item:
    return put(user_key(user["id"]), user, gsi1=(f"EMAIL#{user['email']}", "USER"))


def create_user(*, email: str, name: str, role: str) -> Item:
    user = {
        "id": new_id(),
        "email": email.lower(),
        "name": name,
        "role": role,
        "active": True,
        "created_at": now_iso(),
    }
    return save_user(user)
