

## Team of 7

The seven members split into two teams: a technical team of 4 who build the platform, and a business, compliance and governance team of 3 who own the plan, the business case and everything that keeps the project legal, safe and on track. Neither team needs the other's skills, but every week ends with a joint review.

Amora is the tech lead and oversees the whole project. Apeksha leads the business team. From 15 Nov there is no frontend lead: Dipesh and Bishu build the screens together.

**Technical team (4), from 15 Nov**

| Role | Person | Owns | Backs up |
| --- | --- | --- | --- |
| 1. Tech lead, AI and backend developer | Amora | Oversees the whole project: architecture, priorities, and every merge into `dev` and `main`. The AI features (Epic 6, #118) and user profile and settings (#32). Database, infrastructure, hosting and deployment, CI/CD | Role 2 |
| 2. Backend developer | Roshan | Builds the backend for the features on Epics 2 to 5, with tests for every endpoint, then hands each one to the frontend developers | Role 1 |
| 3. Frontend developer | Dipesh | Builds and designs screens with Bishu. They review each other's PRs | Role 4 |
| 4. Frontend developer | Bishu | Builds and designs screens with Dipesh. They review each other's PRs | Role 3 |

**How a feature gets built:**

1. **Roshan builds the API** (Amora for AI and profile), with tests, in a PR into `dev`. The other backend developer reviews it.
2. **Roshan hands it over** to Dipesh and Bishu once the endpoints are merged.
3. **Dipesh and Bishu design and build the screens** against the API, in a PR into `frontend`.
4. **The other frontend developer reviews and merges** the PR.
5. **Amora moves it to `dev` and `main`** and publishes it.

**Testing (QA) is shared by the whole technical team.** Whoever is free tests: checking a PR before it's merged, writing automated tests, or testing a release by hand against the user stories. Nobody tests their own PR alone.

**Business, compliance and governance team (3)**

This team doesn't build features: every v1 feature is owned by the technical team (see [v1 modules](#v1-modules-github-epics) below). Apeksha tracks progress on every epic.

| Role | Person | Owns | Backs up |
| --- | --- | --- | --- |
| 5. Business team lead and business analyst | Apeksha | Leading the business team, market and competitor research, business case and cost comparison with Canvas, personas, design review with Bishu, usability testing, rollout and adoption plan | Role 6 |
| 6. Project manager and governance lead | Nancy | Scope and user stories, Jira board, meetings and minutes, RACI chart, risk register, decision log, final report and presentation | Role 7 |
| 7. Compliance and risk officer | Yogesh (Yoodem) | Privacy law requirements, privacy policy and terms, copyright for lecturer content, accessibility (WCAG) audit, data protection impact assessment, security and data-retention policies | Role 5 |

**This week (to 18 Nov):** Apeksha does the AI requirement analysis (#121). Nancy writes a short ethics and privacy note on AI at-risk prediction (#122). Yogesh's compliance docs (privacy policy and terms, copyright, DPIA, data retention) are done and in `docs/Compliance/`; the WCAG audit (#102) still needs a PR with the right path.

**Progress reports:** every team member submits one every two weeks, on a Thursday: 19 Nov, 3 Dec and 17 Dec (the last one).

Work is tracked in the Perception LMS (KAN) Jira project, which mirrors the GitHub epics below: one Jira epic per GitHub epic, and one Jira task per GitHub feature. Deliverables are due every Wednesday; see [tasks.md](../Product%20Build/tasks.md) for this week's list.

## v1 modules (GitHub epics)

To move faster, our lecturer asked us to break a basic Canvas-style v1 into modules. Each module is a GitHub issue labelled `epic`, with its features linked as sub-issues labelled `feature`. Each feature lists what is already built and its acceptance criteria, so it can be handed to an AI coding agent.

**Every feature has two checklists: Backend and Frontend.** Each heading names its owner and status, for example "Backend: Roshan · Done" and "Frontend: Dipesh and Bishu · Not started". That way a feature whose API is merged but has no screens yet shows exactly what's left. When your PR lands, tick your boxes and update your heading's status in the same PR. Close the issue only when both sections are done, or note in the issue what's left for later.

| Epic | Jira | Open features |
| --- | --- | --- |
| [#27 Identity, Roles & Administration](https://github.com/Red-dish/PerceptionLMS/issues/27) | KAN-76 | #32 |
| [#33 Courses & Content](https://github.com/Red-dish/PerceptionLMS/issues/33) | KAN-77 | #36, #37 |
| [#40 Assignments & Submissions](https://github.com/Red-dish/PerceptionLMS/issues/40) | KAN-78 | #45 |
| [#46 Quizzes & Gradebook](https://github.com/Red-dish/PerceptionLMS/issues/46) | KAN-79 | #47, #48, #49, #51 |
| [#52 Communication & Dashboard](https://github.com/Red-dish/PerceptionLMS/issues/52) | KAN-80 | #55, #56, #57, #58 |
| [#118 AI & Insights](https://github.com/Red-dish/PerceptionLMS/issues/118) (new, Session 4) | KAN-81 | #119, #120, #121, #122, #123, #124 |

Amora oversees every epic. Apeksha is on every epic to track progress for the business team.

### Who builds each open feature (from 15 Nov)

**Roshan builds the API**, then hands over to **Dipesh and Bishu**, who design and build the screens together. Amora builds the AI features and profile. "Done" in the API column means the endpoints are merged and tested, so the screens can start. The gradebook, CSV and files endpoints aren't deployed yet (KAN-72).

| Feature | API | Screens | Due |
| --- | --- | --- | --- |
| #119 Explore the student dataset (AI Task 1) | Amora | n/a | 18 Nov |
| #120 At-risk student prediction (AI Task 2) | Amora | Amora | 18 Nov |
| #47 Quiz builder | Roshan, by 18 Nov | Dipesh and Bishu | 25 Nov |
| #48 Quiz taking and auto-grading | Roshan, by 18 Nov | Dipesh and Bishu | 25 Nov |
| #49 Teacher gradebook | Done (Roshan, PR #85) | Dipesh and Bishu | 25 Nov |
| #51 Grade export (CSV) | Done (Roshan, PR #85) | Dipesh and Bishu | 25 Nov |
| #37 Files | Part done (Roshan, PR #85): folders and linking left | Dipesh and Bishu | 25 Nov |
| #32 User profile and settings | Amora | Dipesh and Bishu | 25 Nov |
| #36 Pages | Roshan | Dipesh and Bishu | 25 Nov |
| #45 Basic rubrics | Roshan | Dipesh and Bishu | 25 Nov |
| #55 Discussions | Roshan | Dipesh and Bishu | 25 Nov |
| #56 Inbox (direct messaging) | Roshan | Dipesh and Bishu | 25 Nov |
| #57 Calendar | Roshan, if needed: mostly uses existing endpoints | Dipesh and Bishu | 25 Nov |
| #58 Notifications | Roshan | Dipesh and Bishu | 25 Nov |
| #123 Course chatbot | To be decided | To be decided | 25 Nov |
| #124 Study recommendations | To be decided | To be decided | 25 Nov |

**Already done (closed):** #28 Sign in with Google, #29 Roles and permissions, #30 Admin user management, #31 Admin course and enrolment management, #34 Course creation and settings, #35 Modules, #38 Course home and syllabus, #39 Course navigation, #41 Assignment creation, #42 Student submission, #43 Late, missing and resubmission handling, #44 Teacher grading view (Dipesh, PR #97), #50 Student grades view, #53 Dashboard, #54 Announcements.

### Who has built what so far (15 Nov)

The code in the app today was written by:

- **Amora:** the API and the screens for every closed feature listed above apart from #44, plus sign-in, hosting, the domain and deployment.
- **Roshan:** the coursework backend in PR #85. That's files, late and missing work, resubmissions and extensions, the gradebook and CSV export, scheduled announcements, and the new assignment settings.
- **Dipesh:** the lecturer grading view (#44, PR #97, merged 15 Nov).
- **Bishu:** no code in the app yet. Earlier frontend drafts (PR #25, reverted in PR #59, and PR #62, not merged) aren't part of the current app.
- **Yogesh:** the compliance docs in `docs/Compliance/` (PRs #103 to #106).

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

