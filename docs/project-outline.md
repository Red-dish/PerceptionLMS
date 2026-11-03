# Project Outline: Perception LMS

## 1. Executive Summary

ASA College is moving away from Canvas. Perception LMS is a proposed replacement: a web-based Learning Management System built around the college's own needs, for three kinds of user: students, lecturers and administrators.

The project is run by a team of seven students: a technical team of four who build the platform, and a business, compliance and governance team of three who own the plan, the business case and the legal and accessibility work. Work runs in one-week cycles from 2 Nov 2026, with a deliverable set by our lecturer each week (see [tasks.md](product%20build/tasks.md)).

The MVP lets people:

- sign in with Google, with access based on their role;
- see a dashboard of their courses and upcoming deadlines;
- read and download course materials;
- submit assignments and see grades and feedback;
- (lecturers) manage course content, assignments, grading and announcements;
- (administrators) manage users, roles and course enrolments.

The platform runs on AWS with no servers to manage, so it costs very little at college scale. It lives at **perceptionlms.com**, with DNS managed in Cloudflare.

## 2. Solutions Architect

```
Browser (React frontend, perceptionlms.com)
  │  1. "Sign in with Google" button → Google ID token
  │  2. POST /auth/google → API session token (8 hours)
  │  3. API requests with "Authorization: Bearer <token>"
  ▼
API Gateway (HTTP API) ──► AWS Lambda: FastAPI app (Python 3.14 container image)
                               │            │
                               ▼            ▼
                           DynamoDB     S3 bucket (private)
                         (one table)        ▲
  Browser ── signed upload/download links ──┘  (files never pass through Lambda)
```

| Layer | Choice | Why |
| --- | --- | --- |
| Domain and DNS | perceptionlms.com, DNS in Cloudflare | Free DNS, HTTPS and protection in front of the site |
| Frontend | React (Vite dev server on `localhost:5173`) | Responsive web, no native apps needed |
| Sign-in | Sign in with Google | No passwords to store or reset; only people an admin has added can get in |
| API | Python 3.14 FastAPI on AWS Lambda, behind API Gateway | No servers; pay only for requests |
| Database | DynamoDB, one table, on-demand billing | No database server to run |
| Files | S3 with short-lived signed links, 20 MB limit | Lambda can't accept uploads over 6 MB |
| Containers | Podman builds the Lambda image and runs a local AWS stand-in (moto) | Same image on a laptop and in AWS |
| Infrastructure | Terraform | Every AWS resource written down and repeatable |
| CI/CD | GitHub Actions (planned) | Automatic tests and deploys |

Full detail, including the table layout and permission rules: [system-design.md](product%20build/system-design.md). How to run and deploy the code: [backend/README.md](../backend/README.md).

## 3. High Level Requirements

**Functional**

- Only people an administrator has added can sign in, using Google.
- Three roles: student, lecturer (staff) and administrator. Course access comes from enrolments.
- People who aren't enrolled in a course can't see it exists.
- Students see only their own submissions and grades; marks stay hidden until released.
- Lecturers can change content only in courses they teach.
- Administrators manage users, roles, courses and enrolments.
- Every action validates its input and confirms success.

**Non-functional**

- Main screens meet WCAG 2.2 Level AA.
- Works in a phone or desktop browser.
- Files stored privately and only reachable through signed, short-lived links.
- Deactivating a user or changing their role takes effect on their next request.
- Privacy, copyright, security and data-retention documents are complete before the final demonstration.

**Out of scope for the MVP:** attendance, calendar, notifications, quizzes, analytics, discussion forums, college single sign-on, and Canvas data migration.

## 4. Detailed Requirement in the form of a user story

| # | User story | Acceptance criteria |
| --- | --- | --- |
| 1 | **Student dashboard:** As a student, I want to view my enrolled courses and upcoming deadlines so that I can organise my studies. | I see only courses I'm enrolled in, and assignments due soon. |
| 2 | **Course materials:** As a student, I want to access course modules and learning resources so that I can study online. | I see published modules and can download their materials. |
| 3 | **Assignment submission:** As a student, I want to submit assignments online so that I can complete assessments through the LMS. | I can upload a file or text and get a confirmation. |
| 4 | **Grades and feedback:** As a student, I want to view my grades and lecturer feedback so that I can track my academic progress. | I see my own marks and feedback once the lecturer releases them. |
| 5 | **Course management:** As a lecturer, I want to upload learning materials and manage course content so that students can access relevant resources. | I can add, change and remove modules and materials in my courses only. |
| 6 | **Assignment management:** As a lecturer, I want to create assignments, set deadlines, and grade submissions so that I can manage assessments efficiently. | I can create assignments with deadlines, see submissions, and grade them. |
| 7 | **Announcements:** As a lecturer, I want to publish course announcements so that students receive important updates. | Enrolled students see my announcements on the course. |
| 8 | **User management:** As an administrator, I want to manage users and course enrollments so that the correct people have access to the platform. | I can add, deactivate and change users, and enrol them in courses as lecturer or student. |

Source: [user-stories-mvp.md](product%20management/user-stories-mvp.md).
