# StudentHub — Security and Compliance Requirements

## 1. Purpose
To protect ASA College students, lecturers and staff
while using the StudentHub eLearning platform.

## 2. Security Requirements

| ID | Requirement | Priority |


| SEC-01 | Secure user login | High |
| SEC-02 | Role-based access control | High |
| SEC-03 | Protect student personal information | High |
| SEC-04 | Secure password storage | High |
| SEC-05 | Prevent unauthorised access | High |
| SEC-06 | Protect against XSS and SQL injection | High |
| SEC-07 | Use HTTPS for data transmission | High |
| SEC-08 | Maintain security activity logs | Medium |
| SEC-09 | Protect API keys and credentials | High |
| SEC-10 | Maintain secure backups | Medium |

## 3. User Permissions

- Students: View their own courses, grades and assignments.
- Lecturers: Manage assigned courses and assessments.
- Administrators: Manage authorised student records.
- Management: Access approved reports.
- IT Staff: Manage system security and user access.

## 4. Compliance

The application should follow applicable Australian
privacy requirements and use OWASP security guidance.

## 5. Security Testing

- Test login and logout.
- Verify that students cannot view other students' grades.
- Check that restricted pages require authorisation.
- Check for exposed passwords and API keys.
- Test invalid inputs and error handling.

## 6. Status

Draft — Requirements documented, pending implementation,
testing and confirmation from ASA College.