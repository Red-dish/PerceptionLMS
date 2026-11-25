from datetime import UTC, datetime, timedelta


def test_discussion_replies_and_moderation(client, school):
    root = f"/courses/{school.course_id}/discussions"
    student, lecturer, outsider = school.student, school.lecturer, school.outsider
    assert client.get(root, headers=outsider).status_code == 404
    response = client.post(root, headers=student, json={"title": "Lab", "body": "Question"})
    assert response.status_code == 201
    topic = f"{root}/{response.json()['id']}"
    assert len(client.get(root, headers=lecturer).json()) == 1
    assert client.get(topic, headers=outsider).status_code == 404
    replies = f"{topic}/replies"
    assert client.post(replies, headers=student, json={"body": "No", "parent_id": "other"}).status_code == 404
    parent = client.post(replies, headers=lecturer, json={"body": "Reply"})
    assert parent.status_code == 201
    parent_id = parent.json()["id"]
    assert client.post(replies, headers=student, json={"body": "Nested", "parent_id": parent_id}).status_code == 201
    assert client.patch(topic, headers=student, json={"locked": True}).status_code == 403
    assert client.patch(topic, headers=lecturer, json={"locked": True}).json()["locked"]
    assert client.post(replies, headers=student, json={"body": "Locked"}).status_code == 409
    assert client.delete(f"{replies}/{parent_id}", headers=lecturer).status_code == 204
    deleted, child = client.get(topic, headers=student).json()["replies"]
    assert deleted["deleted"] and "body" not in deleted and child["parent_id"] == parent_id
    assert client.delete(topic, headers=student).status_code == 403
    assert client.delete(topic, headers=lecturer).status_code == 204
    assert client.get(topic, headers=student).status_code == 404


def test_inbox_privacy_and_unread_cursor(client, school):
    root = f"/inbox/courses/{school.course_id}"
    student, lecturer, outsider = school.student, school.lecturer, school.outsider
    outsider_id = client.get("/me", headers=outsider).json()["id"]
    assert client.get(f"{root}/recipients", headers=lecturer).json() == [
        {"id": school.student_id, "name": "Jordan Lee"}
    ]
    start = f"{root}/conversations"
    assert client.post(start, headers=lecturer, json={"recipient_ids": [outsider_id], "body": "No"}).status_code == 403
    body = {"recipient_ids": [school.student_id], "body": "Hello"}
    first = client.post(start, headers=lecturer, json=body)
    assert first.status_code == 201
    thread = f"{start}/{first.json()['id']}"
    assert client.get(thread, headers=outsider).status_code == 404
    assert client.get(thread, headers=school.admin).status_code == 404
    second = client.post(f"{thread}/messages", headers=lecturer, json={"body": "Follow-up"})
    assert second.status_code == 201
    assert len(client.get(thread, headers=student).json()["messages"]) == 2
    assert client.get("/inbox/conversations", headers=student).json()["unread_count"] == 2
    newest = second.json()["id"]
    assert client.put(f"{thread}/read", headers=student, json={"message_id": newest}).json()["message_id"] == newest
    older = first.json()["message"]["id"]
    assert client.put(f"{thread}/read", headers=student, json={"message_id": older}).json()["message_id"] == newest
    assert client.get("/inbox/conversations", headers=student).json()["unread_count"] == 0
    assert client.post(start, headers=lecturer, json=body).json()["id"] == first.json()["id"]


def test_calendar_events_and_quiz_visibility(client, school):
    root = f"/courses/{school.course_id}"
    student, lecturer = school.student, school.lecturer
    now = datetime.now(UTC)
    event = {
        "title": "Workshop", "starts_at": (now + timedelta(hours=1)).isoformat(),
        "ends_at": (now + timedelta(hours=2)).isoformat(),
    }
    assert client.post(f"{root}/events", headers=student, json=event).status_code == 403
    assert client.post(f"{root}/events", headers=lecturer, json={**event, "ends_at": event["starts_at"]}).status_code == 422
    created = client.post(f"{root}/events", headers=lecturer, json=event)
    assert created.status_code == 201
    event_path = f"{root}/events/{created.json()['id']}"
    assert client.get(f"{root}/events", headers=school.outsider).status_code == 404
    assert client.get(f"{root}/events", headers=student).json()[0]["title"] == "Workshop"
    assert client.put(event_path, headers=lecturer, json={**event, "title": "Lab"}).json()["title"] == "Lab"
    for title, published in [("Visible quiz", True), ("Draft quiz", False)]:
        assert client.post(f"{root}/assignments", headers=lecturer, json={
            "title": title, "kind": "quiz", "published": published, "due_at": event["ends_at"],
        }).status_code == 201
    result = client.get("/me/calendar", headers=student, params={"start": now.isoformat()})
    assert [(item["title"], item["kind"]) for item in result.json()] == [("Lab", "event"), ("Visible quiz", "quiz")]
    assert client.delete(event_path, headers=lecturer).status_code == 204


def test_notifications_from_all_sources_and_preferences(client, school):
    root = f"/courses/{school.course_id}"
    student, lecturer = school.student, school.lecturer
    future = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    for title, schedule in [("News", None), ("Scheduled", future)]:
        response = client.post(f"{root}/announcements", headers=lecturer, json={
            "title": title, "body": "Course update", "publish_at": schedule,
        })
        assert response.status_code == 201
    assignment = client.post(f"{root}/assignments", headers=lecturer, json={"title": "Homework", "due_at": future}).json()
    assert client.post(f"/inbox{root}/conversations", headers=lecturer, json={
        "recipient_ids": [school.student_id], "body": "Private content",
    }).status_code == 201
    feed = "/me/notifications"
    initial = client.get(feed, headers=student).json()
    assert {item["kind"] for item in initial["notifications"]} == {"announcement", "due", "message"}
    assert initial["unread_count"] == 3 and "Private content" not in str(initial)
    read = f"{feed}/{initial['notifications'][0]['id']}/read"
    assert client.put(read, headers=school.outsider).status_code == 404
    assert client.put(read, headers=student).json()["read"]
    assert client.put(read, headers=student).json()["read"]
    assert client.get(feed, headers=student).json()["unread_count"] == 2
    assignment_path = f"{root}/assignments/{assignment['id']}"
    assert client.put(f"{assignment_path}/submissions/{school.student_id}/grade", headers=lecturer, json={
        "mark": 75, "release": False,
    }).status_code == 200
    assert not any(item["kind"] == "grade" for item in client.get(feed, headers=student).json()["notifications"])
    assert client.post(f"{assignment_path}/release", headers=lecturer, json={"release": True}).status_code == 200
    assert {item["kind"] for item in client.get(feed, headers=student).json()["notifications"]} == {"announcement", "grade", "message"}
    prefs = "/me/notification-preferences"
    assert all(client.get(prefs, headers=student).json().values())
    assert client.put(prefs, headers=student, json={"announcements": False, "messages": False}).status_code == 200
    assert [item["kind"] for item in client.get(feed, headers=student).json()["notifications"]] == ["grade"]
