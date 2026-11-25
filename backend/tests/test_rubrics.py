"""Basic rubrics (#45)."""

from datetime import UTC, datetime, timedelta

ESSAY_RUBRIC = {
    "title": "Essay rubric",
    "criteria": [
        {
            "title": "Structure",
            "description": "Clear introduction, body and conclusion",
            "ratings": [
                {"title": "Excellent", "points": 5},
                {"title": "Good", "points": 3},
                {"title": "Needs work", "points": 0},
            ],
        },
        {
            "title": "Code quality",
            "ratings": [{"title": "Excellent", "points": 10}, {"title": "OK", "points": 5}],
        },
    ],
}


def days(n):
    return (datetime.now(UTC) + timedelta(days=n)).isoformat()


def make_rubric(client, school, body=ESSAY_RUBRIC):
    response = client.post(f"/courses/{school.course_id}/rubrics", json=body, headers=school.lecturer)
    assert response.status_code == 201, response.text
    return f"/courses/{school.course_id}/rubrics/{response.json()['id']}", response.json()


def make_assignment(client, school, **fields):
    body = {"title": "Essay", "due_at": days(7), "max_mark": 30, "weight": 20, **fields}
    response = client.post(f"/courses/{school.course_id}/assignments", json=body, headers=school.lecturer)
    assert response.status_code == 201, response.text
    return f"/courses/{school.course_id}/assignments/{response.json()['id']}", response.json()


def rating_id(rubric, criterion_title, rating_title):
    criterion = next(c for c in rubric["criteria"] if c["title"] == criterion_title)
    return criterion["id"], next(r["id"] for r in criterion["ratings"] if r["title"] == rating_title)


def choose(rubric, **picks):
    """choose(rubric, Structure="Good") -> {criterion_id: rating_id}"""
    chosen = {}
    for criterion_title, rating_title in picks.items():
        criterion, rating = rating_id(rubric, criterion_title.replace("_", " "), rating_title)
        chosen[criterion] = rating
    return chosen


# The rubric model: criteria, rating levels and points
def test_lecturer_creates_reads_updates_and_deletes_a_rubric(client, school):
    url, rubric = make_rubric(client, school)
    assert rubric["points_possible"] == 5 + 10
    structure = rubric["criteria"][0]
    assert (structure["title"], structure["max_points"]) == ("Structure", 5)
    assert [(r["title"], r["points"]) for r in structure["ratings"]] == [("Excellent", 5), ("Good", 3), ("Needs work", 0)]
    assert all(r["id"] for c in rubric["criteria"] for r in c["ratings"])
    assert rubric["assignment_ids"] == []

    assert client.get(url, headers=school.lecturer).json() == rubric
    listed = client.get(f"/courses/{school.course_id}/rubrics", headers=school.lecturer).json()
    assert [r["title"] for r in listed] == ["Essay rubric"]

    renamed = client.patch(url, json={"title": "Essay rubric v2"}, headers=school.lecturer).json()
    assert (renamed["title"], renamed["points_possible"], renamed["criteria"]) == (
        "Essay rubric v2",
        15,
        rubric["criteria"],
    )
    replaced = client.patch(
        url,
        json={"criteria": [{"title": "Overall", "ratings": [{"title": "Pass", "points": 1}, {"title": "Fail", "points": 0}]}]},
        headers=school.lecturer,
    ).json()
    assert ([c["title"] for c in replaced["criteria"]], replaced["points_possible"]) == (["Overall"], 1)
    assert replaced["updated_at"] is not None

    assert client.delete(url, headers=school.lecturer).status_code == 204
    assert client.get(url, headers=school.lecturer).status_code == 404
    assert client.patch(url, json={"title": "X"}, headers=school.lecturer).status_code == 404
    assert client.delete(url, headers=school.lecturer).status_code == 404


def test_rubrics_must_make_sense(client, school):
    url = f"/courses/{school.course_id}/rubrics"
    bad = [
        {"title": "No criteria", "criteria": []},
        {"title": "No ratings", "criteria": [{"title": "A", "ratings": []}]},
        {"title": "Worth nothing", "criteria": [{"title": "A", "ratings": [{"title": "Zero", "points": 0}]}]},
        {"title": "Negative", "criteria": [{"title": "A", "ratings": [{"title": "Minus", "points": -1}]}]},
        {"title": "", "criteria": ESSAY_RUBRIC["criteria"]},
    ]
    for body in bad:
        assert client.post(url, json=body, headers=school.lecturer).status_code == 422, body
    rubric_url, _ = make_rubric(client, school)
    zero = {"criteria": [{"title": "A", "ratings": [{"title": "Zero", "points": 0}]}]}
    assert client.patch(rubric_url, json=zero, headers=school.lecturer).status_code == 422


def test_only_course_staff_manage_rubrics(client, school):
    url, _ = make_rubric(client, school)
    rubrics = f"/courses/{school.course_id}/rubrics"
    assert client.post(rubrics, json=ESSAY_RUBRIC, headers=school.student).status_code == 403
    assert client.get(rubrics, headers=school.student).status_code == 403
    assert client.get(url, headers=school.student).status_code == 403
    assert client.patch(url, json={"title": "X"}, headers=school.student).status_code == 403
    assert client.delete(url, headers=school.student).status_code == 403
    assert client.get(rubrics, headers=school.outsider).status_code == 404
    assert client.get(url, headers=school.admin).status_code == 200


# Attaching a rubric to an assignment
def test_a_rubric_is_attached_to_an_assignment(client, school):
    rubric_url, rubric = make_rubric(client, school)
    assignment_url, assignment = make_assignment(client, school, rubric_id=rubric["id"])
    assert assignment["rubric_id"] == rubric["id"]

    lecturer_view = client.get(assignment_url, headers=school.lecturer).json()
    assert lecturer_view["rubric"]["title"] == "Essay rubric"
    assert lecturer_view["rubric"]["assignment_ids"] == [assignment["id"]]
    # Students see the criteria they'll be marked on, but not where else the rubric is used.
    student_view = client.get(assignment_url, headers=school.student).json()
    assert [c["title"] for c in student_view["rubric"]["criteria"]] == ["Structure", "Code quality"]
    assert student_view["rubric"]["assignment_ids"] == []

    # A rubric in use can't be deleted; detach it first.
    assert client.delete(rubric_url, headers=school.lecturer).status_code == 409
    detached = client.patch(assignment_url, json={"rubric_id": None}, headers=school.lecturer)
    assert detached.status_code == 200 and detached.json()["rubric_id"] is None
    assert client.get(assignment_url, headers=school.lecturer).json()["rubric"] is None
    assert client.delete(rubric_url, headers=school.lecturer).status_code == 204

    url = f"/courses/{school.course_id}/assignments"
    bad = {"title": "X", "due_at": days(3), "rubric_id": "nope"}
    assert client.post(url, json=bad, headers=school.lecturer).status_code == 422
    assert client.patch(assignment_url, json={"rubric_id": "nope"}, headers=school.lecturer).status_code == 422


# Grading with a rubric calculates the score
def test_grading_with_a_rubric_calculates_the_mark(client, school):
    _, rubric = make_rubric(client, school)
    assignment_url, assignment = make_assignment(client, school, rubric_id=rubric["id"], max_mark=30)
    client.post(f"{assignment_url}/submission", json={"text": "My essay"}, headers=school.student)

    structure, _ = rating_id(rubric, "Structure", "Good")
    graded = client.put(
        f"{assignment_url}/submissions/{school.student_id}/rubric-grade",
        json={
            "ratings": choose(rubric, Structure="Good", Code_quality="Excellent"),
            "comments": {structure: "Conclusion is a bit short"},
            "feedback": "Well done overall",
        },
        headers=school.lecturer,
    )
    assert graded.status_code == 200, graded.text
    result = graded.json()
    assessment = result["rubric_assessment"]
    # 3 + 10 = 13 of 15 points, scaled to the assignment's 30 marks = 26.
    assert (assessment["score"], assessment["points_possible"], assessment["mark"]) == (13, 15, 26)
    assert (result["mark"], result["feedback"], result["released"]) == (26, "Well done overall", False)
    assert [(c["title"], c["rating_title"], c["points"], c["max_points"]) for c in assessment["criteria"]] == [
        ("Structure", "Good", 3, 5),
        ("Code quality", "Excellent", 10, 10),
    ]
    assert assessment["criteria"][0]["comment"] == "Conclusion is a bit short"

    # The mark feeds the gradebook like any other.
    book = client.get(f"/courses/{school.course_id}/gradebook", headers=school.lecturer).json()
    assert book["rows"][0]["cells"][assignment["id"]]["mark"] == 26


def test_rubric_marks_round_to_the_nearest_whole_mark(client, school):
    two_points = {
        "title": "Small",
        "criteria": [
            {"title": "A", "ratings": [{"title": "Yes", "points": 1}, {"title": "No", "points": 0}]},
            {"title": "B", "ratings": [{"title": "Yes", "points": 3}, {"title": "No", "points": 0}]},
        ],
    }
    _, rubric = make_rubric(client, school, two_points)
    assignment_url, _ = make_assignment(client, school, rubric_id=rubric["id"], max_mark=10)
    grade_url = f"{assignment_url}/submissions/{school.student_id}/rubric-grade"

    def mark(a, b):
        response = client.put(grade_url, json={"ratings": choose(rubric, A=a, B=b)}, headers=school.lecturer)
        assert response.status_code == 200, response.text
        return response.json()["mark"]

    assert mark("Yes", "No") == 3  # 1 of 4 points = 2.5 of 10, rounded up
    assert mark("No", "Yes") == 8  # 3 of 4 = 7.5, rounded up
    assert mark("Yes", "Yes") == 10
    assert mark("No", "No") == 0


def test_rubric_grades_must_be_complete_and_valid(client, school):
    _, rubric = make_rubric(client, school)
    assignment_url, _ = make_assignment(client, school, rubric_id=rubric["id"])
    grade_url = f"{assignment_url}/submissions/{school.student_id}/rubric-grade"
    structure, good = rating_id(rubric, "Structure", "Good")
    code, excellent = rating_id(rubric, "Code quality", "Excellent")

    incomplete = client.put(grade_url, json={"ratings": {structure: good}}, headers=school.lecturer)
    assert incomplete.status_code == 422 and "Code quality" in incomplete.json()["detail"]
    # A rating from a different criterion isn't allowed.
    swapped = {structure: excellent, code: good}
    assert client.put(grade_url, json={"ratings": swapped}, headers=school.lecturer).status_code == 422
    extra = {structure: good, code: excellent, "not-a-criterion": good}
    assert client.put(grade_url, json={"ratings": extra}, headers=school.lecturer).status_code == 422
    stray_comment = {"ratings": {structure: good, code: excellent}, "comments": {"nope": "x"}}
    assert client.put(grade_url, json=stray_comment, headers=school.lecturer).status_code == 422
    good_body = {"ratings": {structure: good, code: excellent}}
    assert client.put(grade_url, json=good_body, headers=school.student).status_code == 403

    no_rubric_url, _ = make_assignment(client, school, title="No rubric")
    no_rubric = f"{no_rubric_url}/submissions/{school.student_id}/rubric-grade"
    assert client.put(no_rubric, json=good_body, headers=school.lecturer).status_code == 409
    not_enrolled = f"{assignment_url}/submissions/someone-else/rubric-grade"
    assert client.put(not_enrolled, json=good_body, headers=school.lecturer).status_code == 404


# Students get the completed rubric with their released grade
def test_students_see_the_completed_rubric_once_the_grade_is_released(client, school):
    rubric_url, rubric = make_rubric(client, school)
    assignment_url, assignment = make_assignment(client, school, rubric_id=rubric["id"])
    client.post(f"{assignment_url}/submission", json={"text": "My essay"}, headers=school.student)
    grade_url = f"{assignment_url}/submissions/{school.student_id}/rubric-grade"
    picks = choose(rubric, Structure="Excellent", Code_quality="OK")
    client.put(grade_url, json={"ratings": picks, "feedback": "Nice"}, headers=school.lecturer)

    hidden = client.get(assignment_url, headers=school.student).json()["my_submission"]
    assert (hidden["mark"], hidden["rubric_assessment"]) == (None, None)
    assert client.get("/me/grades", headers=school.student).json() == []

    release = f"/courses/{school.course_id}/assignments/{assignment['id']}/release"
    assert client.post(release, json={"release": True}, headers=school.lecturer).json() == {"updated": 1}
    shown = client.get(assignment_url, headers=school.student).json()["my_submission"]
    assert shown["mark"] == 20 and shown["rubric_assessment"]["score"] == 10
    assert [c["rating_title"] for c in shown["rubric_assessment"]["criteria"]] == ["Excellent", "OK"]
    grades = client.get("/me/grades", headers=school.student).json()
    assert grades[0]["rubric_assessment"]["mark"] == 20

    # Editing the rubric later doesn't change a completed one.
    client.patch(rubric_url, json={"title": "Changed", "criteria": ESSAY_RUBRIC["criteria"][:1]}, headers=school.lecturer)
    kept = client.get(assignment_url, headers=school.student).json()["my_submission"]["rubric_assessment"]
    assert (kept["rubric_title"], len(kept["criteria"])) == ("Essay rubric", 2)

    # A plain mark replaces the rubric, and clearing the grade removes it.
    plain = client.put(
        f"{assignment_url}/submissions/{school.student_id}/grade", json={"mark": 25, "release": True}, headers=school.lecturer
    ).json()
    assert (plain["mark"], plain["rubric_assessment"]) == (25, None)
    client.put(grade_url, json={"ratings": choose(client.get(rubric_url, headers=school.lecturer).json(), Structure="Good")}, headers=school.lecturer)
    assert client.delete(f"{assignment_url}/submissions/{school.student_id}/grade", headers=school.lecturer).status_code == 204
    cleared = client.get(f"{assignment_url}/submissions", headers=school.lecturer).json()[0]
    assert (cleared["mark"], cleared["rubric_assessment"]) == (None, None)


def test_offline_work_can_be_graded_with_a_rubric(client, school):
    _, rubric = make_rubric(client, school)
    assignment_url, _ = make_assignment(client, school, rubric_id=rubric["id"], submission_type="none")
    response = client.put(
        f"{assignment_url}/submissions/{school.student_id}/rubric-grade",
        json={"ratings": choose(rubric, Structure="Excellent", Code_quality="Excellent"), "release": True},
        headers=school.lecturer,
    )
    assert response.status_code == 200, response.text
    assert (response.json()["mark"], response.json()["submitted_at"]) == (30, None)
