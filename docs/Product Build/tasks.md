# Tasks

Our lecturer sets a deliverable each week, **due every Wednesday**. This file lists the current week's tasks, each with the person who owns it; tick them off as they land. The newest week goes at the top.

**How Jira is organised (from 15 Nov):** Jira mirrors the GitHub epics. Each GitHub epic has a Jira epic (KAN-76 to KAN-81), and each GitHub feature has one Jira task named "… (GitHub #N)". Close both together. Deadlines are GitHub milestones ("Deliverable 18 Nov", "Deliverable 25 Nov") and Jira due dates.

**Progress reports:** every team member submits a progress report every two weeks, on a Thursday: **Thu 19 Nov**, Thu 3 Dec, and Thu 17 Dec (the last one). Jira KAN-114, KAN-115, KAN-116.

## Week 3 deliverable: AI at-risk prediction and quiz backend
Due **Wed 18 Nov**. New requirement from the client (Session 4): make the LMS smarter with AI. See [Epic 6 #118](https://github.com/Red-dish/PerceptionLMS/issues/118).

### Technical team
- [ ] Explore the student dataset, AI Task 1, GitHub #119 (Amora) · KAN-82
- [ ] At-risk student prediction: model, API and lecturer view, AI Task 2, GitHub #120 (Amora) · KAN-83
- [ ] Quiz builder backend, GitHub #47, then hand over to Dipesh and Bishu (Roshan) · KAN-92
- [ ] Quiz taking and auto-grading backend, GitHub #48, then hand over to Dipesh and Bishu (Roshan) · KAN-93
- [ ] Deploy the coursework API: gradebook, CSV, files and late work from PR #85 are merged and tested but not live yet (Amora) · KAN-72

### Business team
- [ ] AI requirement analysis: user stories and acceptance criteria for the AI features, GitHub #121 (Apeksha) · KAN-84
- [ ] Ethics and privacy note for AI at-risk prediction, in `docs/Compliance/`, GitHub #122 (Nancy, ready for her 19 Nov report) · KAN-85
- [x] Compliance docs: privacy policy and terms, copyright, DPIA, data retention, now in `docs/Compliance/` (Yogesh) · KAN-33 to KAN-36
- [ ] WCAG 2.2 accessibility audit: reopen as a PR with the file in `docs/Compliance/`, GitHub #102 (Yogesh) · KAN-37

### Everyone
- [ ] Progress report 1 by Thu 19 Nov (all seven) · KAN-114

## Week 4 deliverable: everything else on the epics
Due **Wed 25 Nov**. Milestone "Deliverable 25 Nov" on GitHub.

- Screens for the gradebook (#49), CSV export (#51), files (#37), quizzes (#47, #48) and everything below (Dipesh and Bishu)
- Backend for pages (#36), rubrics (#45), discussions (#55), inbox (#56), calendar (#57) and notifications (#58) (Roshan)
- User profile and settings (#32) (Amora)
- Course chatbot (#123) and study recommendations (#124) (owners to be decided)

## Week 2 deliverable: coursework API and grading view · KAN-68
Due Wed 11 Nov. Closed on 15 Nov.

### Technical team
- [x] Coursework backend: files, late and missing work, resubmissions and extensions, gradebook and CSV export, scheduled announcements, with 48 tests passing (Roshan, PR #85) · KAN-69
- [x] Lecturer grading view screens, GitHub #44 (Dipesh, PR #97) · KAN-70
- [x] Merge the grading view PR into `frontend` (merged by Amora; assigned to Bishu) · KAN-71
- Deploy the coursework API (Amora) · KAN-72: moved to Week 3
- Backend split (Amora KAN-73, Roshan KAN-75): replaced on 15 Nov by one Jira task per GitHub feature
- [x] Docs: who built what, the frontend handover, and the new roles (Amora) · KAN-74
- [x] Visual design: colours, type, layout, and designs for new screens (Bishu; marked Done in Jira) · KAN-65

### Business team
- [x] Design review for the three roles (Apeksha; marked Done in Jira) · KAN-66

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
