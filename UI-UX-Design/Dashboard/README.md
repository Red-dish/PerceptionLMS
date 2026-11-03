# Perception LMS: interactive frontend

This is a working, clickable frontend for Perception LMS. It was built from the earlier Canva mockup ([../UI Design.html](../UI%20Design.html)) and the MVP user stories. It is a static site (HTML, CSS and JavaScript) with no build step, so you can host it on any static host or cloud bucket.

## What's in it

| Area | Student | Lecturer | Admin |
|---|---|---|---|
| **Sign in** | Email and password, or **Google SSO** | same | same |
| **Dashboard** | Stats, upcoming deadlines, module progress, study activity chart, latest feedback, announcements | Grading queue, modules taught, quick actions, deadlines | Platform stats, modules overview, people, users by role, quick actions |
| **Modules** | Enrolled subjects, lessons (video, reading, lab, quiz), mark lessons complete, download materials, progress | Add, rename, publish or unpublish and delete modules; add lessons; upload files | Every module; create new modules |
| **Assignments** | Filter by To do, Overdue, Submitted or Graded; drag-and-drop file upload or text entry; integrity check; submission receipt; resubmit; view feedback | Create and edit assignments, see who has submitted, grade with score and feedback | View all |
| **Grades** | Results by module, with feedback | Gradebook grid (students × assignments) | n/a |
| **Announcements** | Read, filter by module | Post, pin, delete | Post college-wide |
| **Admin** | n/a | n/a | Users (add, edit, change role, deactivate), enrolments (assign lecturer, enrol or remove students) |

You also get global search (press `/`), notifications, dark mode, a mobile layout and keyboard access. Changes are saved in the browser, and **Profile → Reset demo data** restores the starting data before a presentation.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Student | `student@perception.demo` | `Student@123` |
| Lecturer | `lecturer@perception.demo` | `Lecturer@123` |
| Admin | `admin@perception.demo` | `Admin@123` |

Each role tab on the sign-in page has a **Fill … login** link that fills these in.

## Run it locally

```bash
cd UI-UX-Design/Dashboard
python3 -m http.server 8080
# open http://localhost:8080
```

## Google SSO

Google sign-in works in one of three modes, set in [`js/config.js`](js/config.js):

| Mode | `googleClientId` | `apiBaseUrl` | What happens |
|---|---|---|---|
| **Demo** (default) | empty | empty | "Continue with Google" opens a simulated account picker. Works offline, so it's good for presentations. |
| **Frontend-only** | set | empty | Real Google sign-in. The app checks the token's audience, issuer, expiry, verified email and optional domain in the browser. `adminEmails` and `lecturerEmails` decide the role. Anyone else gets the role tab selected on the sign-in page. **For demos only:** checks done in the browser can be bypassed. |
| **Production** | set | set | Real Google sign-in. The ID token is posted to the backend's `POST /auth/google` ([backend/app/routers/login.py](../../backend/app/routers/login.py)). The backend verifies Google's signature and returns the user's role and an access token. |

### Set up the Google client ID

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **OAuth consent screen**. Choose *External*, or *Internal* for a Workspace domain, and fill in the app name and support email.
2. Go to **Credentials** → **Create credentials** → **OAuth client ID** → **Web application**.
3. Under **Authorized JavaScript origins**, add every address the site will run from, for example:
   - `https://lms.yourdomain.com`
   - `http://localhost:8080`
   Redirect URIs are not needed, because the app uses the popup flow.
4. Copy the client ID into `js/config.js`:
   ```js
   window.PERCEPTION_CONFIG = {
     googleClientId: '1234567890-abc.apps.googleusercontent.com',
     apiBaseUrl: '',            // or your API Gateway URL in production
     allowedDomain: '',         // e.g. 'asa.edu' to allow only college accounts
     adminEmails: ['you@gmail.com'],
     lecturerEmails: []
   };
   ```
5. **Production only:** use the **same** client ID for the backend's `GOOGLE_CLIENT_ID`, and add your site's address to the backend's `ALLOWED_ORIGINS`.

## Deploy to a cloud domain

Upload the contents of this folder (`index.html`, `css/`, `js/`). The app uses hash routes (`#/dashboard`), so no rewrite rules are needed. Choose one host:

**Netlify (fastest).** Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag this `Dashboard` folder onto the page. To use your own domain, open **Domain settings → Add custom domain** and follow the DNS instructions. Netlify adds HTTPS automatically.

**Vercel**
```bash
cd UI-UX-Design/Dashboard
npx vercel --prod        # accept the defaults; there is no build command
```
Then open **Project → Settings → Domains** to add your domain.

**AWS Amplify Hosting** (same cloud as the backend). Go to **Amplify → Deploy without Git**, zip the folder's contents and upload them. Then add your domain under **Custom domains**. If the domain is in Route 53, Amplify sets up DNS and HTTPS for you.

**AWS S3 + CloudFront**
```bash
aws s3 sync UI-UX-Design/Dashboard s3://YOUR-BUCKET --delete --exclude "README.md"
```
Set up a CloudFront distribution in front of the bucket, with default root object `index.html`, an ACM certificate (us-east-1) and a Route 53 alias record for your domain.

**GitHub Pages.** Repo **Settings → Pages**, deploy from a branch, and serve this folder. You may need to copy it to `/docs` or use a Pages workflow.

After you deploy, add the live HTTPS address to **Authorized JavaScript origins** in Google Cloud. If you don't, real Google sign-in fails with an `origin_mismatch` error.

## Suggested presentation flow (about 5 minutes)

1. **Sign-in page.** Show the role tabs, **Continue with Google** and validation (enter a wrong password).
2. **Student.** Walk through the dashboard, then open **MAI600**: tick off a lesson and watch progress update, then download a material. Open **Assignments → AI Use-Case Proposal**, drag in a file, tick the integrity box, submit and show the receipt.
3. **Sign out, then use Continue with Google → Dr. Maya Chen (lecturer).** Show the grading queue, grade Alex's submission, add a module or lesson, and post an announcement.
4. **Sign out, then sign in as Admin.** Add a user, enrol them in a module and change a module's lecturer.
5. **Sign back in as the student.** The grade, feedback and announcement are now visible.
6. Optionally switch to dark mode, then show the mobile layout by resizing the window or using phone view.

Before you present, use **Profile → Reset demo data**.

## Files

```
index.html       Page shell, fonts and icon library
css/styles.css   Design tokens (light and dark), layout, components
js/config.js     Deployment settings (Google client ID, API URL)
js/data.js       Demo data; dates are relative to today so deadlines always look current
js/app.js        Router, sign-in and SSO, all pages and actions
```

## Connecting to the real backend later

`js/data.js` follows the backend's models: users, courses, modules, materials, assignments, submissions and announcements. When `apiBaseUrl` is set, the API access token is stored in the session (`session.apiToken`). The next step is to replace the reads and writes on `state` in `app.js` with `fetch` calls to the matching endpoints in [backend/README.md](../../backend/README.md).
