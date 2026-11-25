"""Rich-text content pages (#36)."""

from app.rich_text import sanitise

RICH = (
    "<h2>Week 1</h2><p>Read <strong>chapter 1</strong> and <em>watch</em> the video.</p>"
    "<ul><li>One</li><li>Two</li></ul><ol start=\"3\"><li>Three</li></ol>"
    '<p><a href="https://python.org" target="_blank">Python</a> <a href="mailto:maya.chen@example.edu">Email me</a></p>'
    '<img src="https://example.edu/diagram.png" alt="Diagram">'
    '<iframe src="https://www.youtube.com/embed/abc123" title="Intro" allowfullscreen></iframe>'
)


def make_module(client, school, title="Week 1", published=True):
    response = client.post(
        f"/courses/{school.course_id}/modules", json={"title": title, "published": published}, headers=school.lecturer
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def create(client, school, **fields):
    body = {"title": "Welcome", "body": "<p>Hello</p>", "published": True, **fields}
    response = client.post(f"/courses/{school.course_id}/pages", json=body, headers=school.lecturer)
    assert response.status_code == 201, response.text
    return f"/courses/{school.course_id}/pages/{response.json()['id']}", response.json()


def test_lecturer_creates_reads_updates_and_deletes_a_page(client, school):
    url, page = create(client, school, body=RICH)
    assert (page["title"], page["published"], page["module_id"]) == ("Welcome", True, None)
    assert page["author_name"] == "Dr. Maya Chen"
    for kept in ("<h2>Week 1</h2>", "<strong>chapter 1</strong>", "<ul><li>One</li>", '<ol start="3">',
                 'href="https://python.org"', 'href="mailto:maya.chen@example.edu"',
                 'src="https://example.edu/diagram.png"', 'src="https://www.youtube.com/embed/abc123"'):  # fmt: skip
        assert kept in page["body"], kept

    assert client.get(url, headers=school.lecturer).json()["body"] == page["body"]
    assert client.get(url, headers=school.student).status_code == 200

    updated = client.patch(url, json={"title": "Welcome to ICT102", "body": "<h3>New</h3>"}, headers=school.lecturer)
    assert updated.status_code == 200, updated.text
    assert (updated.json()["title"], updated.json()["body"]) == ("Welcome to ICT102", "<h3>New</h3>")
    assert updated.json()["updated_at"] is not None
    # Fields that aren't sent stay as they were.
    assert updated.json()["published"] is True

    listed = client.get(f"/courses/{school.course_id}/pages", headers=school.lecturer).json()
    assert [p["title"] for p in listed] == ["Welcome to ICT102"]
    assert "body" not in listed[0]

    assert client.delete(url, headers=school.lecturer).status_code == 204
    assert client.get(url, headers=school.lecturer).status_code == 404
    assert client.delete(url, headers=school.lecturer).status_code == 404
    assert client.patch(url, json={"title": "X"}, headers=school.lecturer).status_code == 404


def test_rich_text_is_sanitised_on_save(client, school):
    dangerous = (
        '<h2 onclick="steal()">Title</h2><script>alert(1)</script><style>body{display:none}</style>'
        '<p style="color:red">Text <a href="javascript:alert(1)">bad link</a></p>'
        '<img src="x" onerror="alert(1)"><img src="data:image/png;base64,AAAA"><img src="http://example.edu/a.png">'
        '<iframe src="https://evil.example/phish"></iframe><form action="/steal"><input name="password"></form>'
        "<!-- hidden -->"
    )
    url, page = create(client, school, body=dangerous)
    body = page["body"]
    for removed in ("onclick", "<script", "alert(1)", "<style", "style=", "javascript:", "onerror", "data:",
                    "http://example.edu", "evil.example", "<form", "<input", "<!--"):  # fmt: skip
        assert removed not in body, removed
    assert "<h2>Title</h2>" in body and "bad link" in body
    # Editing sanitises too.
    edited = client.patch(url, json={"body": '<p onmouseover="x()">Hi</p><script>x()</script>'}, headers=school.lecturer)
    assert edited.json()["body"] == "<p>Hi</p>"


def test_links_and_videos_are_made_safe():
    link = sanitise('<a href="https://python.org" target="_blank">Python</a>')
    assert 'rel="noopener noreferrer nofollow"' in link
    assert sanitise('<a href="https://python.org" target="_top">x</a>') == (
        '<a href="https://python.org" rel="noopener noreferrer nofollow">x</a>'
    )
    for allowed in (
        "https://www.youtube.com/embed/abc",
        "https://www.youtube-nocookie.com/embed/abc",
        "https://player.vimeo.com/video/123",
    ):
        embed = sanitise(f'<iframe src="{allowed}"></iframe>')
        assert f'src="{allowed}"' in embed
        assert 'sandbox="' in embed and 'referrerpolicy="strict-origin-when-cross-origin"' in embed
    # Look-alike addresses and watch pages aren't embed players.
    assert sanitise('<iframe src="https://www.youtube.com.evil.example/embed/x"></iframe>') == ""
    assert sanitise('<iframe src="https://www.youtube.com/watch?v=abc"></iframe>') == ""
    assert sanitise('<iframe src="https://www.youtube.com/embed/abc" sandbox="allow-top-navigation"></iframe>').count(
        "allow-top-navigation"
    ) == 0
    video = sanitise('<video controls autoplay><source src="https://example.edu/a.mp4" type="video/mp4"></video>')
    assert video == '<video controls=""><source src="https://example.edu/a.mp4" type="video/mp4"></video>'


def test_pages_can_be_added_to_and_moved_between_modules(client, school):
    week1 = make_module(client, school, "Week 1")
    week2 = make_module(client, school, "Week 2")
    first_url, first = create(client, school, title="Overview", module_id=week1)
    _, second = create(client, school, title="Reading list", module_id=week1)
    assert (first["module_id"], first["position"], second["position"]) == (week1, 0, 1)

    course = client.get(f"/courses/{school.course_id}", headers=school.student).json()
    outline = {m["title"]: [p["title"] for p in m["pages"]] for m in course["modules"]}
    assert outline == {"Week 1": ["Overview", "Reading list"], "Week 2": []}
    week1_pages = client.get(f"/courses/{school.course_id}/pages", params={"module_id": week1}, headers=school.student)
    assert [p["title"] for p in week1_pages.json()] == ["Overview", "Reading list"]

    moved = client.patch(first_url, json={"module_id": week2}, headers=school.lecturer).json()
    assert (moved["module_id"], moved["position"]) == (week2, 0)
    removed = client.patch(first_url, json={"module_id": None}, headers=school.lecturer).json()
    assert removed["module_id"] is None

    url = f"/courses/{school.course_id}/pages"
    assert client.post(url, json={"title": "X", "module_id": "nope"}, headers=school.lecturer).status_code == 422
    assert client.patch(first_url, json={"module_id": "nope"}, headers=school.lecturer).status_code == 422


def test_deleting_a_module_keeps_its_pages_but_hides_them(client, school):
    week1 = make_module(client, school)
    url, _ = create(client, school, title="Overview", module_id=week1)
    assert client.delete(f"/courses/{school.course_id}/modules/{week1}", headers=school.lecturer).status_code == 204
    page = client.get(url, headers=school.lecturer).json()
    assert (page["module_id"], page["published"]) == (None, False)
    assert client.get(url, headers=school.student).status_code == 404


def test_students_only_see_published_pages_in_published_modules(client, school):
    hidden_module = make_module(client, school, "Draft week", published=False)
    open_module = make_module(client, school, "Week 1", published=True)
    create(client, school, title="Standalone")
    draft_url, _ = create(client, school, title="Draft page", published=False)
    hidden_url, _ = create(client, school, title="In a hidden module", module_id=hidden_module)
    create(client, school, title="In an open module", module_id=open_module)

    url = f"/courses/{school.course_id}/pages"
    assert {p["title"] for p in client.get(url, headers=school.student).json()} == {"Standalone", "In an open module"}
    assert len(client.get(url, headers=school.lecturer).json()) == 4
    assert client.get(draft_url, headers=school.student).status_code == 404
    assert client.get(hidden_url, headers=school.student).status_code == 404
    # The course outline never shows students a draft page, even in an open module.
    create(client, school, title="Draft in open module", module_id=open_module, published=False)
    course = client.get(f"/courses/{school.course_id}", headers=school.student).json()
    assert [p["title"] for m in course["modules"] for p in m["pages"]] == ["In an open module"]

    client.patch(draft_url, json={"published": True}, headers=school.lecturer)
    assert client.get(draft_url, headers=school.student).status_code == 200


def test_only_course_staff_can_change_pages(client, school):
    url, _ = create(client, school)
    pages = f"/courses/{school.course_id}/pages"
    assert client.post(pages, json={"title": "X"}, headers=school.student).status_code == 403
    assert client.patch(url, json={"title": "X"}, headers=school.student).status_code == 403
    assert client.delete(url, headers=school.student).status_code == 403
    assert client.get(pages, headers=school.outsider).status_code == 404
    assert client.get(url, headers=school.outsider).status_code == 404
    # Admins can manage any course's pages.
    assert client.patch(url, json={"title": "By admin"}, headers=school.admin).status_code == 200


def test_page_input_is_validated(client, school):
    pages = f"/courses/{school.course_id}/pages"
    assert client.post(pages, json={"title": ""}, headers=school.lecturer).status_code == 422
    assert client.post(pages, json={"title": "Big", "body": "x" * 200_001}, headers=school.lecturer).status_code == 422
    _, page = create(client, school, title="Empty", body="")
    assert page["body"] == ""


# Linking files from pages (#37)
def add_file(client, school, module_id, title, file_name="notes.pdf"):
    response = client.post(
        f"/courses/{school.course_id}/modules/{module_id}/materials",
        json={"title": title, "file_name": file_name, "content_type": "application/pdf", "folder": "Week 1"},
        headers=school.lecturer,
    )
    assert response.status_code == 201, response.text
    return response.json()["material"]["id"]


def test_pages_link_course_files(client, school):
    week1 = make_module(client, school, "Week 1")
    slides = add_file(client, school, week1, "Slides", "slides.pdf")
    reading = add_file(client, school, week1, "Reading", "reading.pdf")

    url, page = create(client, school, file_ids=[reading, slides, reading])
    # Each file once, in the order given, with what the frontend needs to show and download it.
    assert [f["title"] for f in page["files"]] == ["Reading", "Slides"]
    linked = page["files"][1]
    assert (linked["file_name"], linked["folder"], linked["visible_to_students"]) == ("slides.pdf", "Week 1", True)
    assert linked["download_path"] == f"/courses/{school.course_id}/modules/{week1}/materials/{slides}/download"
    assert client.get(linked["download_path"], headers=school.student).status_code == 200

    student_view = client.get(url, headers=school.student).json()
    assert [f["title"] for f in student_view["files"]] == ["Reading", "Slides"]

    # Replacing the list, clearing it, and refusing files from elsewhere.
    assert [f["id"] for f in client.patch(url, json={"file_ids": [slides]}, headers=school.lecturer).json()["files"]] == [
        slides
    ]
    assert client.patch(url, json={"title": "Renamed"}, headers=school.lecturer).json()["files"][0]["id"] == slides
    assert client.patch(url, json={"file_ids": []}, headers=school.lecturer).json()["files"] == []
    assert client.patch(url, json={"file_ids": ["not-a-file"]}, headers=school.lecturer).status_code == 422
    pages = f"/courses/{school.course_id}/pages"
    assert client.post(pages, json={"title": "X", "file_ids": ["nope"]}, headers=school.lecturer).status_code == 422


def test_linking_never_shows_students_hidden_files(client, school):
    hidden = make_module(client, school, "Answers", published=False)
    answers = add_file(client, school, hidden, "Exam answers")
    week1 = make_module(client, school, "Week 1")
    slides = add_file(client, school, week1, "Slides")
    url, page = create(client, school, file_ids=[answers, slides])

    # The lecturer sees both, with a warning flag on the hidden one.
    assert [(f["title"], f["visible_to_students"]) for f in page["files"]] == [
        ("Exam answers", False),
        ("Slides", True),
    ]
    # Students only get files they could open anyway.
    assert [f["title"] for f in client.get(url, headers=school.student).json()["files"]] == ["Slides"]
    download = f"/courses/{school.course_id}/modules/{hidden}/materials/{answers}/download"
    assert client.get(download, headers=school.student).status_code == 404


def test_deleted_files_are_unlinked_from_pages(client, school):
    week1 = make_module(client, school, "Week 1")
    week2 = make_module(client, school, "Week 2")
    slides = add_file(client, school, week1, "Slides")
    reading = add_file(client, school, week2, "Reading")
    url, _ = create(client, school, file_ids=[slides, reading])

    base = f"/courses/{school.course_id}/modules"
    assert client.delete(f"{base}/{week1}/materials/{slides}", headers=school.lecturer).status_code == 204
    assert [f["title"] for f in client.get(url, headers=school.lecturer).json()["files"]] == ["Reading"]
    assert client.delete(f"{base}/{week2}", headers=school.lecturer).status_code == 204
    assert client.get(url, headers=school.lecturer).json()["files"] == []

    # A moved file stays linked, with its new download path.
    week3 = make_module(client, school, "Week 3")
    week4 = make_module(client, school, "Week 4")
    notes = add_file(client, school, week3, "Notes")
    url, _ = create(client, school, title="Another", file_ids=[notes])
    client.patch(f"{base}/{week3}/materials/{notes}", json={"module_id": week4}, headers=school.lecturer)
    assert client.get(url, headers=school.lecturer).json()["files"][0]["module_id"] == week4
