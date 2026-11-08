

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

**Business, compliance and governance team (3, no coding)**

| Role | Person | Owns | Backs up |
| --- | --- | --- | --- |
| 4. Business team lead and business analyst | Apeksha | Leading the business team, market and competitor research, business case and cost comparison with Canvas, personas, design review with Bishu, usability testing, rollout and adoption plan | Role 5 |
| 5. Project manager and governance lead | Nancy | Scope and user stories, Jira board, meetings and minutes, RACI chart, risk register, decision log, final report and presentation | Role 6 |
| 6. Compliance and risk officer | Yoodem | Privacy law requirements, privacy policy and terms, copyright for lecturer content, accessibility (WCAG) audit, data protection impact assessment, security and data-retention policies | Role 4 |

Work is tracked in the Perception LMS (KAN) Jira project. Our lecturer sets a deliverable each week, and each one becomes an epic of tasks in Jira; see [tasks.md](../Product%20Build/tasks.md) for this week's list.

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

Attendance, calendar, notifications, quizzes, analytics, single sign-on and Canvas data migration stay on the Later list in [tasks.md](../Product%20Build/tasks.md) rather than being built.

