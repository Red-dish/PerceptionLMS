# Requirements

The lecturer's requirements have changed several times. This folder keeps **one file per version**, so the team always knows which one is current and why things changed.

## Current: [v2](v2.md) (at-risk prediction), extended by [v3, the ASA Smart LMS brief](v3.md)
- **Final demo and presentation:** Thu 3 Dec 2026. **Progress checkpoint:** Wed 25 Nov 2026.
- **Plan:** [ai-features-plan.md](../Product%20Build/ai-features-plan.md).

| Version | Date | Source | Status | In one line |
|---|---|---|---|---|
| [v3](v3.md) | 18 Nov 2026 | Lecturer: *ASA Smart LMS* brief (PDF) | **Current, adds to v2** | A student chatbot grounded in unit documents; lecturer risk labels from the trained model, compared against a Decision Tree baseline and a small MLP; a five-student demo class |
| [v2.1](v2.1.md) | 17–18 Nov 2026 | The team | Partly kept: logistic regression carries on; the rest superseded by v3 | A `test-student` role and CSV import; logistic regression plus Qwen on AWS Lambda; a lecturer chatbot over the CSV. Code archived in `ml/archive/v2.1-student-risk-qwen/` |
| [v2](v2.md) | 11 Nov 2026 (planned 15 Nov) | Lecturer, Session 4 practical work | **Current, extended by v3** | Add AI: an ML model (logistic regression) that predicts `at_risk` from `students_demo.csv` (400 students) |
| [v1](v1.md) | 28 Oct 2026 | Lecturer, project outline | Superseded by v2 (MVP features still apply) | A Canvas-replacement LMS for students, lecturers and admins |

## How versions are numbered
- **Whole number (v2, v3):** a new requirement from the lecturer.
- **Point release (v2.1):** a team decision made inside the current requirement.

## When the requirements change
1. **Add `vN.md`** with this header:
   ```
   # vN: short name

   **Status: current.** **Date:** … **Source:** … **Plan:** link
   ```
   Then write the requirements as given, and end with a **"What changed from the previous version"** table showing what was kept, added and dropped.
2. **Update the previous file's status:** "Superseded by vN on date" if the new version replaces it, or "Current, extended by vN" if it adds to it.
3. **Archive code built only for the old version:** move it to `ml/archive/<version>-<name>/` (or the matching area) with an `ARCHIVE.md`, and tag the commit `requirements-<version>`.
4. **Update this table**, plus [task.md](../task.md) and the current plan.

The lecturer's source documents are in this folder: the Session 4 practical work (v2) and the *ASA Smart LMS* PDF (v3).
