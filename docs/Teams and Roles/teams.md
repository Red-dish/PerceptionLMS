

## Team of 7

The seven members split into two teams: a technical team of 4 who build the platform, and a business, compliance and governance team of 3 who own the plan, the business case and everything that keeps the project legal, safe and on track. Neither team needs the other's skills, but every week ends with a joint review.

Amora leads the technical team, with Bishu leading the frontend. Apeksha leads the business team.

**Technical team (4)**

| Role | Person | Owns | Backs up |
| --- | --- | --- | --- |
| 1. Tech lead, backend and DevOps | Amora | Architecture decisions, the whole API (sign-in and roles, courses and enrolment, materials and files, assignments and grades, announcements, user admin), database, infrastructure, hosting and deployment, CI/CD | Nobody yet |
| 2. Frontend team lead | Bishu | Frontend direction, UI design, reviewing and merging frontend PRs into the `frontend` branch, plus frontend features | Role 3 |
| 3. Frontend developers | Dipesh and Roshan | Screens, UI design and features for students, lecturers and admins, picked up ticket by ticket in Jira | Role 2 |

**Testing (QA) is shared by the whole technical team.** Whoever is free tests: checking a PR before it's merged, writing automated tests, or testing a release by hand against the user stories. Nobody tests their own PR alone.

**Business, compliance and governance team (3)**

This team doesn't build features: every v1 feature is owned by the technical team (see [v1 modules](#v1-modules-github-epics) below). Apeksha tracks progress on every epic.

| Role | Person | Owns | Backs up |
| --- | --- | --- | --- |
| 4. Business team lead and business analyst | Apeksha | Leading the business team, market and competitor research, business case and cost comparison with Canvas, personas, design review with Bishu, usability testing, rollout and adoption plan | Role 5 |
| 5. Project manager and governance lead | Nancy | Scope and user stories, Jira board, meetings and minutes, RACI chart, risk register, decision log, final report and presentation | Role 6 |
| 6. Compliance and risk officer | Yoodem | Privacy law requirements, privacy policy and terms, copyright for lecturer content, accessibility (WCAG) audit, data protection impact assessment, security and data-retention policies | Role 4 |

Work is tracked in the Perception LMS (KAN) Jira project. Our lecturer sets a deliverable each week, and each one becomes an epic of tasks in Jira; see [tasks.md](../Product%20Build/tasks.md) for this week's list.

## v1 modules (GitHub epics)

To move faster, our lecturer asked us to break a basic Canvas-style v1 into modules. Each module is a GitHub issue labelled `epic`, with its features linked as sub-issues labelled `feature`. Each feature lists what is already built and its acceptance criteria, so it can be handed to an AI coding agent.

| Epic | Lead | Open features |
| --- | --- | --- |
| [#27 Identity, Roles & Administration](https://github.com/Red-dish/PerceptionLMS/issues/27) | Amora | #32 |
| [#33 Courses & Content](https://github.com/Red-dish/PerceptionLMS/issues/33) | Bishu | #36, #37 |
| [#40 Assignments & Submissions](https://github.com/Red-dish/PerceptionLMS/issues/40) | Roshan | #43, #44, #45 |
| [#46 Quizzes & Gradebook](https://github.com/Red-dish/PerceptionLMS/issues/46) | Dipesh | #47, #48, #49, #51 |
| [#52 Communication & Dashboard](https://github.com/Red-dish/PerceptionLMS/issues/52) | Bishu | #55, #56, #57, #58 |

The epic lead keeps the epic moving; Apeksha is on every epic to track progress for the business team.

### Who builds each open feature

Every feature has two owners, following the roles above: **Amora builds the API**, and **one frontend developer builds the screens**. Finish the core features before starting any "after core" one. The after-core features were on the Later list, so they must not hold up the core build. "Done" in the API column means the endpoints exist, so the screens can start.

| Feature | Screens | API | When |
| --- | --- | --- | --- |
| #32 User profile and settings | Bishu | Amora | Core |
| #36 Pages | Bishu | Amora | Core |
| #37 Files | Roshan | Done (Roshan, PR #85) | Core |
| #43 Late, missing and resubmission | Roshan | Done (Roshan, PR #85) | Core |
| #44 Teacher submission review and grading view | Dipesh | Done (Amora; extras from PR #85) | Core |
| #49 Teacher gradebook | Roshan | Done (Roshan, PR #85) | Core |
| #45 Basic rubrics | Roshan | Amora | After core |
| #47 Quiz builder | Dipesh | Amora | After core |
| #48 Quiz taking and auto-grading | Dipesh | Amora | After core |
| #51 Grade export (CSV) | Roshan | Done (Roshan, PR #85) | After core |
| #55 Discussions | Dipesh | Amora | After core |
| #56 Inbox (direct messaging) | Dipesh | Amora | After core |
| #57 Calendar | Bishu | Amora | After core |
| #58 Notifications | Bishu | Amora | After core |

In total, Bishu has 4 features (fewer, because Bishu also reviews every frontend PR), Dipesh has 5 and Roshan has 5.

**Already done (closed):** #28 Sign in with Google, #29 Roles and permissions, #30 Admin user management, #31 Admin course and enrolment management, #34 Course creation and settings, #35 Modules, #38 Course home and syllabus, #39 Course navigation, #41 Assignment creation, #42 Student submission, #50 Student grades view, #53 Dashboard, #54 Announcements.

### Who has built what so far (10 Nov)

The roles above are the plan from 8 Nov. The code in the app today was written by:

- **Amora:** the API and the screens for every closed feature listed above, plus sign-in, hosting, the domain and deployment.
- **Roshan:** the coursework backend in PR #85. That's files, late and missing work, resubmissions and extensions, the gradebook and CSV export, scheduled announcements, and the new assignment settings.
- **Bishu and Dipesh:** no code in the app yet. Bishu's design work as frontend lead (KAN-65) hasn't started. Earlier frontend drafts (PR #25, reverted in PR #59, and PR #62, not merged) aren't part of the current app.

Some closed GitHub issues and Jira items are assigned to the person they were planned for rather than the person who built them.

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

