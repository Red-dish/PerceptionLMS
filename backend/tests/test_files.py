def make_module(client, school, title, published=True):
    response = client.post(
        f"/courses/{school.course_id}/modules", json={"title": title, "published": published}, headers=school.lecturer
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def add_file(client, school, module_id, title, file_name, folder=""):
    response = client.post(
        f"/courses/{school.course_id}/modules/{module_id}/materials",
        json={"title": title, "file_name": file_name, "content_type": "application/pdf", "folder": folder},
        headers=school.lecturer,
    )
    return response


def test_files_are_organised_in_folders_and_listed_for_the_course(client, school):
    week1 = make_module(client, school, "Week 1")
    drafts = make_module(client, school, "Drafts", published=False)
    assert add_file(client, school, week1, "Slides", "slides.pdf", "Week 1/Slides").status_code == 201
    assert add_file(client, school, week1, "Reading", "reading.pdf", "Week 1").status_code == 201
    assert add_file(client, school, drafts, "Exam", "exam.pdf", "Exams").status_code == 201

    url = f"/courses/{school.course_id}/files"
    staff = client.get(url, headers=school.lecturer).json()
    assert [(f["folder"], f["title"]) for f in staff] == [
        ("Exams", "Exam"),
        ("Week 1", "Reading"),
        ("Week 1/Slides", "Slides"),
    ]
    # Students only see files in published modules.
    assert [f["title"] for f in client.get(url, headers=school.student).json()] == ["Reading", "Slides"]
    # A folder includes its subfolders.
    assert [f["title"] for f in client.get(url, params={"folder": "Week 1"}, headers=school.student).json()] == [
        "Reading",
        "Slides",
    ]
    assert client.get(url, headers=school.outsider).status_code == 404


def test_files_can_be_renamed_moved_and_replaced(client, school):
    week1 = make_module(client, school, "Week 1")
    week2 = make_module(client, school, "Week 2")
    material = add_file(client, school, week1, "Slides", "slides.pdf").json()["material"]
    base = f"/courses/{school.course_id}/modules"

    moved = client.patch(
        f"{base}/{week1}/materials/{material['id']}",
        json={"title": "Week 2 slides", "module_id": week2, "folder": "Slides"},
        headers=school.lecturer,
    )
    assert moved.status_code == 200, moved.text
    assert (moved.json()["module_id"], moved.json()["title"], moved.json()["folder"]) == (week2, "Week 2 slides", "Slides")
    course = client.get(f"/courses/{school.course_id}", headers=school.student).json()
    assert {m["title"]: [x["title"] for x in m["materials"]] for m in course["modules"]} == {
        "Week 1": [],
        "Week 2": ["Week 2 slides"],
    }

    replaced = client.post(
        f"{base}/{week2}/materials/{material['id']}/file",
        json={"file_name": "slides-v2.pptx", "content_type": "application/vnd.ms-powerpoint"},
        headers=school.lecturer,
    )
    assert replaced.status_code == 200, replaced.text
    assert replaced.json()["fields"]["key"].endswith("/slides-v2.pptx")
    assert client.get(f"{base}/{week2}/materials/{material['id']}/download", headers=school.student).status_code == 200


def test_file_types_are_limited(client, school):
    week1 = make_module(client, school, "Week 1")
    refused = add_file(client, school, week1, "Setup", "setup.exe")
    assert refused.status_code == 422
    assert ".exe" in refused.json()["detail"]
    assert add_file(client, school, week1, "No extension", "README").status_code == 422
    assert add_file(client, school, week1, "Notebook", "lab1.ipynb").status_code == 201


def test_modules_can_be_reordered(client, school):
    first = make_module(client, school, "First")
    second = make_module(client, school, "Second")
    url = f"/courses/{school.course_id}/modules/order"
    assert client.put(url, json={"module_ids": [second]}, headers=school.lecturer).status_code == 422
    assert client.put(url, json={"module_ids": [second, first]}, headers=school.student).status_code == 403
    assert client.put(url, json={"module_ids": [second, first]}, headers=school.lecturer).status_code == 200
    course = client.get(f"/courses/{school.course_id}", headers=school.student).json()
    assert [m["title"] for m in course["modules"]] == ["Second", "First"]
