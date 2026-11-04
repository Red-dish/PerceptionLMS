# Learnly LMS — a Canvas-style Learning Management System

React (Vite + Tailwind + Recharts) frontend · Node/Express API · JSON-file database (no MongoDB needed) · Google SSO (Passport) + email/password + one-click demo logins.

## Features
- **Roles**: student, teacher, admin (admin can change user roles)
- **Dashboard**: Canvas-style course cards, stats, charts, To-Do, announcements
- **Courses**: create/edit/delete, colour & term, catalog with self-enrolment, teacher enrols/removes students
- **Modules & lessons**: collapsible modules, lesson pages with prev/next, lesson editor
- **Course progression**: mark lessons complete, per-course progress bars, "Continue" button
- **Assignments & gradebook**: create assignments, students submit, teacher grades inline, weighted totals
- **Attendance**: teacher creates sessions & marks Present/Late/Absent/Excused (bulk "all present"); students see per-course % and history; <75% flagged red
- **Calendar** of due dates, **People** page, **Users** admin page

## Run locally (Windows / macOS / Linux)
Requires Node.js 18+ (20 LTS recommended).
```powershell
cd lms
npm install              # installs concurrently
npm run install:all      # installs server + client deps
copy server\.env.example server\.env    # (macOS/Linux: cp)
npm run seed             # creates server/data.json with demo data
npm run dev              # API :4000 + web :5173
```
Open http://localhost:5173

Or two terminals: `cd server && npm run dev` and `cd client && npm run dev`.

## Demo logins (password `password123`)
| Role | Email |
|---|---|
| Teacher | teacher@demo.edu (also james@demo.edu) |
| Student | student@demo.edu (Badal Mainali), aisha@demo.edu, liam@demo.edu … |
| Admin | admin@demo.edu |
The login page also has one-click Teacher / Student / Admin buttons. `npm run seed` resets all data.

## Google SSO setup
1. https://console.cloud.google.com → create/select a project.
2. **APIs & Services → OAuth consent screen**: External, fill app name & email, add yourself as a test user.
3. **Credentials → Create credentials → OAuth client ID → Web application**
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:4000/api/auth/google/callback`
4. Put the values in `server/.env`:
   ```
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxx
   GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
   CLIENT_URL=http://localhost:5173
   ```
5. Restart the API. "Continue with Google" now works. New Google users are created as **students**; an admin can promote them to teacher on the Users page. Existing users with the same email are linked.

## Structure
```
server/  index.js (Express API + Passport), db.js (JSON store), seed.js, .env.example
client/  src/pages/* (Dashboard, Courses, Modules, Lesson, Assignments, Grades, Attendance, People, Calendar, Users…)
```
## Switching to MongoDB
All data access is in `server/index.js` against the `db` collections (users, courses, modules, lessons, assignments, submissions, enrollments, sessions, attendance, completions, announcements) — each maps 1:1 to a Mongoose model.
