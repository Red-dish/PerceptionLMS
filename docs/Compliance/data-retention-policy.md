# Perception LMS — Data Retention Policy

**Owner:** Yoodem, Compliance and Risk Officer · **Status:** Draft · **Issue:** #98
**Related:** [security-requirements.md](security-requirements.md) (SEC-03, SEC-08, SEC-10)

## 1. Purpose

This policy says how long Perception LMS keeps each kind of data, and how the data is deleted when that time is up. Under Australian Privacy Principle 11.2, personal information must be destroyed or de-identified once it's no longer needed. We keep data for as long as teaching, appeals and the law need it, and no longer.

Periods marked **(confirm with ASA)** are suggestions until ASA College confirms its own record-keeping rules.

## 2. Retention periods

| Data | Where it's stored | Kept for | Then |
| --- | --- | --- | --- |
| User account (name, email, role) | Database | While the user is active, plus **2 years** after deactivation | Delete, or de-identify where records still need it |
| Course details and modules | Database | **2 years** after the course's term ends (confirm with ASA) | Delete |
| Course materials uploaded by lecturers | File storage (S3) | **2 years** after the course's term ends (confirm with ASA) | Delete; lecturers keep their own copies |
| Student submissions and resubmissions | File storage (S3) | **1 year** after final grades are released (confirm with ASA) | Delete |
| Grades, feedback and the gradebook | Database | **7 years** after the course ends (confirm with ASA) | Export to ASA's student records system, then delete from the LMS |
| Extensions and late or missing work | Database | Same as grades: **7 years** | Delete with the grades |
| Announcements | Database | **2 years** after the course's term ends | Delete |
| API activity logs | AWS CloudWatch | **30 days**: already set in the system | Deleted automatically |
| Database recovery copies | AWS point-in-time recovery | **35 days**: already set in the system | Deleted automatically |

## 3. Special cases

- **A student leaves or withdraws:** an admin deactivates their account straight away, so they can no longer sign in. Their grades and submissions follow the periods above, counted from the end of their last course.
- **Appeals, complaints or misconduct cases:** the related data is kept until the case is closed, even past its normal period, and then for **1 more year**.
- **Legal hold:** if ASA receives a legal request or expects a dispute, nothing related is deleted until ASA lifts the hold.
- **A request to delete personal data:** an admin handles it within **30 days**. Grades that ASA must keep by law can't be deleted early, and we tell the person which ones and why.

## 4. Who does what

| Role | Responsibility |
| --- | --- |
| Compliance and Risk Officer | Owns this policy, reviews it each year, and approves early deletion |
| Admin (ASA IT staff) | Deactivates leavers, runs the yearly clean-up, and handles deletion requests |
| Tech lead | Builds and maintains automatic deletion in the system |
| Lecturers | Keep their own copies of teaching materials they want to reuse |

Every deletion other than an automatic one is recorded with the date, the data, the reason and who approved it.

## 5. Gaps in the system today

The current system doesn't yet do everything this policy needs. These items go to the technical team:

1. **Accounts can only be deactivated, not deleted.** An admin can't fully remove a user, so there's no way to meet a deletion request or the 2-year limit.
2. **Files are never deleted automatically.** The file storage has no rule for removing old submissions and materials. An S3 lifecycle rule would fix this.
3. **There's no grade export for ASA's records yet.** Grades can be exported as CSV one course at a time (#51), but there's no bulk export at the end of a term.
4. **There's no record of deletions.** SEC-08 asks for security logs, but deletions aren't logged separately, and logs are kept for only 30 days.

## 6. Review

This policy is reviewed **once a year**, and whenever the system starts storing a new kind of data (for example quizzes, discussions or messages).
