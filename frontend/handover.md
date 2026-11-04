# Frontend handover for Bishu

**From:** Amora · **Date:** 4 Nov 2026 · **Week 1 deadline:** Fri 6 Nov 2026

You now own the frontend's design and features. This page explains what changed, how to get it running and what to do first. For setup details and the folder layout, see [README.md](README.md).

## What changed, and why

Your draft had a great UI, and its look carries over. But it ran on its own Express server and JSON file, while the project uses a FastAPI backend, DynamoDB and S3 hosting. S3 only serves files, so it can't run a Node server.

So the frontend was rebuilt on the same React, Vite and Tailwind setup, connected to our real API.

| | Your draft | Now |
| --- | --- | --- |
| Folder | `UI-UX-Design/Frontend/` | `frontend/` |
| App location | `client/` and `server/` | The React app only |
| Data | Express and `data.json` | Our FastAPI backend |
| Sign-in | Passport, passwords, demo logins | Google only, for people an admin has added |
| Role name | `teacher` | `lecturer` |
| Course content | Lessons | Modules and materials |
| Name | Learnly | Perception LMS |

Your draft is still in git. To look at an old file, run a command like this:

```bash
git show "ee7c2f8:UI-UX-Design/Frontend/client/src/pages/Dashboard.jsx"
```

## Get it running

1. **Commit or back up any local changes to your draft first.** The old folder is gone from this branch. Ask Amora if you're unsure.
2. Get the latest code:
   ```bash
   git switch frontend-draft-bishu
   ```
   ```bash
   git pull
   ```
3. Create your settings file from the `frontend` folder, then add the Google client ID from Amora:
   ```bash
   cp .env.example .env.local
   ```
4. Install and start:
   ```bash
   npm install
   ```
   ```bash
   npm run dev
   ```
5. Open http://localhost:5173 and sign in. **Amora must add your Google account first.**

**To see each role:** your account has one role at a time. Ask Amora to change it on the Users page, and to enrol you in a test course. The dashboard and course pages look different for each role.

## What to do first

### 1. Design for Friday (KAN-65)

Everything below already works, so this is mostly styling. Make Friday's demo screens look finished, in this order:

- [ ] **Sign-in page:** `src/pages/Login.jsx`
- [ ] **Dashboard for each role:** `src/pages/Dashboard.jsx`
- [ ] **Navigation:** `src/components/Layout.jsx`, on desktop and phone
- [ ] **Colours and type:** `tailwind.config.js` and `src/index.css`, plus the shared pieces in `src/components/ui.jsx`
- [ ] **Course cards:** `src/components/CourseCard.jsx`
- [ ] **Apeksha's design feedback (KAN-66),** due Thu 5 Nov

`UI-UX-Design/UI Design.html` is the original design to work from.

### 2. Tell Amora when it's ready, by Thursday night

Amora will publish the site and needs time to test it before Friday.

### 3. After Friday

These GitHub issues are planned for you in [PR #63](https://github.com/Red-dish/PerceptionLMS/pull/63), which isn't merged yet, so confirm them with Amora. Read each issue for what's needed.

| Issue | Feature | Backend |
| --- | --- | --- |
| [#53](https://github.com/Red-dish/PerceptionLMS/issues/53) | Dashboard | `GET /me/dashboard` is ready; extra numbers may need more API |
| [#39](https://github.com/Red-dish/PerceptionLMS/issues/39) | Course navigation menu | Started in `pages/course/CourseLayout.jsx` |
| [#32](https://github.com/Red-dish/PerceptionLMS/issues/32) | User profile and settings | Can read with `GET /me`; people can't edit their own details yet |
| [#36](https://github.com/Red-dish/PerceptionLMS/issues/36) | Pages | No API for this yet |

## Rules

1. **Keep it frontend only.** Don't add a server, database or Node API. If a screen needs data the API doesn't offer, ask Amora or Roshan for an endpoint before building it.
2. **Send every API call through `src/lib/api.js`.** Don't call `fetch` from a page.
3. **Don't change sign-in without talking to Amora.** That means `src/lib/auth.jsx`, `src/lib/api.js` and `src/components/GoogleButton.jsx`.
4. **Leave `backend/` alone,** and leave AWS and Cloudflare to Amora.
5. **Never commit `.env.local`,** passwords, tokens or demo logins.
6. **Don't show made-up numbers as if they were real.** Charts and stats like attendance or progress need real data, which the API doesn't have yet. Recharts was removed for this reason; add it back when there's data for it.
7. **Agree new features with Amora first,** so we don't end up with separate versions again.

## How to work

- **Branch:** work on `frontend-draft-bishu` for now. Run `git pull` before you start each day, and push small commits often.
- **`main`:** don't merge into it. Amora will open the PR once real sign-in has been tested.
- **Shared data:** the live API holds data for the whole team, so don't delete things you didn't create. To work with your own data, [run the backend locally](../backend/README.md) and set `VITE_API_URL=http://localhost:8000`.

**Before each push, check:**

- [ ] `npm run build` succeeds
- [ ] The pages you changed work for each role that can see them
- [ ] They work at phone width, with no sideways scrolling
- [ ] Loading, empty and error states still show properly

## What's been tested

**Works** against a local copy of the API, with all three roles:

- Dashboards, courses, enrolments and announcements
- Modules, plus uploading and downloading files
- Submitting, marking, releasing marks and grades
- Phone layout, invalid sessions and signing out

**Not tested yet:** signing in with a real Google account, and using the live API. Amora is checking these. **If sign-in fails for you, tell Amora.** It's probably not your code.

## Who to ask

| Question | Ask |
| --- | --- |
| Sign-in, users, courses, hosting, what to build next | Amora |
| Files, assignments, grades or announcements in the API | Roshan |
| Design review and feedback | Apeksha |
| Sign-in page, which you share (KAN-57) | Dipesh |

Your tasks are also listed in [docs/task.md](../docs/task.md).
