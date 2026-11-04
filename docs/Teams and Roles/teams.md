

## Team of 7

The seven members split into two teams: a technical team of 4 who build the platform, and a business, compliance and governance team of 3 who own the plan, the business case and everything that keeps the project legal, safe and on track. Neither team needs the other's skills, but every week ends with a joint review.

**Technical team (4)**

| Role | Person | Owns | Backs up |
| --- | --- | --- | --- |
| 1. Tech lead and backend developer | Amora | Architecture decisions, database, login and roles, courses and enrolment API, user admin API | Role 2 |
| 2. Backend developer | Roshan | Uploading and downloading materials, assignments and submissions, grades and feedback, announcements | Role 1 |
| 3. Frontend developer (student portal) | Dipesh (primary), Bishu (secondary) | Login, student dashboard, course page and materials, submitting assignments, grades, announcements | Role 4 |
| 4. Full-stack developer and DevOps | Amora and Dipesh | Lecturer screens, admin screens, repo and CI/CD, hosting, automated tests | Role 3 |

**Business, compliance and governance team (3)**

These three also build a few v1 features with AI coding agents; see [v1 modules](#v1-modules-github-epics) below.

| Role | Person | Owns | Backs up |
| --- | --- | --- | --- |
| 5. Project manager and governance lead | Nancy | Scope and user stories, Jira board, meetings and minutes, RACI chart, risk register, decision log, final report and presentation | Role 7 |
| 6. Business analyst and UX designer | Apeksha and Bishu | Market and competitor research, business case and cost comparison with Canvas, personas, wireframes and design review, usability testing, rollout and adoption plan | Role 5 |
| 7. Compliance and risk officer | Yoodem | Privacy law requirements, privacy policy and terms, copyright for lecturer content, accessibility (WCAG) audit, data protection impact assessment, security and data-retention policies | Role 6 |

The business team also runs user acceptance testing: they write test scenarios from the user stories and test each release by hand, which frees the developers to build.

Work is tracked in the Perception LMS (KAN) Jira project. Our lecturer sets a deliverable each week, and each one becomes an epic of tasks in Jira; see [tasks.md](../Product%20Build/tasks.md) for this week's list.

## v1 modules (GitHub epics)

To move faster, our lecturer asked us to break a basic Canvas-style v1 into modules. Each module is a GitHub issue labelled `epic`, with its features linked as sub-issues labelled `feature`. Each feature lists what is already built and its acceptance criteria, so it can be handed to an AI coding agent.

| Epic | Owner | Features |
| --- | --- | --- |
| [#27 Identity, Roles & Administration](https://github.com/Red-dish/PerceptionLMS/issues/27) | Amora | #28–#32 |
| [#33 Courses & Content](https://github.com/Red-dish/PerceptionLMS/issues/33) | Dipesh | #34–#39 |
| [#40 Assignments & Submissions](https://github.com/Red-dish/PerceptionLMS/issues/40) | Roshan | #41–#45 |
| [#46 Quizzes & Gradebook](https://github.com/Red-dish/PerceptionLMS/issues/46) | Yoodem | #47–#51 |
| [#52 Communication & Dashboard](https://github.com/Red-dish/PerceptionLMS/issues/52) | Nancy | #53–#58 |

Features are assigned by the roles above, so one person's features can sit under several epics:

| Person | Features |
| --- | --- |
| Amora | #29 Roles and permissions, #30 Admin user management, #31 Admin course and enrolment management, #34 Course settings, #44 Teacher grading view |
| Roshan | #37 Files, #41 Assignment creation, #43 Late, missing and resubmission, #49 Teacher gradebook, #54 Announcements |
| Dipesh | #28 Sign in with Google, #35 Modules, #38 Course home and syllabus, #42 Student submission, #50 Student grades view |
| Bishu | #32 User profile, #36 Pages, #39 Course navigation, #53 Dashboard |
| Yoodem | #45 Basic rubrics, #47 Quiz builder, #48 Quiz taking and auto-grading |
| Nancy | #55 Discussions, #56 Inbox, #58 Notifications |
| Apeksha | #51 Grade export, #57 Calendar |

Apeksha, as business analyst, is also on every epic to track progress. The business team's features were on the Later list, so they don't block the core build.

## Tech stack

| Layer | Choice | Replaces at scale |
| --- | --- | --- |
| Frontend | React or Next.js, responsive web (no native apps) | Separate web, iOS and Android apps |
| Backend | Python 3.14 FastAPI on AWS Lambda, behind API Gateway (HTTP API) | Separate services behind a gateway |
| Sign-in | Sign in with Google | College single sign-on (SAML/OIDC) |
| Database | DynamoDB, one table, on-demand billing | Same, with the table split by access pattern |
| File storage | S3 with signed upload and download links (course materials and submissions) | Same, with retention rules and a CDN |
| Containers | Podman builds the Lambda image and runs local stand-ins for AWS | Same |
| Infrastructure | Terraform | Same, with separate dev and prod accounts |
| CI/CD | GitHub Actions | Same |

The backend code and setup steps are in [backend/README.md](../../backend/README.md); the design is in [system-design.md](../Product%20Build/system-design.md).

Quizzes, calendar and notifications now have v1 features under the epics above. Attendance, analytics, single sign-on and Canvas data migration stay on the Later list in [tasks.md](../Product%20Build/tasks.md) rather than being built.

