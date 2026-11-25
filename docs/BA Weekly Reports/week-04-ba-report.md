# Business Analyst Weekly Report: Week 4

**Project week:** 4 (16–22 Nov 2026) · **Report date:** Wed 18 Nov 2026
**Prepared by:** Apeksha, Business Analyst
**Deliverable this week:** AI at-risk prediction and quiz backend, due Wed 18 Nov (listed as the "Week 3 deliverable" in [tasks.md](../Product%20Build/tasks.md), which counts from 2 Nov)

## 1. Summary

This report is my weekly update as the project's business analyst. This week the client added a new requirement in Session 4: make the LMS smarter with AI (Epic 6, [#118](https://github.com/Red-dish/PerceptionLMS/issues/118)). My main task was the business analysis for it: I wrote the AI user stories and acceptance criteria ([ai-insights-user-stories.md](../Product%20Management/ai-insights-user-stories.md), #121, KAN-84), merged in PR #135 on 17 Nov. The quiz backend is merged and the compliance documents are complete. The main risks are that the AI prediction (#120) is not merged yet on deadline day and that the coursework and quiz API is still not live.

**Overall status:** Amber. Business work is on track; the AI build and API deployment are behind.

## 2. My work this week

| Task | Ticket | Status | Notes |
|---|---|---|---|
| AI requirement analysis: user stories and acceptance criteria for at-risk alerts, course chatbot and study recommendations | #121 · KAN-84 | Done (PR #135, merged 17 Nov; issue closed 18 Nov) | 17 acceptance criteria (AR-01 to AR-06, CB-01 to CB-06, SR-01 to SR-05), shared rules, success measures and a build map. Amora's review questions are in the PR #135 description |
| Task 1 dataset analysis from the business side | #119 (support) | Done | `students_demo.csv`: 400 students, 114 (28.5%) at risk. Attendance and quiz average show the biggest gaps between at-risk and other students |
| Assumptions and open questions for Doctor Mo | #121 | Done, awaiting answers | Six questions (A1 to A6), see section 5 |
| Progress tracking across all epics | n/a | Ongoing | See section 3 |
| Set up BA weekly reporting: `docs/BA Weekly Reports/` folder, naming rule, and the rule added to the PR rules, teams.md and README | n/a | Done (PR #137, merged 18 Nov) | Every BA weekly report goes here from Week 4 |
| Progress report 1 | KAN-114 | Due Thu 19 Nov | |

## 3. Epic progress (as of 18 Nov)

Counts are closed feature issues against all feature issues in each epic. "API done" means the backend is merged but screens are still to build.

| Epic | Closed | Open features | Comment |
|---|---|---|---|
| [#27](https://github.com/Red-dish/PerceptionLMS/issues/27) Identity, Roles & Administration | 4 of 5 | #32 Profile | On track for 25 Nov (Amora) |
| [#33](https://github.com/Red-dish/PerceptionLMS/issues/33) Courses & Content | 4 of 6 | #36 Pages, #37 Files (API part done) | Pages API not started |
| [#40](https://github.com/Red-dish/PerceptionLMS/issues/40) Assignments & Submissions | 4 of 5 | #45 Rubrics | Rubrics API not started |
| [#46](https://github.com/Red-dish/PerceptionLMS/issues/46) Quizzes & Gradebook | 1 of 5 | #47, #48, #49, #51 (all API done) | Backend complete; all four need screens from Dipesh and Bishu |
| [#52](https://github.com/Red-dish/PerceptionLMS/issues/52) Communication & Dashboard | 2 of 6 | #55, #56, #57, #58 | Largest remaining block for 25 Nov |
| [#118](https://github.com/Red-dish/PerceptionLMS/issues/118) AI & Insights | 1 of 6 | #119, #120, #122, #123, #124 | Requirements done (#121 closed); #119 and #120 due today; #123 and #124 have no owner |

**Total:** 16 of 33 features closed (48%). 17 remain, 3 of them due today (#119, #120, #122).

## 4. Team progress this week

**Business team**
- Yogesh: WCAG 2.2 accessibility audit merged (PR #131, #102) and DPIA link fixed (PR #132). All compliance documents are now in `docs/Compliance/`.
- Nancy: ethics and privacy note on AI at-risk prediction (#122, KAN-85) written and pushed to `docs/KAN-85-ai-ethics-privacy` on 18 Nov; PR into `dev` still to open. It covers fairness, transparency, access, consent and retention, and states that an AI risk flag must never decide grades, penalties or course access.
- Me (Business Analyst): AI user stories merged (PR #135) and #121 closed; BA weekly reports set up (PR #137). Details in section 2.

**Technical team**
- Roshan: quiz builder (#47, PR #129) and quiz taking and auto-grading (#48, PR #130) backends merged 16 Nov, 61 tests passing, handed over to the frontend.
- Amora: dataset exploration (#119) and at-risk prediction (#120) in progress; quiz API handover doc updated (PR #133).
- Dipesh and Bishu: waiting on the `dev` → `frontend` merge to start the quiz and gradebook screens.

## 5. Risks, issues and open questions

| ID | Risk or issue | Impact | Owner | Action |
|---|---|---|---|---|
| R1 | At-risk prediction (#120) not merged on deadline day | Week's main deliverable may be incomplete | Amora | Demo what works; acceptance criteria AR-01 to AR-06 define "done" |
| R2 | Coursework and quiz API (PRs #85, #129, #130) still not deployed (KAN-72) | Frontend must build against a local backend; nothing new to demo on the live site | Amora | Deploy before the 25 Nov deliverable |
| R3 | Course chatbot (#123) and study recommendations (#124) have no owner | Two features due 25 Nov may slip | Amora / Nancy | Assign owners this week |
| R4 | Heavy frontend load for 25 Nov: screens for about 12 features | Week 5 deliverable at risk | Dipesh and Bishu | Prioritise quizzes and gradebook first; agree a cut-line with Amora |
| R5 | Attendance is the strongest predictor but the LMS doesn't track it (A1) | Model may be weaker on real LMS data | Doctor Mo | Question raised, see below |

**Open questions for Doctor Mo** (from section 7 of the AI requirements):
- A1: Will attendance be recorded in the LMS, imported, or left out?
- A2: Should students ever see their own at-risk status?
- A3: How is "at risk" defined in real data?
- A4: Can real anonymised student data be used, and has consent been given?
- A5: Which AI provider is approved for the chatbot?
- A6: Who acts on an at-risk flag: the lecturer, student support, or both?

## 6. Decisions this week

- At-risk alerts are built first, then study recommendations, then the chatbot (suggested order in the AI requirements, section 6).
- For at-risk alerts, recall (finding struggling students) matters more than precision: target recall of 80% or more and precision of 70% or more.
- Students get a supportive nudge rather than seeing an "at risk" label (assumption A2, pending confirmation).

## 7. My plan for next week (23–27 Nov, deliverable due Wed 25 Nov)

As business analyst, next week I will:

- Get answers to A1 to A6 from Doctor Mo and update the AI requirements.
- Confirm owners for #123 and #124 with Amora and Nancy.
- Design review of the quiz and gradebook screens with Dipesh and Bishu against the user stories.
- Prepare usability test scenarios for the quiz flow and the at-risk lecturer view.
- Continue the business case and cost comparison with Canvas, adding the AI features.
- Track every epic against the 25 Nov milestone and flag slips early.
