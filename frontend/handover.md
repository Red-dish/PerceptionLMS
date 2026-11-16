# Frontend handover for Dipesh and Bishu

**From:** Amora · **Updated:** 17 Nov 2026

You two design and build the screens together, and review each other's PRs into `frontend`. There's no frontend lead. Roshan builds the APIs and hands each one to you; Amora builds the AI features and profile, and publishes the site. This page covers what's ready to build, how to use the new APIs, and how changes reach https://perceptionlms.com. For setup details and the folder layout, see [README.md](README.md).

## Where things stand (17 Nov)

- **The app is live at https://perceptionlms.com.** It's the React app in this folder, as it is on `main`.
- **Sign-in works** with a real Google account against the live API, for people an admin has added.
- **Built so far:** dashboards, courses, modules and materials, assignments and marking, grades, people and user admin (Amora), and the lecturer grading view #44 (Dipesh, PR #97).
- **Quiz API ready (16 Nov), built by Roshan in PRs #129 and #130:** the quiz builder (#47) and quiz taking with auto-marking (#48). See [New in the API: quizzes](#new-in-the-api-quizzes-16-nov). Roshan also made a **clickable mock-up** of the quiz builder, quiz taking, short-answer marking and the gradebook: open [UI-UX-Design/Quizzes-Gradebook/index.html](../UI-UX-Design/Quizzes-Gradebook/index.html) in your browser.
- **Coursework API ready (10 Nov), built by Roshan in PR #85:** files, late and missing work, resubmissions and extensions, the gradebook and CSV export. See [New in the API (10 Nov)](#new-in-the-api-10-nov).
- **Neither is on the live API yet.** Build against a local backend until Amora deploys them (KAN-72). See [Using the new API before it's live](#using-the-new-api-before-its-live).
- **Accessibility audit:** Yogesh's WCAG 2.2 audit is in [docs/Compliance/accessibility-audit.md](../docs/Compliance/accessibility-audit.md). Fix what it lists on any page you touch.

The quiz code reaches the `frontend` branch when Amora merges `dev` into it. Until then, `git pull` on `frontend` won't have the quiz endpoints or the mock-up.

Bishu's earlier draft is still in git if you want to reuse code or design from it:

```bash
git show "ee7c2f8:UI-UX-Design/Frontend/client/src/pages/Dashboard.jsx"
```

## Get it running

From the repo folder:

1. Get the latest frontend code:
   ```bash
   git switch frontend
   ```
   ```bash
   git pull
   ```
2. **First time only:** go to the `frontend` folder and create your settings file, then add the Google client ID from Amora:
   ```bash
   cp .env.example .env.local
   ```
3. Install and start. If you installed packages before 9 Nov, run `npm install` again, because the build tools were updated.
   ```bash
   npm install
   ```
   ```bash
   npm run dev
   ```
4. Open http://localhost:5173 and sign in. **Amora must add your Google account first.**

**To see each role:** your account has one role at a time. Ask Amora to change it on the Users page, and to enrol you in a test course. The dashboard and course pages look different for each role.

## What to build next

Everything below is due **Wed 25 Nov** (GitHub milestone "Deliverable 25 Nov"). Split the screens between you, one branch and pull request each, and review each other's PRs. Each GitHub issue has a **Frontend** checklist: tick your boxes and change its heading to "Done" in the same PR.

Work in this order. The first ones have their API ready, so you can build them now.

| Issue | Feature | API (who builds it) |
| --- | --- | --- |
| [#49](https://github.com/Red-dish/PerceptionLMS/issues/49) | Lecturer gradebook | **Ready** (Roshan, PR #85) |
| [#51](https://github.com/Red-dish/PerceptionLMS/issues/51) | Grade export (CSV) | **Ready** (Roshan, PR #85) |
| [#47](https://github.com/Red-dish/PerceptionLMS/issues/47) | Quiz builder and quiz settings | **Ready** (Roshan, PR #129) |
| [#48](https://github.com/Red-dish/PerceptionLMS/issues/48) | Quiz taking, timer, score, lecturer marks short answers | **Ready** (Roshan, PR #130) |
| [#37](https://github.com/Red-dish/PerceptionLMS/issues/37) | Files | **Mostly ready** (Roshan, PR #85): folders and linking left |
| [#57](https://github.com/Red-dish/PerceptionLMS/issues/57) | Calendar | **Ready enough.** `GET /courses`, then `GET /courses/{id}/assignments` for each course, gives every due date |
| [#32](https://github.com/Red-dish/PerceptionLMS/issues/32) | User profile and settings | Waiting (Amora) |
| [#36](https://github.com/Red-dish/PerceptionLMS/issues/36) | Pages | Waiting (Roshan) |
| [#45](https://github.com/Red-dish/PerceptionLMS/issues/45) | Basic rubrics | Waiting (Roshan) |
| [#55](https://github.com/Red-dish/PerceptionLMS/issues/55), [#56](https://github.com/Red-dish/PerceptionLMS/issues/56) | Discussions, inbox | Waiting (Roshan) |
| [#58](https://github.com/Red-dish/PerceptionLMS/issues/58) | Notifications | Waiting (Roshan) |

You can design screens whose API is still "Waiting": ask Roshan (or Amora for profile) what data each one will return.

**Still open from Week 1:** the final look (KAN-65): colours and type in `tailwind.config.js` and `src/index.css`, shared pieces in `src/components/ui.jsx`, navigation in `src/components/Layout.jsx`, the sign-in page and dashboards. The original design is [UI-UX-Design/UI Design.html](../UI-UX-Design/UI%20Design.html).

## New in the API: quizzes (16 Nov)

Added in PRs #129 and #130. Every request and response, with examples, is at `/docs` on the backend (http://localhost:8000/docs when it runs locally), under **quizzes**. The rules are in [backend/README.md](../backend/README.md) under "Quizzes" and "Taking a quiz". "Lecturer" means a lecturer enrolled in the course; admins can do the same.

**A quiz is an assignment with `kind: "quiz"`.** So it already appears in the assignment list, the gradebook, the CSV, the late and missing report and the student's grades. You don't need a separate list of quizzes.

### Quiz builder (#47, lecturer)

1. **Create the quiz** with the existing `POST /courses/{id}/assignments`, sending `kind: "quiz"` plus the settings. Edit them later with `PATCH`:
   - `time_limit_minutes` (1 to 600; empty means no limit)
   - `max_attempts`, `due_at`, `available_from`, `available_until`
   - `shuffle_answers`: shuffle the options for each student
   - `show_score` (default true): students see their score as soon as they submit
   - `show_correct_answers` (default false): students see the right answers after submitting
2. **Load it:** `GET /courses/{id}/quizzes/{quizId}` returns the settings, `question_count` and, for lecturers, every `questions` entry with its answers.
3. **Add questions:** `POST …/quizzes/{quizId}/questions` with `type`, `text` (Markdown), `points`, and the answer field for that type only:
   - `multiple_choice`: `options`, 2 to 10, each `{ text, correct }`. Several can be correct.
   - `true_false`: `answer`, `true` or `false`.
   - `short_answer`: optional `accepted_answers`, a list of answers marked right automatically (case and spacing ignored). Anything else waits for the lecturer.
4. **Edit** with `PATCH …/questions/{questionId}` (sending `options` replaces them all), **delete** with `DELETE`, and **reorder** with `PUT …/questions/order` and `{ "question_ids": [...] }`, listing every question once.
5. **The quiz's `max_mark` is always the total of its questions' points.** Re-read the quiz after changing questions rather than working it out yourself.
6. **Once any student has started, the quiz is locked:** adding, deleting, reordering and changing points or answers return **409**. Only a question's `text` can change. Show the 409 message, and consider disabling those buttons when the lecturer's attempt list isn't empty.

### Taking a quiz (#48, student)

1. `GET /courses/{id}/quizzes/{quizId}` gives the student `question_count`, `my_attempts`, `attempts_left` (empty means unlimited) and **`can_start`**. Show the Start button only when `can_start` is true. Students never get the answers here.
2. **Start:** `POST …/quizzes/{quizId}/attempts`. It returns the attempt with its `questions` in this student's order, a `deadline` and `seconds_left`. If an attempt is already in progress, you get that one back (status 200 instead of 201), so this also handles a refresh: **the clock doesn't stop when the page closes.**
3. **Timer:** count down from `seconds_left`. Don't trust the browser clock for anything else; the server enforces the limit.
4. **Save as they go:** `PUT …/attempts/{attemptId}/answers` with `{ "answers": { questionId: answer } }`. Answers are merged with earlier saves, so send only what changed. Answer shapes: multiple choice is a **list** of option IDs (even for one), true/false is `true`/`false`, short answer is text (up to 5,000 characters).
5. **Submit:** `POST …/attempts/{attemptId}/submit` with the same body. When the timer hits 0, call submit yourself; the server also allows 30 seconds' grace, then submits the saved answers on its own (`auto_submitted: true`).
6. **After submitting:** the response has `status` (`submitted` while short answers wait for marking, `graded` when done), `score`, `max_score` and per-question `results`. Students only see `score` and `results` if the quiz's `show_score` is on or the lecturer released marks, and the right answers only if `show_correct_answers` is on. When they're hidden they come back empty, so show "Your score will appear once your lecturer releases it".
7. Errors to handle: **409** "used all attempts" or "already submitted" or "Time is up", **403** "This quiz has closed", **422** for a badly shaped answer.

### Marking short answers (#48, lecturer)

- `GET …/quizzes/{quizId}/attempts?needs_marking=true` lists attempts with short answers waiting. Add `student_id=` for one student. Lecturers get the questions, answers and results.
- `PUT …/attempts/{attemptId}/marks` with `{ "marks": { questionId: points } }`. When nothing is left to mark, the attempt gets its score and the student's gradebook mark updates.
- The student's **best fully marked attempt** is what the gradebook shows.
- Students can't use the normal submission endpoint for a quiz with questions (it returns 409), so send them to the quiz-taking screen instead.

## New in the API (10 Nov)

Added in PR #85. Every request and response is listed with examples at `/docs` on the backend (http://localhost:8000/docs when it runs locally). "Lecturer" means a lecturer enrolled in that course; admins can do the same.

| For | Endpoint | What it does |
| --- | --- | --- |
| #37 Files | `GET /courses/{id}/files?folder=` | Every file in the course across all modules, with its module's title. Filter by folder |
| #37 Files | `PATCH …/modules/{id}/materials/{id}` | Rename a file, change its description or folder, reorder it, or move it to another module (`module_id`) |
| #37 Files | `POST …/materials/{id}/file` | Replace a file's contents. Returns an upload form, used like any other upload |
| Modules | `PUT /courses/{id}/modules/order` | Reorder modules: send every module ID in the new order (`module_ids`) |
| #43 Late work | `GET /courses/{id}/late-missing?status=` | Lecturer: every late or missing piece of work in a course, with counts. `status` is `late` or `missing` |
| #43 Late work | `GET /admin/late-missing?status=` | Admin: the same, for every course |
| #43 Resubmission | `GET …/assignments/{id}/resubmissions` | Lecturer: students given a resubmission or extension |
| #43 Resubmission | `PUT` and `DELETE …/submissions/{studentId}/resubmission` | Lecturer: give or remove one. Send `until` (a date) for an extension, or leave it empty to allow one more attempt |
| #44 Grading | `DELETE …/submissions/{studentId}/grade` | Lecturer: clear a mark |
| #44 Grading | `POST …/assignments/{id}/release` | Lecturer: release every mark at once |
| #44 Grading | `GET …/submissions/{studentId}/attempts/{n}/download` | Lecturer: download an earlier attempt |
| #49 Gradebook | `GET /courses/{id}/gradebook` | Lecturer: every student against every assignment and quiz, with totals, percent, weighted percent, and missing and late counts |
| #49 Gradebook | Editing a cell | Use the same `PUT …/submissions/{studentId}/grade` as marking. It works even if the student never submitted online |
| #51 Export | `GET /courses/{id}/gradebook.csv` | Lecturer: the gradebook as a CSV file |
| Assignments | `DELETE /courses/{id}/assignments/{id}` | Lecturer: delete an assignment |
| Announcements | `PATCH /courses/{id}/announcements/{id}` | Lecturer: edit an announcement or change when it goes out |

**New fields on existing endpoints.** All are optional, so today's screens still work unchanged:

- **Creating or editing an assignment** (`POST`/`PATCH …/assignments`):
  - `kind`: `assignment` or `quiz`.
  - `submission_type`: `file`, `text`, `both`, or `none` for work done in class.
  - `published`: defaults to true.
  - `module_id`: attaches the assignment to a module.
  - `available_from` and `available_until`: students can't see the assignment before the first date, or submit after the second.
  - `late_penalty_percent`: percent taken off for each day late.
  - `max_attempts`.
- **Announcements:** `publish_at` schedules one for later. Students don't see it until then.
- **Grades and submissions:** `final_mark` is the mark after any late penalty, and it's what the gradebook totals. `days_late` rounds up, so one minute late counts as one day. Earlier attempts are kept in `history`.
- **Students don't see** unpublished assignments, assignments before `available_from`, or announcements before `publish_at`.

The rules behind all of this are in [system-design.md](../docs/Product%20Build/system-design.md), under "Assignments, marking and the gradebook".

### Using the new API before it's live

The live API doesn't have these endpoints yet, so calling them from http://localhost:5173 with the live API set will fail. Until Amora deploys:

1. Run the backend on your computer ([backend/README.md](../backend/README.md), "Run it on your computer"). You need `uv` and Podman installed. In your `backend/.env`:
   - Put your own email in `ADMIN_EMAILS`, so you're the admin locally.
   - Use the same `GOOGLE_CLIENT_ID` as the frontend.
   - Set `JWT_SECRET` to any long random text, which is fine for local use.

   Running the backend is fine; just don't change its code (rule 4).
2. In `.env.local`, set `VITE_API_URL=http://localhost:8000`, and restart `npm run dev`.
3. Sign in. The local database starts empty, so create a test course, users and assignments yourself. They disappear when the backend's container stops.
4. **To test a quiz as both roles:** you can only be one role at a time per Google account, so either change your role on the Users page between steps, or have one of you sign in as the lecturer and the other as a student on the same local backend.

Set `VITE_API_URL` back to the live API when you're done. Amora will tell the team when the new endpoints are live.

## How your changes go live

The full guide is [docs/branching-workflow.md](../docs/branching-workflow.md). In short:

1. **Make a branch for each task** from `frontend`, for example:
   ```bash
   git switch frontend
   ```
   ```bash
   git pull
   ```
   ```bash
   git switch -c feature/KAN-92-quiz-builder-screens
   ```
2. **Commit, push, and open a pull request into `frontend`.** GitHub picks `main` by default, so change the base to `frontend`. The other one of you (Dipesh or Bishu) reviews and approves it. Check [docs/pull-request-rules.md](../docs/pull-request-rules.md) first.
3. **When a set of changes is ready to show,** open a pull request from `frontend` into `dev`. Amora reviews it, then moves `dev` into `main`.
4. **Amora publishes `main` to the site.** Message Amora once your work is on `main`. It's usually live the same day.
5. **Check it on https://perceptionlms.com.** If you still see the old version, do a hard refresh (Ctrl+Shift+R).

Only Amora can publish for now, because it needs AWS access. Automatic publishing whenever `main` changes is planned.

**You can always see your changes straight away on http://localhost:5173.** The live site is for showing finished work to the team and our lecturer.

## Rules

1. **Keep it frontend only.** Don't add a server, database or Node API. If a screen needs data the API doesn't offer, ask Amora or Roshan for an endpoint before building it.
2. **Send every API call through `src/lib/api.js`.** Don't call `fetch` from a page.
3. **Don't change sign-in without talking to Amora.** That means `src/lib/auth.jsx`, `src/lib/api.js` and `src/components/GoogleButton.jsx`.
4. **Leave `backend/` alone,** and leave AWS and Cloudflare to Amora.
5. **Never commit `.env.local`,** passwords, tokens or demo logins.
6. **Don't show made-up numbers as if they were real.** Charts and stats like attendance or progress need real data, which the API doesn't have yet.
7. **Don't commit straight to `frontend`, `dev` or `main`.** GitHub blocks it anyway; always use a pull request.

**Before opening a pull request, check:**

- [ ] `npm run build` succeeds
- [ ] The pages you changed work for each role that can see them
- [ ] They work at phone width, with no sideways scrolling
- [ ] Loading, empty and error states still show properly

**Shared data:** the live API holds data for the whole team, so don't delete things you didn't create. To work with your own data, [run the backend locally](../backend/README.md) and set `VITE_API_URL=http://localhost:8000` in `.env.local`.

## Who to ask

| Question | Ask |
| --- | --- |
| The project overall, sign-in, hosting, publishing | Amora |
| An API: profile, AI at-risk view | Amora |
| An API: files, late work, gradebook, quizzes, pages, rubrics, discussions, inbox, notifications | Roshan |
| Reviewing your PR | The other frontend developer (Dipesh or Bishu) |
| Accessibility findings | Yogesh |
| Design review and feedback | Apeksha |

Your tasks are also listed in [docs/task.md](../docs/task.md).
