# AI & Insights: User Stories and Business Requirements

**Issue:** [#121](https://github.com/Red-dish/PerceptionLMS/issues/121) (KAN-84) · **Epic:** [#118 AI & Insights](https://github.com/Red-dish/PerceptionLMS/issues/118) (KAN-81)
**Covers:** [#120 At-risk prediction](https://github.com/Red-dish/PerceptionLMS/issues/120), [#123 Course chatbot](https://github.com/Red-dish/PerceptionLMS/issues/123), [#124 Study recommendations](https://github.com/Red-dish/PerceptionLMS/issues/124)
**Author:** Apeksha (Business Analyst) · **Reviewer:** Amora · **Due:** Wed 18 Nov 2026
**Status:** Draft for team review

This document sets the business requirements for the three AI features Doctor Mo asked for in Session 4. The user stories and acceptance criteria below are the "done" criteria for the backend and frontend work on #120, #123 and #124. Section 1 answers the Task 1 dataset questions from the business side.

---

## 1. Task 1: The student dataset from the business side

Source file: `students_demo.csv` (sample data from Doctor Mo).

### Q1. How many students are in the dataset?

**400 students**, one row each (IDs `S001` to `S400`). Every row is complete, with no blank values.

- **114 students (28.5%)** are marked at risk.
- **286 students (71.5%)** are not at risk.

### Q2. What information do we have about each student?

| Column | Meaning | Range in data | Where it would come from in our LMS |
|---|---|---|---|
| `student_id` | Unique student ID | S001 to S400 | User record |
| `student_name` | Name (anonymised, "Demo Student 001") | n/a | User record |
| `attendance_pct` | Share of classes attended | 25% to 100% (average 76%) | Attendance (not yet tracked, see assumption A1) |
| `quiz_average` | Average quiz score | 18 to 100 (average 69) | Quizzes and gradebook (#48, #49) |
| `missed_assignments` | Assignments not submitted | 0 to 5 (average 1.1) | Late and missing handling (#43) |
| `weekly_logins` | Logins per week | 0 to 13 (average 5.3) | Sign-in activity log |
| `days_since_login` | Days since last login | 0 to 14 (average 4.9) | Sign-in activity log |
| `at_risk` | Whether the student is at risk (1 = yes, 0 = no) | 0 or 1 | **What the model predicts** |

How at-risk students differ from the rest (averages):

| Measure | At risk | Not at risk | What it tells us |
|---|---|---|---|
| Attendance | 67.5% | 79.7% | About 12 points lower |
| Quiz average | 59.6 | 72.5 | About 13 points lower |
| Missed assignments | 1.6 | 1.0 | More missed work |
| Weekly logins | 4.4 | 5.7 | Less engaged online |
| Days since last login | 5.7 | 4.6 | Away from the LMS for longer |

All five measures point the same way, so the data should be useful for predicting risk. Attendance and quiz scores show the biggest gaps.

### Q3. Which column tells us whether a student is at risk?

**`at_risk`.** It is the label (target) the Machine Learning model learns to predict: `1` means at risk, `0` means not at risk. The other five numeric columns are the inputs (features). `student_id` and `student_name` identify the student and must **not** be used as inputs.

### Q4. How could we use this information in our Canvas-like system?

1. **Early warning for lecturers (#120).** Show each lecturer which students in their course may be struggling, and why, so they can step in weeks before a final grade is lost.
2. **Nudges for students.** Tell a student, in a supportive tone, when their activity drops (for example "You haven't logged in for 7 days and have 2 missing assignments").
3. **Personalised study recommendations (#124).** Use low quiz scores and missed work to suggest which modules, quizzes or materials to revisit next.
4. **Context for the course chatbot (#123).** The chatbot can answer "What's due this week?" or "What should I work on?" using the student's own deadlines and progress.
5. **Reports for administrators and management.** Show at-risk numbers per course and over time so the college can plan support services and measure whether interventions work.

What this means for the build:

- Most inputs already exist in the LMS (quizzes, assignments, sign-ins). **Attendance is not tracked yet** and needs a decision (assumption A1).
- The sample data is anonymised demo data. Real student data falls under our [DPIA](../Compliance/dpia.md) and [Privacy Policy](../Compliance/privacy-policy.md).

---

## 2. Roles

| Role | What they want from AI |
|---|---|
| Student | Help with course questions and knowing what to study next |
| Lecturer | Early sight of students who need support, without extra admin |
| Administrator | Oversight across courses, control over AI features, and assurance they are fair and safe |

---

## 3. User stories

Priority uses MoSCoW: **Must**, **Should**, **Could**.

### 3.1 At-risk alerts (#120)

| ID | User story | Priority |
|---|---|---|
| AR-01 | As a **lecturer**, I want to see which students in my course are at risk so that I can offer support early. | Must |
| AR-02 | As a **lecturer**, I want to see the reasons behind a student's at-risk flag so that I know what kind of support to give. | Must |
| AR-03 | As a **lecturer**, I want to record that I have contacted an at-risk student so that I can track follow-ups. | Should |
| AR-04 | As a **student**, I want to be told kindly when my engagement drops so that I can get back on track before it affects my grade. | Should |
| AR-05 | As an **administrator**, I want a summary of at-risk students across all courses so that I can direct support services where they are needed. | Should |
| AR-06 | As an **administrator**, I want to switch at-risk alerts on or off per course so that we control how AI is used. | Could |

### 3.2 Course chatbot (#123)

| ID | User story | Priority |
|---|---|---|
| CB-01 | As a **student**, I want to ask a chatbot questions about my course so that I get answers at any time without waiting for my lecturer. | Must |
| CB-02 | As a **student**, I want the chatbot to tell me my upcoming deadlines and assignment details so that I don't miss work. | Must |
| CB-03 | As a **student**, I want the chatbot to show where its answer came from (for example the syllabus or a module page) so that I can trust it and read more. | Must |
| CB-04 | As a **lecturer**, I want the chatbot to answer only from my course materials so that students don't get wrong or off-topic information. | Must |
| CB-05 | As a **lecturer**, I want to see the most common questions students ask so that I can improve my materials or address confusion in class. | Could |
| CB-06 | As an **administrator**, I want to turn the chatbot on or off per course and review flagged conversations so that it is used safely. | Should |

### 3.3 Study recommendations (#124)

| ID | User story | Priority |
|---|---|---|
| SR-01 | As a **student**, I want recommendations on what to study next based on my quiz results so that I focus on my weakest topics. | Must |
| SR-02 | As a **student**, I want each recommendation to explain why it was suggested so that I understand how it helps me. | Must |
| SR-03 | As a **student**, I want to mark a recommendation as done or not helpful so that my suggestions stay relevant. | Should |
| SR-04 | As a **lecturer**, I want to see which topics are most often recommended in my course so that I can spot topics the class finds hard. | Could |
| SR-05 | As an **administrator**, I want to switch recommendations on or off per course so that we control rollout. | Could |

---

## 4. Acceptance criteria

Written as **Given / When / Then** so they can be tested directly.

### 4.1 At-risk alerts

**AR-01 See at-risk students**
- Given I am a lecturer on a course, when I open the course's at-risk view, then I see a list of my enrolled students flagged as at risk.
- The list shows each student's name, risk level (High / Medium / Low) and the date the prediction was made.
- I only see students in courses I teach. A student or another lecturer cannot open this view (returns "not authorised").
- If the model has no data for a student (for example a new enrolment), the student is shown as "Not enough data", not as safe.

**AR-02 Reasons behind the flag**
- Given a student is flagged, when I open their entry, then I see the measures that drove the flag in plain English (for example "Attendance 48%, course average 76%").
- Measures shown are the five from the dataset: attendance, quiz average, missed assignments, weekly logins and days since last login.
- The screen states that the flag is a prediction to support judgement, not a final decision.

**AR-03 Record follow-up**
- Given I am viewing an at-risk student, when I mark "Contacted" and add an optional note, then the date and my name are saved and shown on the list.
- Notes are visible only to lecturers on that course and administrators.

**AR-04 Student nudge**
- Given my engagement drops (for example no login for 7 days or 2 or more missing assignments), when I next sign in, then I see a supportive message with a link to my missing work.
- The message never uses the words "at risk" or shows a risk score.
- I see at most one nudge per week.

**AR-05 Admin summary**
- Given I am an administrator, when I open the AI insights report, then I see the number and percentage of at-risk students per course.
- I can filter by course and export the summary as CSV.

**AR-06 Turn on or off**
- Given I am an administrator, when I switch at-risk alerts off for a course, then lecturers on that course no longer see the view and no new predictions are made for it.

### 4.2 Course chatbot

**CB-01 Ask a question**
- Given I am a student enrolled in a course, when I type a question in the course chatbot, then I get an answer within 10 seconds.
- The chatbot only uses courses I am enrolled in.
- If it cannot answer, it says so and suggests contacting the lecturer, instead of guessing.

**CB-02 Deadlines**
- Given I ask "What's due this week?", then the chatbot lists my assignments and quizzes due in the next 7 days with their due dates, matching the course calendar.

**CB-03 Sources**
- Every answer based on course content links to the page, module or file it used.

**CB-04 Course materials only**
- The chatbot answers only from published materials for that course. It does not use unpublished content or other courses' content.
- It refuses to write graded assignments for the student and reminds them of the academic integrity policy.

**CB-05 Common questions**
- Given I am a lecturer, when I open chatbot insights, then I see the top 10 question topics for my course over the last 30 days, with no student names attached.

**CB-06 Admin control**
- Given I am an administrator, I can enable or disable the chatbot per course.
- Students can flag an answer as wrong or inappropriate, and flagged conversations appear in an admin review list.

### 4.3 Study recommendations

**SR-01 What to study next**
- Given I have completed at least one quiz in a course, when I open my dashboard, then I see up to 3 recommendations for that course.
- Recommendations link to real items in the course (a module, page, file or practice quiz).
- Topics where I scored lowest come first.
- If I have no quiz results yet, I see a general "Start here" suggestion instead.

**SR-02 Why it was suggested**
- Each recommendation shows a short reason (for example "You scored 45% on the Week 3 quiz").

**SR-03 Feedback**
- I can mark a recommendation "Done" or "Not helpful". It is then replaced by the next best recommendation.

**SR-04 Lecturer topic view**
- Given I am a lecturer, I see the topics most often recommended across my class, without individual student names.

**SR-05 Admin control**
- Given I am an administrator, I can switch recommendations on or off per course.

### 4.4 Rules that apply to all three features

- **Privacy:** Students see only their own data. Lecturers see only their courses. All access follows existing role permissions (FR-07).
- **Human in the loop:** AI output supports staff and students. It never changes grades, enrolments or records automatically.
- **Transparency:** Every AI screen shows a short note that the content is AI-generated.
- **Accessibility:** All new screens meet WCAG 2.2 AA (NFR-05).
- **Fairness:** Personal characteristics (age, gender, ethnicity and similar) are never used as model inputs.

---

## 5. Success measures

How we will know each feature is working, for the prototype demo and after launch.

| Feature | Measure | Target (prototype) | Target (after launch) |
|---|---|---|---|
| At-risk alerts | Model finds the students who really are at risk (recall on test data) | 80% or more | 80% or more |
| At-risk alerts | Flagged students who really are at risk (precision on test data) | 70% or more | 70% or more |
| At-risk alerts | Lecturers who open the at-risk view each week | Demo works end to end | 60% of lecturers |
| At-risk alerts | Flagged students contacted within 7 days | n/a | 50% |
| At-risk alerts | Flagged students whose engagement improves within 4 weeks | n/a | 30% |
| Chatbot | Answers rated helpful by students | Correct on 8 of 10 test questions | 75% helpful |
| Chatbot | Answers with a source link | 100% of content answers | 100% |
| Chatbot | Answer time | Under 10 seconds | Under 5 seconds |
| Chatbot | Reduction in repeat "when is it due?" messages to lecturers | n/a | 25% fewer |
| Recommendations | Recommendations opened by students | Demo works end to end | 40% |
| Recommendations | Recommendations marked "Not helpful" | n/a | Under 20% |
| Recommendations | Quiz score improvement on recommended topics | n/a | +10 points on next attempt |

Why recall comes first for at-risk alerts: missing a struggling student costs more than a lecturer checking on a student who turns out to be fine.

---

## 6. How the stories map to the build

| Issue | Stories | Backend needs | Frontend needs |
|---|---|---|---|
| [#120](https://github.com/Red-dish/PerceptionLMS/issues/120) At-risk prediction | AR-01 to AR-06 | Trained model; prediction API per course and student with reasons; follow-up notes; admin summary and CSV; course on/off setting | Lecturer at-risk view and detail; student nudge banner; admin report |
| [#123](https://github.com/Red-dish/PerceptionLMS/issues/123) Course chatbot | CB-01 to CB-06 | Chat API limited to enrolled courses' published content; deadline lookup; source links; flagging and topic stats; course on/off setting | Chat panel in course; source links; flag button; lecturer insights; admin review list |
| [#124](https://github.com/Red-dish/PerceptionLMS/issues/124) Study recommendations | SR-01 to SR-05 | Recommendation API from quiz results and missed work; feedback; topic stats; course on/off setting | Dashboard recommendation cards with reasons; Done / Not helpful buttons; lecturer topic view |

**Suggested order:** #120 first (Must, due 18 Nov, uses the Task 1 data directly), then #124 (reuses the same student measures), then #123 (largest build).

---

## 7. Assumptions and open questions for Doctor Mo

| ID | Question | Why it matters |
|---|---|---|
| A1 | Will attendance be recorded in the LMS, imported from another system, or left out? | It is the strongest predictor in the data but the LMS doesn't track it yet. |
| A2 | Should students ever see their own at-risk status? | We have assumed no (AR-04 uses a gentle nudge instead). |
| A3 | How is "at risk" defined in the real data (fail, withdraw, below a grade)? | The model can only be as good as the label it learns from. |
| A4 | Can we use real (anonymised) student data to train the model, and has consent been given? | Needed for the DPIA and privacy compliance. |
| A5 | Which AI provider is approved for the chatbot, and can course content be sent to it? | Affects cost, privacy and data residency. |
| A6 | Who acts on an at-risk flag: the lecturer, student support, or both? | Decides who gets access to AR-01 and AR-05. |

---

**Next step:** Amora to review and confirm the acceptance criteria for #120 before 18 Nov. Owners for #123 and #124 to use sections 3 to 6 once assigned.
