# Perception LMS frontend

The website for Perception LMS: a React app built with Vite and Tailwind. It has no server or database of its own. All data and sign-in go through the FastAPI backend in [backend/](../backend), and the built site is hosted as static files on S3 behind Cloudflare.

## Run it

You need Node.js 20 or later. Run these from the `frontend` folder.

**First time only:** create your settings file, then add the Google client ID (ask Amora).

```bash
cp .env.example .env.local
```

Then:

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. The port must stay 5173, because Google sign-in and the API only allow that exact address.

**Signing in:** only people an admin has added can sign in, so ask Amora to add your Google account.

**Working on the API too?** Run the backend locally ([backend/README.md](../backend/README.md)) and set `VITE_API_URL=http://localhost:8000` in `.env.local`. Restart `npm run dev` after changing `.env.local`.

## Rules

- **Don't add a server or database here.** If a screen needs data the API doesn't offer, ask Amora or Roshan to add an endpoint.
- **Every API call goes through `src/lib/api.js`.** Don't call `fetch` from a page.
- **Never put a secret in a `VITE_` variable.** They end up in the public website. The Google client ID and API URL aren't secrets.
- **Roles are checked by the API.** Hiding a button in the frontend is only for convenience.
- **Use the API's words:** `lecturer` rather than teacher, and `modules` and `materials` rather than lessons.

## Folders

```
src/
  App.jsx             every page's address, and who can open it
  index.css           Tailwind setup and shared styles such as .card and .btn-primary
  lib/
    api.js            API calls, file uploads and downloads
    auth.jsx          the signed-in user, sign-in and sign-out
    useLoad.js        loading data when a page opens
    format.js         dates and role names
  components/         Layout (navigation), GoogleButton, CourseCard and ui.jsx (small shared pieces)
  pages/
    Login, Dashboard, Courses, Grades, Users
    course/           CourseLayout (the course menu), CourseHome, Modules,
                      Assignments, AssignmentDetail, AssignmentForm, People
```

## Which page uses which endpoint

| Page | Who sees it | Endpoints |
| --- | --- | --- |
| Login | Everyone | `POST /auth/google` |
| Dashboard | Everyone, different for each role | `GET /me/dashboard`, and `GET /admin/users` for admins |
| Courses | Everyone; admins can also create | `GET /courses`, `POST /admin/courses` |
| Course home | Enrolled; lecturers can post | `GET`, `POST` and `DELETE /courses/{id}/announcements` |
| Modules | Enrolled; lecturers can edit | `GET /courses/{id}`, plus modules, materials and downloads |
| Assignments | Enrolled; lecturers can edit | `GET`, `POST` and `PATCH /courses/{id}/assignments` |
| Assignment detail | Students submit; lecturers mark | `…/submission`, `…/submissions`, `…/grade` and `…/download` |
| Grades | Students | `GET /me/grades` |
| People | Admins | `/admin/courses/{id}/members` and `GET /admin/users` |
| Users | Admins | `GET`, `POST` and `PATCH /admin/users` |

The API's full list, with a way to try each endpoint, is at `/docs` on the backend.

**How file uploads work:** the API returns a signed form, and the browser posts the file straight to S3 (`uploadFile` in `src/lib/api.js`). Files can be up to 20 MB.

## Adding a page

1. Create it in `src/pages/`. Use `useLoad` for its data, and `Loading` and `ErrorNote` from `components/ui.jsx`. `pages/Grades.jsx` is a short example.
2. Add its address to `src/App.jsx`.
3. To show it in the navigation, add it to `navItems` in `components/Layout.jsx`, or `tabs` in `pages/course/CourseLayout.jsx` for a course page.

## Not in the API yet

These need backend work first, so they aren't in the app:

- Deleting an assignment or a course, and editing a course
- A course's member list for lecturers (only admins can read it)
- Marking materials as complete, and course progress

Attendance and online quizzes were in the earlier draft, but are on the [Later list](../docs/Product%20Build/tasks.md). The draft is still in git at commit `ee7c2f8`, under `UI-UX-Design/Frontend/`, if you want to reuse its code or design.

## Publishing

Amora publishes for now. From the `frontend` folder, on an up-to-date `main`:

```bash
npm run build
```

```bash
aws s3 sync dist s3://perceptionlms.com --delete
```

The build reads `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` from `.env.local` and puts them in the site, so check them first.
