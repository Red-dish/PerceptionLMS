# Perception LMS — Ethics and Privacy Note: AI At-Risk Prediction

**Owner:** Nancy · **Status:** Draft for team review · **Issue:** [#122](https://github.com/Red-dish/PerceptionLMS/issues/122) (KAN-85) · **Epic:** [#118 AI & Insights](https://github.com/Red-dish/PerceptionLMS/issues/118) (KAN-81)
**Related:** [dpia.md](dpia.md) (section 8), [privacy-policy.md](privacy-policy.md), [data-retention-policy.md](data-retention-policy.md), [security-requirements.md](security-requirements.md), [AI user stories](../Product%20Management/ai-insights-user-stories.md) (AR-01 to AR-06), feature issue [#120](https://github.com/Red-dish/PerceptionLMS/issues/120)

## 1. Purpose and scope

Perception LMS will use a machine learning model to predict which students may be at risk of falling behind, so lecturers can offer support early (#120). This note sets out the ethical and privacy risks of that feature and the safeguards the app must follow. The safeguards in section 8 become backend and frontend criteria on #120.

**In scope:** the at-risk model, the risk scores and reasons it produces, who sees them, and how long they're kept.
**Out of scope:** the course chatbot (#123) and study recommendations (#124). They send different data to different places and need their own note before they're built.

### The most important rule

> **AI risk predictions are a prompt for support, never a grade.** They exist to help lecturers notice students early and look after their wellbeing. They must never, on their own, decide a student's marks, academic penalties, course access, or progression.

## 2. What the model uses

The model is trained on `ml/dataset/students_demo.csv`: 400 **fictional** students, 114 (28.5%) labelled at risk. It uses five inputs:

| Input | What it measures | Where it would come from in the LMS |
| --- | --- | --- |
| `attendance_pct` | Share of classes attended | Not tracked yet (user stories, assumption A1) |
| `quiz_average` | Average quiz score | Quizzes and gradebook |
| `missed_assignments` | Assignments not submitted | Late and missing work |
| `weekly_logins` | Logins per week | Sign-in activity |
| `days_since_login` | Days since last login | Sign-in activity |

`student_id` and `student_name` are **not** inputs. The model never uses age, gender, cultural background, language, disability, health, or financial information, and the LMS doesn't collect them (DPIA section 2).

**Output:** for each student, whether they may be at risk and the main reasons (for example "3 missed assignments; no login for 10 days").

## 3. Fairness and bias

**The risk:** the model judges engagement through activity the LMS can see. Some students engage in ways it can't see, so they could be flagged unfairly. For example:

- **Working or caring students** who log in once a week for a long session look less engaged than students who log in daily for a few minutes.
- **Students with a disability or health condition** may have approved adjustments, extensions or breaks that look like "missed" work or "days since login".
- **Students with poor internet access** may download materials once and study offline.
- **Students whose first language isn't English** may score lower on early quizzes while still engaging well.

The reverse also happens: a student who logs in often but is struggling may not be flagged.

**Limits of what we know:** the model has only been trained and tested on fictional data. Its accuracy on real ASA students is unknown. Because the LMS doesn't collect demographic data, we can't directly test whether the model treats groups differently. That's a good privacy choice, but it means fairness has to be checked in other ways (see the safeguards).

**Safeguards:**

- Never flag a student from login activity alone. A flag needs at least one learning measure (quiz average, missed assignments or attendance) to contribute.
- Treat approved extensions and adjustments as submitted work, not missed work.
- Report precision and recall, not just accuracy (#120). With 28.5% of students at risk, a model can look accurate while missing many of them.
- Retrain and test on real ASA data, once there's enough, before the feature is used in live teaching. Until then, label it a pilot.
- Each term, check how many flags lecturers marked as wrong (see section 7), and look for patterns, for example many part-time students flagged.
- Don't add sensitive characteristics as inputs, even if they would improve accuracy.

## 4. Transparency

**The risk:** a bare "High risk" label tells a lecturer nothing about what support to give, and a student can't question a decision they don't know exists.

**Safeguards:**

- **Show the reasons, not just the label.** Lecturers see the measures behind each flag (AR-02), for example "attendance 55%; 3 missed assignments; no login for 10 days".
- **Use supportive wording.** Say "may need support", never "failing" or "high-risk student". The view should explain that the prediction is an estimate and can be wrong.
- **Tell students before it starts.** The privacy policy must describe at-risk prediction before it's switched on for real students (DPIA section 8, APP 5 and 6). It should say what data is used, why, who sees the result, and how to question it.
- **Meet the automated decisions rule.** From **10 December 2026**, the privacy policy must explain when a computer program is used to make decisions that could significantly affect people (*Privacy and Other Legislation Amendment Act 2024*). Keeping a lecturer in the loop (section 7) keeps the effect on students low, but the policy should still describe the feature.
- **Let students see their own result.** A student who asks can see whether they've been flagged and why (APP 12), and can point out a mistake (APP 13).

## 5. Access and permissions

**The risk:** a risk flag is sensitive. Seen by the wrong person, it could embarrass a student or change how they're treated.

| Who | Can see |
| --- | --- |
| **Lecturers** | Risk and reasons for students in **their own courses only** (AR-01, AR-02) |
| **Admins** | A summary across courses to plan support services (AR-05), and the on/off switch per course (AR-06) |
| **The student** | Their own result and reasons, if they ask or through a supportive nudge (AR-04) |
| **Other students** | Nothing |
| **Technical team** | Only when fixing a problem, as with other data (DPIA section 2) |

**Safeguards:**

- Enforce these rules in the API, not just by hiding buttons in the frontend. The risk endpoint returns 403 for students and for lecturers of other courses (SEC-02, SEC-05).
- Add automated tests for these access rules, like the existing ones for submissions and grades (DPIA risk P-01).
- Record who viewed or exported risk data, and when (SEC-08, DPIA risk P-07).
- Don't include risk flags in gradebook CSV exports or in announcements.

## 6. Consent and privacy

**The risk:** students gave their data so their work could be taught and marked. Using it to predict risk is a **new use** (APP 6), and they must know about it.

**What students should be told:**

1. What data is used: the five measures in section 2.
2. Why: to help lecturers offer support early.
3. How the model uses it, in plain words.
4. Who can see the result (section 5).
5. That no data is sent to a third party: the model runs inside our own AWS account in Sydney.
6. How to ask questions, see their result, or correct a mistake.

**Safeguards:**

- **Notice before use.** Update the privacy policy, and tell students in the LMS, before the feature is switched on.
- **Only what's needed.** Use only the five inputs. Don't add new data (for example, page-by-page tracking) without updating this note and the DPIA.
- **No third parties.** Keep the model in our own system. If a third-party AI service is ever used, it needs a new assessment, and the provider must agree not to train on our data (DPIA section 8, APP 8).
- **Consent.** ASA College should confirm whether it wants students to opt in or opt out **(confirm with ASA)**. At minimum, students should be able to switch off nudges sent to them (AR-04), even if lecturers still see the flag.
- **Fictional data only in development.** Keep using `students_demo.csv` and fake data for training and testing until ASA approves using real data (DPIA risk P-13).

## 7. Human oversight and accountability

- **A person decides.** A lecturer always reviews a flag before acting on it. The system suggests; it doesn't act.
- **Allowed actions:** contacting the student, offering a meeting, pointing them to support services, and suggesting materials.
- **Not allowed because of a flag:** changing marks, applying penalties, blocking course access, refusing extensions, or holding back progression.
- **Lecturers can mark a flag as wrong** (alongside AR-03, recording a follow-up). These corrections feed the fairness check in section 3.
- **Admins can switch the feature off** per course (AR-06), for example if a problem with the model is found.
- **Who's responsible:**

| Role | Responsibility |
| --- | --- |
| Tech lead (Amora) | Builds the safeguards, the access rules and tests, and the model's reported accuracy, precision and recall |
| Compliance and Risk Officer (Yoodem) | Adds the feature to the DPIA and privacy policy, and approves real-data use |
| Business Analyst (Apeksha) | Keeps the user stories and acceptance criteria in line with this note |
| Lecturers | Review flags, decide on support, and mark wrong flags |
| Nancy (risk register) | Tracks the risks in section 9 until closed |

## 8. Data retention

**The risk:** an old flag could follow a student long after they've caught up, and change how future lecturers see them.

| Data | Kept for | Then |
| --- | --- | --- |
| Current risk score and reasons | Recalculated from current data; only the latest is stored, until the course's term ends | Delete at the end of term |
| Lecturer follow-up notes and "flag was wrong" marks (AR-03) | **1 year** after the term ends (confirm with ASA) | Delete |
| Admin summary across courses (AR-05) | Counts only, no names; may be kept **2 years** for planning | Delete |
| Record of who viewed or exported risk data | Same as other security logs (SEC-08) | Delete |
| Trained model file | Until it's replaced by a retrained model | Delete old versions; they hold no student names |

**Safeguards:**

- Never copy risk flags into grades, transcripts, or ASA's student records.
- A new term starts clean: one course's flag isn't carried into the next.
- Add these rows to the [data-retention policy](data-retention-policy.md) at its next review.
- A student's deletion request covers their risk data too (privacy policy section 7).

## 9. Safeguards for #120 and remaining risks

### Criteria to add to #120

| ID | Safeguard | Backend | Frontend |
| --- | --- | --- | --- |
| AI-01 | Risk is a prompt for support, never a grade: no automatic action on marks, access or progression | ✓ | ✓ |
| AI-02 | Every flag comes with its main reasons | ✓ | ✓ |
| AI-03 | Supportive wording ("may need support"), and a note that predictions can be wrong | | ✓ |
| AI-04 | Only lecturers of the course and admins can get risk data; tested | ✓ | |
| AI-05 | Views and exports of risk data are recorded | ✓ | |
| AI-06 | Risk flags aren't in gradebook exports | ✓ | ✓ |
| AI-07 | Precision and recall reported, not just accuracy | ✓ | |
| AI-08 | No flag from login activity alone; extensions count as submitted | ✓ | |
| AI-09 | Lecturers can mark a flag as wrong | ✓ | ✓ |
| AI-10 | Flags deleted at end of term | ✓ | |
| AI-11 | Model runs in our own AWS account; no student data sent to a third party | ✓ | |
| AI-12 | Fictional data only until ASA approves real data and the privacy policy is updated | ✓ | |

### Remaining risks for the risk register

| ID | Risk | Rating | Action | Owner |
| --- | --- | --- | --- | --- |
| AI-R1 | Model unfair to students who engage in ways the LMS can't see | Medium | Safeguards AI-08 and AI-09; termly review of wrong flags | Tech lead, Nancy |
| AI-R2 | Model trained only on fictional data performs badly on real students | High | Pilot label; retrain and test on real data before live use | Tech lead |
| AI-R3 | Students not told before the feature starts | Medium | Update the privacy policy before switch-on | Compliance officer |
| AI-R4 | A flag is used to penalise a student | Medium | AI-01, staff guidance, and admin on/off switch | Compliance officer, Admin |
| AI-R5 | Risk data seen by the wrong person | Medium | AI-04, AI-05, AI-06 | Tech lead |
| AI-R6 | Old flags kept too long | Medium | AI-10, and update the retention policy | Tech lead, Compliance officer |

## 10. Review

This note is reviewed when:

- the model gets new inputs, or is retrained on real data,
- a third-party AI service is considered,
- the chatbot (#123) or recommendations (#124) start using risk data,
- a complaint or incident involves a risk flag, or
- once a year at least.
