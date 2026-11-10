

## Team of 7

The seven members split into two teams: a technical team of 4 who build the platform, and a business, compliance and governance team of 3 who own the plan, the business case and everything that keeps the project legal, safe and on track. Neither team needs the other's skills, but every week ends with a joint review.

Amora is the tech lead and oversees the whole project. Bishu leads the frontend's design and reviews. Apeksha leads the business team.

**Technical team (4)**

| Role | Person | Owns | Backs up |
| --- | --- | --- | --- |
| 1. Tech lead and backend developer | Amora | Oversees the whole project: architecture, priorities, and every merge into `dev` and `main`. Builds APIs with Roshan. Database, infrastructure, hosting and deployment, CI/CD | Role 2 |
| 2. Backend developer | Roshan | Builds APIs with Amora, with tests for every endpoint | Role 1 |
| 3. Frontend developer | Dipesh | Builds the screens that use each API, following Bishu's designs | Role 4 |
| 4. Frontend lead: design and review | Bishu | UI design: colours, type, layout and the design of each new screen. Reviews and merges every frontend PR into `frontend` | Role 3 |

**How a feature gets built:**

1. **Amora or Roshan builds the API,** with tests, in a PR into `dev`. The other one reviews it.
2. **Bishu designs the screens** while the API is being built.
3. **Dipesh builds the screens** against the API, in a PR into `frontend`.
4. **Bishu reviews and merges** Dipesh's PR.
5. **Amora moves it to `dev` and `main`** and publishes it.

**Testing (QA) is shared by the whole technical team.** Whoever is free tests: checking a PR before it's merged, writing automated tests, or testing a release by hand against the user stories. Nobody tests their own PR alone.

**Business, compliance and governance team (3)**

This team doesn't build features: every v1 feature is owned by the technical team (see [v1 modules](#v1-modules-github-epics) below). Apeksha tracks progress on every epic.

| Role | Person | Owns | Backs up |
| --- | --- | --- | --- |
| 5. Business team lead and business analyst | Apeksha | Leading the business team, market and competitor research, business case and cost comparison with Canvas, personas, design review with Bishu, usability testing, rollout and adoption plan | Role 6 |
| 6. Project manager and governance lead | Nancy | Scope and user stories, Jira board, meetings and minutes, RACI chart, risk register, decision log, final report and presentation | Role 7 |
| 7. Compliance and risk officer | Yoodem | Privacy law requirements, privacy policy and terms, copyright for lecturer content, accessibility (WCAG) audit, data protection impact assessment, security and data-retention policies | Role 5 |

Work is tracked in the Perception LMS (KAN) Jira project. Our lecturer sets a deliverable each week, due every Wednesday, and each one becomes an epic of tasks in Jira; see [tasks.md](../Product%20Build/tasks.md) for this week's list.

## v1 modules (GitHub epics)

To move faster, our lecturer asked us to break a basic Canvas-style v1 into modules. Each module is a GitHub issue labelled `epic`, with its features linked as sub-issues labelled `feature`. Each feature lists what is already built and its acceptance criteria, so it can be handed to an AI coding agent.

| Epic | Open features |
| --- | --- |
| [#27 Identity, Roles & Administration](https://github.com/Red-dish/PerceptionLMS/issues/27) | #32 |
| [#33 Courses & Content](https://github.com/Red-dish/PerceptionLMS/issues/33) | #36, #37 |
| [#40 Assignments & Submissions](https://github.com/Red-dish/PerceptionLMS/issues/40) | #43, #44, #45 |
| [#46 Quizzes & Gradebook](https://github.com/Red-dish/PerceptionLMS/issues/46) | #47, #48, #49, #51 |
| [#52 Communication & Dashboard](https://github.com/Red-dish/PerceptionLMS/issues/52) | #55, #56, #57, #58 |

Amora oversees every epic. Apeksha is on every epic to track progress for the business team.

### Who builds each open feature

Each feature follows the pipeline above. **Amora or Roshan builds the API**, **Dipesh builds the screens**, and **Bishu designs them and reviews Dipesh's PR**. Finish the core features before starting any "after core" one. The after-core features were on the Later list, so they must not hold up the core build. "Done" in the API column means the endpoints exist, so the screens can start.

| Feature | API | Screens | When |
| --- | --- | --- | --- |
| #37 Files | Done (Roshan, PR #85) | Dipesh | Core |
| #43 Late, missing and resubmission | Done (Roshan, PR #85) | Dipesh | Core |
| #44 Teacher submission review and grading view | Done (Amora; extras from PR #85) | Dipesh | Core |
| #49 Teacher gradebook | Done (Roshan, PR #85) | Dipesh | Core |
| #32 User profile and settings | Amora | Dipesh | Core |
| #36 Pages | Amora | Dipesh | Core |
| #51 Grade export (CSV) | Done (Roshan, PR #85) | Dipesh | After core |
| #57 Calendar | Not needed: uses existing endpoints | Dipesh | After core |
| #45 Basic rubrics | Roshan | Dipesh | After core |
| #47 Quiz builder | Roshan | Dipesh | After core |
| #48 Quiz taking and auto-grading | Roshan | Dipesh | After core |
| #58 Notifications | Roshan | Dipesh | After core |
| #55 Discussions | Amora | Dipesh | After core |
| #56 Inbox (direct messaging) | Amora | Dipesh | After core |

The APIs are split so Roshan continues the coursework and grading area he started in PR #85, and Amora takes profile, pages and messaging. Dipesh builds all 14 screens, so take them in the order above: the first four have their API ready now.

**Already done (closed):** #28 Sign in with Google, #29 Roles and permissions, #30 Admin user management, #31 Admin course and enrolment management, #34 Course creation and settings, #35 Modules, #38 Course home and syllabus, #39 Course navigation, #41 Assignment creation, #42 Student submission, #50 Student grades view, #53 Dashboard, #54 Announcements.

### Who has built what so far (10 Nov)

The roles above are the plan from 10 Nov. The code in the app today was written by:

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

