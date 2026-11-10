# Frontend handover for Bishu

**From:** Amora · **Updated:** 10 Nov 2026

You lead the frontend's design and reviews. Amora and Roshan build the APIs, Dipesh builds the screens, and you design those screens and review and merge Dipesh's PRs. This page covers what's live, what to design next, and how changes get onto https://perceptionlms.com. For setup details and the folder layout, see [README.md](README.md).

## Where things stand

- **The app is live at https://perceptionlms.com.** It's the React app in this folder, as it is on `main`.
- **Sign-in works** with a real Google account against the live API, for people an admin has added.
- **Every screen is built and working** for all three roles: dashboards, courses, modules and materials, assignments and marking, grades, people and user admin. Amora built them all, along with the API behind them. What's left is mostly design, and the design work (section 1, KAN-65) hasn't started yet.
- **New API for coursework (10 Nov), built by Roshan in PR #85:** files, late and missing work, resubmissions and extensions, the gradebook and CSV export, scheduled announcements, and more assignment settings. No screens use it yet. See [New in the API](#new-in-the-api-10-nov). It's on the `frontend` branch but **not on the live API yet**, so build against a local backend until Amora deploys it.

Your earlier draft is still in git if you want to reuse code or design from it:

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

## What to design

Work through these in order. Each one is a separate branch and pull request (see the next section).

### 1. Finish the look (KAN-65)

Everything works, so this is styling. The original design to work from is [UI-UX-Design/UI Design.html](../UI-UX-Design/UI%20Design.html).

- [ ] **Colours and type:** `tailwind.config.js` and `src/index.css`. Do these first, since every page uses them.
- [ ] **Shared pieces:** buttons, cards, loading and error states in `src/components/ui.jsx`
- [ ] **Navigation:** `src/components/Layout.jsx`, on desktop and phone
- [ ] **Sign-in page:** `src/pages/Login.jsx`
- [ ] **Dashboard for each role:** `src/pages/Dashboard.jsx`
- [ ] **Course cards:** `src/components/CourseCard.jsx`
- [ ] **Apeksha's design feedback (KAN-66):** ask Apeksha for it, since it isn't done yet

### 2. Design the new screens, and review Dipesh's PRs

Dipesh builds the screens for every open feature below. Your part is to **design each screen before Dipesh builds it**, then **review and merge his PR** into `frontend`. Read each GitHub issue for what's needed. The full plan is in [docs/Teams and Roles/teams.md](../docs/Teams%20and%20Roles/teams.md).

**This week (due Wed 11 Nov):** Dipesh is building #44, the lecturer grading view (KAN-70). Review his PR into `frontend` and merge it when it's ready (KAN-71). Use the checklist under "Before opening a pull request" below.

Work in this order. The first ones have their API ready, so Dipesh can build them now and needs your designs first.

| Issue | Feature | When | API (who builds it) |
| --- | --- | --- | --- |
| [#44](https://github.com/Red-dish/PerceptionLMS/issues/44) | Lecturer submission review and grading | Core | **Ready**, with new extras |
| [#37](https://github.com/Red-dish/PerceptionLMS/issues/37) | Files | Core | **Ready** (Roshan, new) |
| [#43](https://github.com/Red-dish/PerceptionLMS/issues/43) | Late, missing and resubmission | Core | **Ready** (Roshan, new) |
| [#49](https://github.com/Red-dish/PerceptionLMS/issues/49) | Lecturer gradebook | Core | **Ready** (Roshan, new) |
| [#32](https://github.com/Red-dish/PerceptionLMS/issues/32) | User profile and settings | Core | Waiting (Amora). `GET /me` reads the profile, but nobody can edit their own details yet |
| [#36](https://github.com/Red-dish/PerceptionLMS/issues/36) | Pages | Core | Waiting (Amora) |
| [#51](https://github.com/Red-dish/PerceptionLMS/issues/51) | Grade export (CSV) | After core | **Ready** (Roshan, new) |
| [#57](https://github.com/Red-dish/PerceptionLMS/issues/57) | Calendar | After core | **Ready enough.** `GET /courses`, then `GET /courses/{id}/assignments` for each course, gives every due date |
| [#45](https://github.com/Red-dish/PerceptionLMS/issues/45) | Basic rubrics | After core | Waiting (Roshan) |
| [#47](https://github.com/Red-dish/PerceptionLMS/issues/47), [#48](https://github.com/Red-dish/PerceptionLMS/issues/48) | Quiz builder, quiz taking | After core | Waiting (Roshan). A quiz can be created and marked by hand, but there are no questions or auto-marking yet |
| [#58](https://github.com/Red-dish/PerceptionLMS/issues/58) | Notifications | After core | Waiting (Roshan) |
| [#55](https://github.com/Red-dish/PerceptionLMS/issues/55), [#56](https://github.com/Red-dish/PerceptionLMS/issues/56) | Discussions, inbox | After core | Waiting (Amora) |

You can design screens whose API is still "Waiting": ask Amora or Roshan what data each one will return.

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
   git switch -c feature/KAN-65-colours-and-type
   ```
2. **Commit, push, and open a pull request into `frontend`.** GitHub picks `main` by default, so change the base to `frontend`. Someone else must approve your own design PRs before they can merge, so ask Amora or Dipesh.
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
| An API: profile, pages, discussions, inbox | Amora |
| An API: files, late work, gradebook, rubrics, quizzes, notifications | Roshan |
| Building a screen | Dipesh, whose PRs you review |
| Design review and feedback | Apeksha |

Your tasks are also listed in [docs/task.md](../docs/task.md).
