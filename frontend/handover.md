# Frontend handover for Bishu

**From:** Amora · **Updated:** 9 Nov 2026

You lead the frontend: its design, its features, and reviewing Dipesh's and Roshan's frontend work. This page covers what's live, what to design next, and how your changes get onto https://perceptionlms.com. For setup details and the folder layout, see [README.md](README.md).

## Where things stand

- **The app is live at https://perceptionlms.com.** It's the React app in this folder, as it is on `main`.
- **Sign-in works** with a real Google account against the live API, for people an admin has added.
- **Every screen is built and working** for all three roles: dashboards, courses, modules and materials, assignments and marking, grades, people and user admin. What's left is mostly design.

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

### 2. Your features

These are GitHub issues from the v1 plan. Read each issue for what's needed.

| Issue | Feature | Backend |
| --- | --- | --- |
| [#53](https://github.com/Red-dish/PerceptionLMS/issues/53) | Dashboard | `GET /me/dashboard` is ready; extra numbers may need more API |
| [#39](https://github.com/Red-dish/PerceptionLMS/issues/39) | Course navigation menu | Started in `pages/course/CourseLayout.jsx` |
| [#32](https://github.com/Red-dish/PerceptionLMS/issues/32) | User profile and settings | Can read with `GET /me`; people can't edit their own details yet |
| [#36](https://github.com/Red-dish/PerceptionLMS/issues/36) | Pages | No API for this yet: ask Amora before starting |

Dipesh's and Roshan's features are listed in [docs/Teams and Roles/teams.md](../docs/Teams%20and%20Roles/teams.md). As frontend lead, you review their PRs.

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
2. **Commit, push, and open a pull request into `frontend`.** GitHub picks `main` by default, so change the base to `frontend`. Someone else must approve it before it can merge, so ask Dipesh, Roshan or Amora.
3. **When a set of changes is ready to show,** open a pull request from `frontend` into `dev`. Amora reviews it, then moves `dev` into `main`.
4. **Amora publishes `main` to the site.** Message Amora once your work is on `main`. It's usually live the same day.
5. **Check it on https://perceptionlms.com.** If you still see the old version, do a hard refresh (Ctrl+Shift+R).

Only Amora can publish for now, because it needs AWS access. Automatic publishing whenever `main` changes is planned.

**You can always see your changes straight away on http://localhost:5173.** The live site is for showing finished work to the team and our lecturer.

## Rules

1. **Keep it frontend only.** Don't add a server, database or Node API. If a screen needs data the API doesn't offer, ask Amora for an endpoint before building it.
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
| Anything in the API, sign-in, hosting, publishing | Amora |
| Design review and feedback | Apeksha |
| Frontend screens and features | Dipesh and Roshan, whose work you review |

Your tasks are also listed in [docs/task.md](../docs/task.md).
