# Perception LMS — Security Requirements

**Owner:** Yoodem, Compliance and Risk Officer · **Status:** Draft (update in progress) · **Issue:** to be added · **Jira:** to be added
**Related:** [dpia.md](dpia.md), [privacy-policy.md](privacy-policy.md), [data-retention-policy.md](data-retention-policy.md), [ai-ethics-and-privacy.md](ai-ethics-and-privacy.md), [system-design.md](../Product%20Build/system-design.md)

## 1. Purpose and scope

> ✍️ **To write (Yogesh):** in 2 to 4 sentences, say why this document exists, what it covers (the live site at perceptionlms.com, its API, database and file storage) and that it replaces the earlier "StudentHub" draft.

## 2. Security requirements

The IDs SEC-01 to SEC-10 are kept from the first version, because the DPIA, privacy policy, data-retention policy and AI ethics note refer to them. SEC-11 onwards are new.

The "How Perception LMS meets it" column describes the app as built on `dev`, taken from [system-design.md](../Product%20Build/system-design.md), `backend/app/` and `backend/infra/main.tf`.

| ID | Requirement | Priority | How Perception LMS meets it | Status |
| --- | --- | --- | --- | --- |
| SEC-01 | Secure sign-in | High | Sign in with Google only. The API checks Google's signature (RS256) and that the email is verified. Only people an admin has added can sign in, and sign-in can be limited to one Google Workspace domain (`allowed_domain`). | Met |
| SEC-02 | Role-based access control | High | Three roles: student, staff (lecturer) and admin. Course access comes from enrolments, not from the main role. People who aren't enrolled can't see a course exists. Each request re-reads the user, so a role change takes effect on the next request. | Met |
| SEC-03 | Protect student personal information | High | Students see only their own submissions and grades, and marks stay hidden until released. Files are in a private S3 bucket with public access blocked and encryption at rest (AES-256). | Met |
| SEC-04 | No passwords to store | High | Perception LMS stores no passwords: sign-in is through Google. (The first version asked for secure password storage; that no longer applies.) | Met |
| SEC-05 | Prevent unauthorised access | High | Every API request needs a valid session token (`Authorization: Bearer`). Deactivated users are refused on their next request. Only the app's own web addresses may call the API (CORS `allowed_origins`). | Met |
| SEC-06 | Protect against injection and cross-site scripting | High | The database is DynamoDB (not SQL). Every action validates its input. Downloads are sent as attachments, so an uploaded file can't run as a web page on the site. | Met |
| SEC-07 | HTTPS for data in transit | High | The site and API are served over HTTPS, with Cloudflare in front of the website. Between Cloudflare and the website bucket, SSL is set to "Flexible" for `perceptionlms.com` only (see section 4). | Partly met |
| SEC-08 | Security activity logs | Medium | API logs go to CloudWatch and are kept for 30 days (`log_retention_days`). There is no separate audit log of who changed or deleted what. | Partly met |
| SEC-09 | Protect API keys and credentials | High | `.env`, `terraform.tfvars` and Terraform state must never be committed. The token-signing secret is kept in Terraform state and the Lambda's settings, not yet in AWS Secrets Manager (see section 4). | Partly met |
| SEC-10 | Secure backups | Medium | DynamoDB point-in-time recovery is on. Deletion protection is turned on only in production (`deletion_protection_enabled = local.is_prod`). | Met |
| SEC-11 | Short-lived sessions | High | The API issues its own session token, which lasts 8 hours. Tokens can't be cancelled early (see section 4). | Partly met |
| SEC-12 | Safe file upload and download | High | Files never pass through the API: the browser uses signed S3 links, valid for 15 minutes to upload and 5 minutes to download, with a 20 MB size limit. | Met |
| SEC-13 | Protection against overload and abuse | Medium | API Gateway limits requests to 50 a second, with bursts of up to 100. | Met |
| SEC-14 | Security review of AI features | High | The AI features in [Epic 6 #118](https://github.com/Red-dish/PerceptionLMS/issues/118) (at-risk prediction #120, course chatbot #123, study recommendations #124) aren't covered by the controls above yet. | Not yet |

> ✍️ **To write (Yogesh):** check each Priority and Status, and change any you disagree with. For SEC-14, write 2 to 3 sentences on what a security review of the AI features must check before they go live.

## 3. User permissions

| Action | Student (enrolled) | Lecturer (enrolled) | Admin |
| --- | --- | --- | --- |
| See course, published modules and materials | Yes | Yes, including drafts | Yes |
| Add, change or remove modules, materials, assignments, announcements | No | Yes | Yes |
| Submit an assignment | Yes, own only | No | No |
| See submissions and grade them | Own only; mark hidden until released | Yes | Yes |
| Manage users, courses and enrolments | No | No | Yes |

Source: [system-design.md](../Product%20Build/system-design.md). The first version listed "Management" and "IT Staff" roles. Perception LMS doesn't have them: people who run the system are admins.

> ✍️ **To write (Yogesh):** check this table against the app, and add a row for who may see AI at-risk predictions (see [ai-ethics-and-privacy.md](ai-ethics-and-privacy.md)).

## 4. Gaps and risks

These are known limits of the current build, taken from [system-design.md](../Product%20Build/system-design.md) and the infrastructure code:

| Gap | Requirement | Risk rating | Who should fix it | What to do |
| --- | --- | --- | --- | --- |
| Session tokens can't be cancelled early; a stolen token works for up to 8 hours unless the user is deactivated | SEC-11 | ✍️ | ✍️ | ✍️ |
| Token-signing secret is in Terraform state and Lambda settings, not AWS Secrets Manager | SEC-09 | ✍️ | ✍️ | ✍️ |
| "Flexible" SSL between Cloudflare and the website bucket means that last hop isn't encrypted (website files only, no student data) | SEC-07 | ✍️ | ✍️ | ✍️ |
| No audit log of who changed or deleted records | SEC-08 | ✍️ | ✍️ | ✍️ |
| Deletion protection is off outside production | SEC-10 | ✍️ | ✍️ | ✍️ |
| AI features have no security review yet | SEC-14 | ✍️ | ✍️ | ✍️ |

> ✍️ **To write (Yogesh):** fill in the last three columns. Use the same Low / Medium / High ratings as the DPIA (section 5), and name an owner from [teams.md](../Teams%20and%20Roles/teams.md).

## 5. Compliance

> ✍️ **To write (Yogesh):** which laws and standards apply and how this document links to them: the Australian Privacy Principles (link the privacy policy and DPIA), OWASP Top 10, and the automated-decision rules from 10 December 2026 that affect the AI at-risk feature.

## 6. Security testing

From the first version:

- [ ] Test sign-in and sign-out.
- [ ] Verify that students can't view other students' grades.
- [ ] Check that restricted pages require authorisation.
- [ ] Check for exposed passwords and API keys.
- [ ] Test invalid inputs and error handling.

> ✍️ **To write (Yogesh):** add tests for the new requirements, for example: a deactivated user is refused, signed links stop working after they expire, a student can't open another course by changing the web address, and an upload over 20 MB is refused.

## 7. Review

> ✍️ **To write (Yogesh):** how often this document is reviewed, and what triggers an early review (for example, a new AI feature or a security incident).
