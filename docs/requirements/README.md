# Requirements

The lecturer's requirements have changed several times. This folder keeps **one file per version**, so the team always knows which one is current and why things changed.

## Current version: [v3, the ASA Smart LMS brief](v3.md)
- **Final demo and presentation:** Thu 3 Dec 2026. **Progress checkpoint:** Wed 25 Nov 2026.
- **Plan:** [ai-features-plan.md](../Product%20Build/ai-features-plan.md).

| Version | Date | Source | Status | In one line |
|---|---|---|---|---|
| [v3](v3.md) | 18 Nov 2026 | Lecturer: *ASA Smart LMS* brief (PDF) | **Current** | A student chatbot grounded in unit documents, and lecturer risk labels from a trained Decision Tree / MLP, for a five-student demo class |
| [v2.1](v2.1.md) | 17–18 Nov 2026 | The team | Superseded by v3 | A `test-student` role and CSV import; logistic regression plus Qwen on AWS Lambda; a lecturer chatbot over the CSV. Code archived in `ml/archive/v2.1-student-risk-qwen/` |
| [v2](v2.md) | 15 Nov 2026 | Lecturer, Session 4 | Superseded by v3 | Add AI: predict each student's `at_risk` status with a machine learning model trained on `students_demo.csv` (400 students) |
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
2. **Mark the previous file superseded:** change its status line to "Superseded by vN on date".
3. **Archive code built only for the old version:** move it to `ml/archive/<version>-<name>/` (or the matching area) with an `ARCHIVE.md`, and tag the commit `requirements-<version>`.
4. **Update this table**, plus [task.md](../task.md) and the current plan.

Copies of the lecturer's documents are kept in the private tracking folder (`docs/Tracking/briefs/`), not in this repository.
