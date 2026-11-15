# Perception LMS — Data Protection Impact Assessment (DPIA)

**Owner:** Yoodem, Compliance and Risk Officer · **Status:** Draft · **Issue:** #100
**Related:** [security-requirements.md](security-requirements.md) (SEC-01 to SEC-10), [data-retention-policy.md](data-retention-policy.md), [system-design.md](../docs/Product%20Build/system-design.md)

## 1. Purpose and scope

This assessment looks at the privacy risks of storing and processing student and staff data in Perception LMS, and at how the design reduces them. It follows the Office of the Australian Information Commissioner's (OAIC) privacy impact assessment approach and checks the system against the Australian Privacy Principles (APPs) in the *Privacy Act 1988*.

It covers the MVP as built on the `dev` branch: sign-in, courses, materials, assignments, submissions, grades, the gradebook, late and missing work, and announcements. Features that aren't built yet, such as an AI tutor or at-risk alerts, are covered in section 8 and need their own assessment before they're built.

## 2. What personal data the system holds

| Data | Whose | Where it comes from | Where it's stored | Who can see it |
| --- | --- | --- | --- | --- |
| Name, email, role, active flag | Everyone | Admin adds the person; name and email checked against Google sign-in | Database (DynamoDB) | The person; admins. Lecturers see names and emails of students in their courses |
| Course enrolments | Everyone | Admin | Database | The person; admins; lecturers of that course |
| Submissions: typed answers and files, including earlier attempts | Students | Student | Database (text), file storage (S3) | The student; lecturers of that course; admins |
| Marks, final marks after late penalty, feedback | Students | Lecturer | Database | Lecturers and admins. The student only once the mark is released |
| Late and missing work, extensions and resubmission notes | Students | Calculated by the system; extensions given by lecturers | Database | Lecturers of that course; admins (across every course) |
| Course materials and announcements (author's name) | Lecturers | Lecturer | Database, file storage | Everyone enrolled in the course |
| Session token | Everyone | API, after Google sign-in | The user's browser (`localStorage`), for 8 hours | The user's browser only |
| Request logs (time, path, errors) | Everyone | AWS Lambda | AWS CloudWatch, 30 days | The technical team with AWS access |
| IP address and browser details | Visitors | Their browser | Cloudflare (website) and AWS (API), in those services' own logs | The technical team with access to those services |

**Not collected:** passwords (Google handles sign-in, so SEC-04 doesn't apply), dates of birth, addresses, phone numbers, student ID numbers, payment details, or health and other sensitive information. Students could still put sensitive information into a submission, such as a reason for an extension, so submissions should be treated as possibly sensitive.

## 3. How data flows through the system

```
Student / lecturer / admin browser
  │
  ├─1─► Google ("Sign in with Google") ──► Google ID token back to the browser
  │
  ├─2─► API (AWS API Gateway + Lambda, Sydney) ── checks the Google token,
  │       │                                       issues an 8-hour session token
  │       ├──► Database (DynamoDB, Sydney): users, courses, submissions, grades
  │       └──► Signs short-lived links for file storage
  │
  ├─3─► File storage (private S3 bucket, Sydney): uploads and downloads go
  │       straight from the browser using those links (upload 15 min, download 5 min)
  │
  └─4─► Website files (React app) through Cloudflare ──► public S3 website bucket
          (holds no personal data)
```

1. **Sign-in:** the browser gets an ID token from Google and sends it to the API. The API checks Google's signature, that the email is verified, and that an admin has added that email. If a domain limit is set, the email must belong to it.
2. **API:** every request carries the session token. The API looks the user up again on each request, so a deactivated user or a changed role takes effect straight away.
3. **Files:** files never pass through the API. The API checks the person's course role, then gives them a signed link for that one file.
4. **Website:** Cloudflare serves the frontend's code. It sees visitors' IP addresses but none of the data in the LMS.

### Third parties and where the data goes

| Service | What it receives | Location | APP 8 (sending data overseas) |
| --- | --- | --- | --- |
| AWS (API, database, files, logs) | All LMS data | Sydney (`ap-southeast-2`) | Stays in Australia |
| Google (sign-in) | That the person signs in to Perception LMS | Overseas (mainly US) | Google already holds the account. We send nothing back to Google. Mention it in the privacy policy (#99) |
| Cloudflare (website delivery, DNS) | IP address and browser details of visitors | Global network | No LMS data. Mention it in the privacy policy |

## 4. Is the data needed? (APP 3, 5, 6 and 10)

- **Only what's needed (APP 3):** each item in section 2 is needed to run a course: identifying who signs in, what they're enrolled in, what they submitted and what mark they got. The system doesn't ask for anything else.
- **Telling people (APP 5):** users must be told what's collected and why before or when they first sign in. The privacy policy (#99) will do this. It should be linked from the sign-in page.
- **Using it only for teaching (APP 6):** data is used only to teach and assess. Any new use, such as analytics or AI features, needs a new check first (section 8).
- **Keeping it correct (APP 10 and 13):** admins can correct names and roles, and lecturers can correct marks. Students can't edit their own name; they ask an admin.

## 5. How risks are rated

| Likelihood | Meaning |
| --- | --- |
| Rare | Unlikely to happen during the project |
| Possible | Could happen, especially through a mistake |
| Likely | Expected to happen unless something changes |

| Impact | Meaning |
| --- | --- |
| Minor | Small inconvenience; little personal data involved |
| Moderate | Personal data of a few people exposed, or a privacy request can't be met |
| Severe | Many students' data exposed or changed; possible notifiable data breach |

| Likelihood ↓ / Impact → | Minor | Moderate | Severe |
| --- | --- | --- | --- |
| **Rare** | Low | Low | Medium |
| **Possible** | Low | Medium | High |
| **Likely** | Medium | High | High |

## 6. Privacy risks and controls

The rating is the risk after the controls already in the system.

| ID | Risk | Likelihood | Impact | Rating | Controls in place | SEC |
| --- | --- | --- | --- | --- | --- | --- |
| P-01 | A student sees another student's submissions or grades | Rare | Severe | **Medium** | Course roles come from enrolments. Students can only reach their own submission. Marks stay hidden until released. People who aren't enrolled get "not found". Automated tests cover these rules | SEC-02, SEC-05 |
| P-02 | Someone uses a stolen session token to act as a user | Possible | Moderate | **Medium** | Tokens last 8 hours. Deactivation blocks a user on their next request. React escapes page content, and no raw HTML is rendered, which makes token-stealing scripts (XSS) harder. **Gaps:** the token sits in `localStorage`, where any script on the page can read it, and tokens can't be cancelled early | SEC-01, SEC-06 |
| P-03 | An outsider signs in with a personal Google account | Rare | Moderate | **Low** | Only emails an admin has added can sign in, and Google must have verified the email. An optional domain limit can restrict sign-in to the college's Google domain | SEC-01, SEC-05 |
| P-04 | The files bucket is exposed to the public | Rare | Severe | **Medium** | All four S3 public-access blocks are on. Files are reached only through signed links, after a role check. Links expire (upload 15 minutes, download 5 minutes). Files are encrypted at rest (AES-256). The website bucket is kept separate. **Gap:** anyone a link is forwarded to can use it until it expires | SEC-03, SEC-05 |
| P-05 | The token-signing secret leaks, so anyone could make a token for any user, including an admin | Possible | Severe | **High** | The secret is 48 random characters. **Gaps:** it's kept in Terraform state on one team member's computer and in the Lambda's settings, not in AWS Secrets Manager | SEC-09 |
| P-06 | Data is intercepted on the way between the browser and AWS | Rare | Moderate | **Low** | The API and file links use HTTPS only. Cloudflare's "Flexible" setting only covers the website's code, which holds no personal data | SEC-07 |
| P-07 | Admins or lecturers look at more than they need, or data leaves the system in exports | Possible | Moderate | **Medium** | Lecturers only see their own courses. **Gaps:** admins can see every course and every student's late and missing work. Gradebook CSV exports end up on staff computers. Nothing records who viewed or downloaded what | SEC-02, SEC-08 |
| P-08 | Data is kept longer than needed | Likely | Moderate | **High** | The [data-retention policy](data-retention-policy.md) sets the periods. Logs are deleted after 30 days. **Gaps:** users can only be deactivated, not deleted, and old files are never removed | SEC-03, SEC-10 |
| P-09 | A request to see, correct or delete personal data can't be met within 30 days | Possible | Moderate | **Medium** | Admins can correct names and roles, and a student can see their own submissions and released grades. **Gaps:** there's no way to export everything about one person, or to fully delete one | SEC-03 |
| P-10 | Submissions or grades are lost or wrongly changed | Rare | Severe | **Medium** | Database point-in-time recovery for 35 days. The production table and files are protected from deletion. Earlier attempts are kept. **Gaps:** file storage has no versioning, so an overwritten or deleted file can't be recovered. When two people save at the same moment, the last save wins | SEC-10 |
| P-11 | A harmful file is uploaded and opened by others | Possible | Moderate | **Medium** | Only an allowed list of file types can be uploaded, so programs like `.exe` are refused. Files download as attachments, so they can't run on the site. Files are limited to 20 MB. **Gap:** files aren't scanned for malware | SEC-06 |
| P-12 | A breach isn't spotted, or isn't reported in time | Possible | Severe | **High** | Lambda errors are logged for 30 days. **Gaps:** sign-ins, role changes and downloads aren't recorded as security events. There's no alerting and no breach response plan. Under the Notifiable Data Breaches scheme, a suspected breach must be assessed within 30 days, and serious ones reported to the OAIC and the people affected | SEC-08 |
| P-13 | Real student data is used in development or testing | Rare | Moderate | **Low** | Local runs use an in-memory stand-in for AWS, and tests use fake data. The `dev` and `prod` environments are separate | SEC-03 |

## 7. Remaining risks for the risk register

These are for Nancy's risk register. Each stays open until the action is done.

| ID | Remaining risk | Rating now | Action | Owner | Rating after action |
| --- | --- | --- | --- | --- | --- |
| P-05 | Token-signing secret could leak | High | Move the secret to AWS Secrets Manager, and keep Terraform state in a locked S3 bucket instead of one laptop | Tech lead | Low |
| P-08 | Data kept too long | High | Build user deletion, add an S3 lifecycle rule for old files, and run a yearly clean-up (see the retention policy) | Tech lead, Admin | Low |
| P-12 | Breaches not spotted or reported | High | Log sign-ins, role changes, grade changes and downloads; set a CloudWatch alarm on unusual activity; write a one-page breach response plan with ASA | Compliance officer, Tech lead | Medium |
| P-02 | Stolen session token | Medium | Add a Content Security Policy to the website; consider a shorter token life or an httpOnly cookie | Tech lead | Low |
| P-07 | Staff over-access and exports | Medium | Record who downloads grades and files; add a line to staff terms about storing exports safely | Compliance officer, Tech lead | Low |
| P-09 | Privacy requests can't be met | Medium | Add an admin "export this person's data" and "delete this person" feature; write the request process into the privacy policy (#99) | Tech lead, Compliance officer | Low |
| P-10 | Files can't be recovered | Medium | Turn on S3 versioning, with old versions expiring to match the retention policy | Tech lead | Low |
| P-11 | Harmful uploads | Medium | Add malware scanning for uploads (for example, Amazon GuardDuty Malware Protection for S3) | Tech lead | Low |
| P-04 | Forwarded download links | Medium | Accept: links last only 5 minutes. Review again if links get longer | Compliance officer | Medium |
| P-01 | Students see each other's data | Medium | Accept: keep the access tests passing on every change, and test it again in the security test (SEC section 5) | Tech lead | Medium |
| — | Domain limit isn't set in production | Medium | Set `allowed_domain` to ASA's Google domain once ASA confirms students have college Google accounts | Admin | Low |

## 8. Future features: AI tutor and at-risk alerts

These features are in the future plan. They change the privacy picture a lot, so each needs its own assessment before it's built. The main questions:

- **Sending student work to an AI provider:** a third-party AI service (such as OpenAI, Google or Anthropic) would receive submissions and possibly names. That data would likely leave Australia (APP 8). The provider's contract must say it doesn't train on the data and deletes it after use. A provider with an Australian region (for example, through AWS Bedrock in Sydney) is easier to justify.
- **Automated decisions about students:** an at-risk alert decides something about a student from their data. From **10 December 2026**, the privacy policy must explain when a computer program makes decisions that significantly affect people (*Privacy and Other Legislation Amendment Act 2024*). A lecturer should always review an alert before acting on it, and students should be told the alerts exist.
- **New uses of data (APP 6):** students gave their data for teaching and marking. Using it to predict who's at risk is a new use, so it must be in the privacy policy before it starts.
- **Accuracy and fairness:** a wrong alert could unfairly label a student. The rules behind an alert should be simple enough to explain to the student.
- **Build or buy:** using a provider is far cheaper and quicker than training our own model. A simple rules-based at-risk alert (for example, two missing assignments in a row) needs no AI at all, sends nothing to a third party, and is easy to explain.

## 9. Review

This assessment is reviewed when:

- a new kind of personal data is stored, or a new third party is used (for example AI, email notifications or analytics),
- an action in section 7 is finished, to update the ratings,
- a privacy incident happens, or
- once a year at least.
