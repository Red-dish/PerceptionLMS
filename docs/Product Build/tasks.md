# Tasks

Our lecturer sets a deliverable each week, **due every Wednesday**. This file lists the current week's tasks, each with the person who owns it; tick them off as they land. Each task matches a work item in the Perception LMS (KAN) Jira project, grouped under that week's epic. The newest week goes at the top.

## Week 2 deliverable: coursework API and grading view · KAN-68
Due Wed 11 Nov.

### Technical team
- [x] Coursework backend: files, late and missing work, resubmissions and extensions, gradebook and CSV export, scheduled announcements, with 48 tests passing (Roshan, PR #85) · KAN-69
- [ ] Lecturer grading view screens, GitHub #44 (Dipesh) · KAN-70
- [ ] Review the grading view PR and merge it into `frontend` (Bishu) · KAN-71
- [ ] Deploy the coursework API: move PR #85 through `frontend` → `dev` → `main`, then deploy (Amora) · KAN-72
- [ ] Backend for the next epics, starting with profile (#32) and pages (#36) so Bishu can build those screens (Amora) · KAN-73
- [ ] Docs: who built what, and the frontend handover for the new API, PRs #88 to #91 (Amora) · KAN-74
- [ ] Shared layout and visual design, carried over from Week 1 (Bishu) · KAN-65

### Business team
- [ ] Design review for the three roles, carried over from Week 1 (Apeksha) · KAN-66

## Week 1 deliverable: sign-in, roles and dashboard · KAN-54
Due Fri 6 Nov. A working dashboard, three access roles (student, staff, admin) and a sign-in page, plus the team presentation.

### Technical team
The name in brackets is who did the work. Where that's different from who it was assigned to, the assignee follows.

- [x] Deploy the backend to AWS Lambda and DynamoDB (Amora; assigned to Roshan and Amora) · KAN-55
- [x] Sign in with Google and user roles: student, staff, admin (Amora) · KAN-41
- [x] Set up the React app, which the two pages below are built on (Amora; assigned to Dipesh) · KAN-64
- [x] Build the sign-in page, which sends each role to its dashboard (Amora; assigned to Dipesh and Bishu) · KAN-57
- [x] Point our domain name at the app (Amora; assigned to Dipesh and Amora) · KAN-56
- [x] Dashboard, frontend, for each role, with live data (Amora; assigned to Bishu) · KAN-58
- Shared layout and visual design (Bishu) · KAN-65: moved to Week 2. Amora built the shared navigation and phone layout; the final design hasn't started

### Business team
- [x] Set up the shared presentation deck, with empty "Technical description" slides (Nancy) · KAN-59
- [x] Slides: business analysis and the future of the product (Apeksha) · KAN-60
- [x] Slides: marketing and sales (Nancy) · KAN-61
- [x] Slides: stakeholder and competitor analysis (Yoodem) · KAN-62
- Design review for the three roles (Apeksha) · KAN-66: moved to Week 2

### Everyone
- [ ] Submit your individual report on Canvas under Session 2 by Sun 8 Nov, then comment "Submitted" on the Jira task (all seven) · KAN-67

## Later (not in the MVP)
- Attendance tracking
- Calendar and timetable
- Departments, Super Admin role and audit log
- Notifications and reminders
- Online quizzes
- Reporting and learning analytics
- Discussion forums
- Single sign-on with college accounts
- Canvas data migration
