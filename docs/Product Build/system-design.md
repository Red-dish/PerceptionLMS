# System Design

How the Perception LMS MVP is built. The code is in [backend/](../../backend); how to run and deploy it is in [backend/README.md](../../backend/README.md).

## Architecture

```
Browser (frontend)
  │  1. "Sign in with Google" button → Google ID token
  │  2. POST /auth/google → API session token (8 hours)
  │  3. API requests with "Authorization: Bearer <token>"
  ▼
API Gateway (HTTP API) ──► Lambda: FastAPI app, Python 3.14 container image
                               │            │
                               ▼            ▼
                           DynamoDB     S3 bucket (private)
                         (one table)        ▲
  Browser ── signed upload/download links ──┘  (files never pass through Lambda)
```

| Part | Choice | Why |
| --- | --- | --- |
| API | FastAPI on AWS Lambda, through Mangum | No servers to manage; costs almost nothing at college scale |
| Sign-in | Sign in with Google | No passwords to store or reset |
| Data | DynamoDB, one table, on-demand billing | No database server; pay per request |
| Files | S3 with signed links, 20 MB limit | Lambda cannot accept uploads over 6 MB |
| Build | Podman builds the Lambda container image | Same image locally and in AWS |
| Infrastructure | Terraform | Every AWS resource is written down and repeatable |

## Sign-in and access

- **Who can sign in:** only people an admin has added, by email. The emails in `admin_emails` become admins on their first sign-in, so the first admin can get in.
- **Domain limit (optional):** `allowed_domain` limits sign-in to one Google Workspace domain, such as the college's.
- **Session tokens:** the API checks Google's signature, then issues its own session token. Each request re-reads the user, so deactivating someone or changing their role takes effect immediately.
- **Course roles:** come from enrolments, not from the user's main role. An admin enrols a person in a course as a lecturer or a student.

| Action | Student (enrolled) | Lecturer (enrolled) | Admin |
| --- | --- | --- | --- |
| See course, published modules and materials | Yes | Yes, including drafts | Yes |
| Add, change or remove modules, materials, assignments, announcements | No | Yes | Yes |
| Submit an assignment | Yes, own only | No | No |
| See submissions and grade them | Own only; mark hidden until released | Yes | Yes |
| Manage users, courses and enrolments | No | No | Yes |

People who aren't enrolled get "not found" for a course, so they can't tell which courses exist.

## DynamoDB table layout

There is one table with keys `PK` and `SK`, plus one index, `GSI1`, with keys `GSI1PK` and `GSI1SK`. IDs are UUIDv7, so they sort by creation time.

| Item | PK | SK | GSI1PK | GSI1SK |
| --- | --- | --- | --- | --- |
| User | `ORG` | `USER#<userId>` | `EMAIL#<email>` | `USER` |
| Course | `ORG` | `COURSE#<courseId>` | | |
| Enrolment | `COURSE#<courseId>` | `MEMBER#<userId>` | `USER#<userId>` | `COURSE#<courseId>` |
| Module | `COURSE#<courseId>` | `MODULE#<moduleId>` | | |
| Material | `COURSE#<courseId>` | `MATERIAL#<moduleId>#<materialId>` | | |
| Assignment | `COURSE#<courseId>` | `ASSIGNMENT#<assignmentId>` | | |
| Submission | `ASSIGNMENT#<assignmentId>` | `SUBMISSION#<studentId>` | `USER#<studentId>` | `SUBMISSION#<assignmentId>` |
| Resubmission or extension | `ASSIGNMENT#<assignmentId>` | `GRANT#<studentId>` | | |
| Announcement | `COURSE#<courseId>` | `ANNOUNCEMENT#<announcementId>` | | |

| Question the app asks | How |
| --- | --- |
| Find a user by email at sign-in | Query GSI1 on `EMAIL#<email>` |
| List all users, or all courses | Query `ORG`, sort key starts with `USER#` or `COURSE#` |
| My courses | Query GSI1 on `USER#<me>`, sort key starts with `COURSE#` |
| Everything in a course | Query `COURSE#<id>` |
| All submissions for an assignment | Query `ASSIGNMENT#<id>` |
| My grades | Query GSI1 on `USER#<me>`, sort key starts with `SUBMISSION#` |

## Assignments, marking and the gradebook

The shared rules are in `backend/app/coursework.py`.

- **Assignments and quizzes** have points (`max_mark`), a weight, a due date, a submission type (file, text, both or none for work done in class), and can be unpublished or attached to a module.
- **Availability window:** students can't see an assignment before `available_from` or submit after `available_until`.
- **Late work** is anything submitted after the due date. `days_late` rounds up, so one minute late counts as one day. An optional `late_penalty_percent` takes that percent off for each day late; `final_mark` is the result and is what the gradebook totals.
- **Attempts:** students can resubmit until their work is marked, up to `max_attempts` if set. Every earlier attempt is kept in `history`, including its file.
- **Resubmissions and extensions:** a lecturer can give one student a grant. It lets them submit after marking (it is then used up) or after the window closes. With a date, it is an extension: work up to that date counts as on time.
- **Missing work** is anything not handed in once the due date (or extension) has passed.
- **Gradebook:** every enrolled student against every assignment and quiz, with points, percent and a weighted percent. Editing a cell uses the same grade endpoint as marking a submission, and can mark work that was never submitted online, such as a quiz sat in class.

## S3 file keys

- Materials: `courses/<courseId>/materials/<materialId>/<fileName>`
- Submissions: `courses/<courseId>/submissions/<assignmentId>/<studentId>/<uploadId>/<fileName>`. Earlier attempts keep their files.

Downloads are sent as attachments, so a file can't run as a web page on the site.

## Known limits of the MVP

- **Table layout:** user and course lists share one partition. That's fine for thousands of users, but would need splitting at a much larger scale.
- **Lost changes:** changes save the whole item, so two people editing the same item at the same moment means the last save wins.
- **Session tokens:** they can't be cancelled early. Deactivating a user blocks them on their next request instead.
- **Token-signing secret:** it is stored in Terraform state and the Lambda's settings. Moving it to AWS Secrets Manager is a later improvement.
