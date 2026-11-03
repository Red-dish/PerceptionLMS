# ASA College eLearning Platform:   PERCEPTION LMS

**A proposed Learning Management System (LMS) to support digital learning and academic administration at ASA College.**

## 1. Project Overview

The ASA College eLearning Platform is a proposed Learning Management System designed to provide students, lecturers, and administrators with a centralized digital environment for managing teaching, learning, and academic activities.

The project explores an alternative to Canvas that can be tailored to ASA College's requirements, improve the user experience, and provide greater flexibility over learning workflows and platform development.

## 2. Business Problem

ASA College is moving away from Canvas, creating an opportunity to explore a dedicated eLearning platform that better aligns with the college's operational and educational needs.

The proposed solution aims to reduce reliance on an external LMS and provide a platform that can evolve with the college's requirements. The reasons for moving away from Canvas, the existing system's limitations, and the final business requirements should be confirmed with relevant stakeholders.

## 3. Project Objectives

- Provide a centralized platform for students, lecturers, and administrators.
- Enable students to access learning materials and manage their learning activities.
- Support lecturers in organizing course content and communicating with students.
- Help administrators manage users, courses, and academic information.
- Improve accessibility, usability, and the overall digital learning experience.
- Establish a flexible foundation for future features and integrations.
- Apply appropriate security, privacy, and access-control measures.

## 4. Proposed Features

### Student Portal
- Secure login and personalized dashboard.
- Enrolled course and subject access.
- Learning materials and downloadable resources.
- Assignment instructions and submission workflows.
- Assessment deadlines and announcements.
- Academic progress and feedback, where supported.

### Lecturer Portal
- Course and learning material management.
- Assignment creation and submission review.
- Student communication and announcements.
- Assessment feedback and grading workflows.
- Course-related activity management.

### Administrator Portal
- User and role management.
- Course and enrolment administration.
- Lecturer and student account management.
- Academic content oversight.
- Platform configuration and audit records.

### Future Enhancements
- Attendance tracking.
- Notifications and reminders.
- Calendar and timetable integration.
- Departments, a Super Admin role and audit logs.
- Online quizzes and assessments.
- Reporting and learning analytics.
- Discussion forums.
- Single sign-on with college accounts.
- Video conferencing and third-party integrations.

*Features are proposed requirements, not a statement that all functionality has already been implemented.*

## 5. Stakeholders

| Stakeholder | Primary Interest |
|---|---|
| College management | Business value, costs, risks, and strategic alignment |
| Students | Accessible learning materials and a simple user experience |
| Lecturers | Efficient course delivery and assessment management |
| Academic administrators | Course, enrolment, and user administration |
| IT team | Security, reliability, maintenance, and integrations |
| Business analyst / project team | Requirements, stakeholder alignment, scope, and validation |

## 6. Expected Business Benefits

- **Greater flexibility:** Adapt workflows and features to ASA College's requirements.
- **Improved learning experience:** Bring key learning activities into one centralized platform.
- **Operational efficiency:** Reduce manual effort in supported academic workflows.
- **Scalability:** Create a foundation for additional courses, users, and capabilities.
- **Institutional control:** Increase control over platform development priorities and configuration.
- **Potential long-term value:** Evaluate whether ownership or operation of a tailored platform offers better value than available alternatives.

Actual benefits depend on implementation quality, adoption, support requirements, and a comparison of total costs with existing LMS options.

## 7. Project Scope

### MVP Scope

The MVP covers three roles (student, lecturer, administrator) and the eight user stories in [docs/user-stories-mvp.md](docs/user-stories-mvp.md):

- Sign in with role-based access.
- Student dashboard with enrolled courses and upcoming deadlines.
- Course modules and downloadable learning materials.
- Online assignment submission with confirmation.
- Grades and lecturer feedback.
- Lecturer management of course content, assignments, grading and announcements.
- Administrator management of users, roles and course enrolments.

The project also delivers the business case, privacy and compliance documents, usability and accessibility testing, and a final demonstration.

### Out of Scope for the MVP
- Everything listed under Future Enhancements.
- Full migration of historical Canvas data.
- Production deployment for the entire college.
- Integration with every existing college system.
- Payment processing and other unrelated services.

### Timeline

Work runs in one-week cycles from 2 Nov 2026. Our lecturer sets a deliverable each week; we plan that week's tasks in Jira and end the week with a joint review.

| Week | Dates | Deliverable |
|---|---|---|
| 1 | 2–6 Nov 2026 | Sign-in page, access roles (student, staff, admin) and a working dashboard, plus the team presentation |

## 8. Business Case Summary

The proposed ASA College eLearning Platform presents an opportunity to develop a tailored alternative to Canvas. By aligning digital learning functionality with the college's requirements, the project aims to improve flexibility, usability, and academic administration.

Before committing to full implementation, ASA College should evaluate development and maintenance costs, security and privacy obligations, migration complexity, accessibility, user training, and the availability of suitable commercial or open-source alternatives. A phased prototype and stakeholder evaluation can help establish feasibility and demonstrate business value.

## 9. Success Criteria

Project success will be evaluated against agreed requirements, including:

- Students can sign in, see only their enrolled courses, download materials, submit assignments, and view released grades and feedback.
- Lecturers can manage materials, create and grade assignments, and post announcements for their own courses only.
- Administrators can manage users, roles and course enrolments.
- All user acceptance test scenarios pass before the final demonstration.
- The main screens meet WCAG 2.2 Level AA in an accessibility check.
- Privacy, copyright, security and data-retention documents are complete.

## 10. Team and Project Management

- **Team and roles:** [docs/teams](docs/teams)
- **This week's tasks:** [docs/tasks.md](docs/tasks.md)
- **System design:** [docs/system-design.md](docs/system-design.md)
- **Backend API (FastAPI on AWS Lambda):** [backend/README.md](backend/README.md)
- **Work tracking:** the Perception LMS (KAN) project in [Jira](https://amorachk.atlassian.net/jira/software/projects/KAN). Each week's tasks sit under that week's epic; filter the board by your name to see your items.
- **Screen designs:** the MVP screens in [Claude Design](https://claude.ai/artifact/54GwTGoU6hqVKNAhq4jscR), built from the earlier mockup in [UI-UX-Design/UI Design.html](UI-UX-Design/UI%20Design.html).