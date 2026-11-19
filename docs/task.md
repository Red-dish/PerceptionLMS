# Technical team to-do

The to-do list for the whole technical team: Amora, Roshan, Dipesh and Bishu. Tick items off as they land, in the same PR as the work where you can. The week's deliverables and the business team's tasks are in [Product Build/tasks.md](Product%20Build/tasks.md).

## Current goal

Deliverables are due **every Wednesday**. Progress reports are due from everyone every other Thursday: **19 Nov**, 3 Dec, 17 Dec.

**Week 3, due Wed 18 Nov 2026 (GitHub milestone "Deliverable 18 Nov"):**

- [x] ~~AI Task 1: explore `students_demo.csv`~~ closed as superseded by v3 on 19 Nov; the dataset is committed in `ml/dataset/` (Amora) · #119 · KAN-82
- [ ] **v3 Feature B:** Decision Tree + MLP, risk API and lecturer view; ML and API by Wed 25 Nov (Amora) · #120 · KAN-83
- [ ] **v3 Feature A:** student chatbot grounded in unit documents; provider chosen by 25 Nov, done by Thu 3 Dec (Amora) · #123 · KAN-86
- [ ] **v3 demo:** MAI600 seed data by 25 Nov; demo sign-in by 3 Dec (Amora) · #143 · KAN-117
- [ ] **Requirements v3 (18 Nov):** plan the ASA Smart LMS brief: student chatbot, Decision Tree + MLP risk labels, demo sign-in and a five-student MAI600 class. Draft in [ai-features-plan.md](Product%20Build/ai-features-plan.md); version history in [requirements/](requirements/README.md). The `test-student` idea is replaced; v2.1 code archived in `ml/archive/v2.1-student-risk-qwen/`. Checkpoint Wed 25 Nov, final demo Thu 3 Dec (Amora)
- [x] Quiz builder backend, handed over to Dipesh and Bishu (Roshan, PR #129, merged 16 Nov) · #47 · KAN-92. Frontend (19 Nov): Bishu's design is done; Dipesh hasn't wired it to the API yet, due 25 Nov. KAN-92 and KAN-93 are now assigned to Dipesh
- [x] Quiz taking and auto-grading backend, handed over (Roshan, PR #130, merged 16 Nov) · #48 · KAN-93
- [ ] Deploy the coursework and quiz API: PR #85 (gradebook, CSV, files, late work) and PRs #129 and #130 (quizzes) are merged on `dev` and 61 tests pass, but none of it is live yet (Amora) · KAN-72
- [ ] Bring `dev` into `frontend` (PR `dev` → `frontend`) so Dipesh and Bishu have the quiz API and the new handover (Amora). Checked 17 Nov: it changes nothing under `frontend/`, so it's safe

**Week 4, due Wed 25 Nov:** everything else open on the epics. Dipesh and Bishu build the screens for the gradebook (#49), CSV (#51), files (#37) and quizzes; Roshan builds the remaining backend (pages, rubrics, discussions, inbox, calendar, notifications); Amora builds profile (#32) and the v3 AI work (#120, #123, #143). Recommendations (#124) are dropped in v3. Gradebook and CSV (KAN-94, KAN-95) are back to In Progress: no frontend PR yet.

**How work flows now (from 15 Nov):** Roshan builds the APIs and hands each one to Dipesh and Bishu, who design and build the screens together and review each other's PRs. Bishu is no longer frontend lead. Amora builds the AI features and profile, and oversees the project. See [teams.md](Teams%20and%20Roles/teams.md). Jira now mirrors the GitHub epics (KAN-76 to KAN-81). The full list is in [Product Build/tasks.md](Product%20Build/tasks.md).

Week 1 (sign-in, roles and dashboard, KAN-54) is done; its items are below.

| Piece | Status (10 Nov 2026) |
| --- | --- |
| Backend API | Live at `https://p4r5x8qd32.execute-api.ap-southeast-2.amazonaws.com/`. Roshan's coursework API (PR #85) and quiz API (PRs #129, #130) aren't deployed yet (checked 17 Nov) |
| Website S3 bucket | Created |
| Domain | `https://perceptionlms.com` is live; `www` redirects to it |
| React app | Published to `https://perceptionlms.com` from `main`, and works with a real Google account against the live API |

Amora built everything in the app so far, apart from Roshan's coursework backend (PR #85). See "Who has built what so far" in [teams.md](Teams%20and%20Roles/teams.md).

## Week 1: frontend

The app is in [frontend/](../frontend), and its [README](../frontend/README.md) explains how to run it and add pages. It has no server or database of its own: all data and sign-in go through the FastAPI backend. Tested with a real Google account against the live API.

- [x] **Set up the React app** · KAN-64
  - [x] App runs on `http://localhost:5173`
  - [x] API URL and Google client ID come from environment settings, not hard-coded
  - [x] One shared way to call the API with the sign-in token
  - [x] Works against the live API (Amora)
  - [x] Merged to `main` (Amora)
- [x] **Build the sign-in page** · KAN-57
  - [x] Sign in with a real Google account through `POST /auth/google` (Amora)
  - [x] Someone an admin hasn't added sees a clear error (Amora)
  - [x] Each role goes to its own dashboard, using `GET /me`
  - [x] An invalid or expired session returns to sign-in
  - [x] Signing out returns to sign-in
- [x] **Build the dashboard** · KAN-58
  - [x] Opens for student, staff and admin
  - [x] Uses live data from `GET /me/dashboard`
- [ ] **Shared layout and visual design** (Bishu) · KAN-65. Not started yet
  - [x] Navigation shared by every page (Amora)
  - [x] Works at phone width (Amora)
  - [ ] Final colours, type and page design (Bishu)
  - [ ] Design feedback from Apeksha applied (KAN-66, due Thu 5 Nov) (Bishu)
- [ ] **New screens** (Dipesh and Bishu design and build together); start with [frontend/handover.md](../frontend/handover.md). #44 grading view is done (PR #97); next up, all due Wed 25 Nov: gradebook #49, CSV #51, quiz builder #47, quiz taking #48 and files #37. The quiz API is ready (PRs #129, #130), with a clickable mock-up in `UI-UX-Design/Quizzes-Gradebook/index.html`
  - [ ] Build new screens on `frontend/`, following the rules in its README
  - [ ] Reuse anything useful from the earlier draft, in git at commit `ee7c2f8`
  - [ ] Ask Amora or Roshan for an endpoint when a screen needs data the API doesn't offer

## Week 1: hosting and domain

Hosting is an S3 website behind Cloudflare, with no CloudFront. Amora runs the AWS and Cloudflare steps.

- [x] Create the website bucket with `terraform apply` from an up-to-date `main` (Amora)
- [x] Upload a test page and check it loads through the domain (Amora)
- [x] In Cloudflare, add a Configuration Rule setting SSL to **Flexible** for `perceptionlms.com` only, keeping the default on **Full (strict)** (Amora)
- [x] In Cloudflare, replace the two parking A records with a proxied CNAME: `perceptionlms.com` → `perceptionlms.com.s3-website-ap-southeast-2.amazonaws.com` (Amora) · KAN-56
- [x] Build the app and upload `dist/` to the bucket (Amora) · KAN-56
- [x] `https://perceptionlms.com` opens the sign-in page (Amora) · KAN-56

## Week 1: testing

- [ ] Admin signs in on the live site and adds a test student and lecturer (Amora) · KAN-41
- [ ] Enrol them in a test course (Amora) · KAN-41
- [ ] Each role reaches only what it should (Amora, Dipesh, Bishu) · KAN-41
- [ ] An account nobody has added is refused (Amora) · KAN-41
- [ ] Confirm the backend saves data to DynamoDB through the live site (Roshan, Amora) · KAN-55

## After Week 1

- [ ] Connect the dashboard to live data with `GET /me/dashboard` · KAN-42
- [ ] Automatic publishing with GitHub Actions when `main` changes
- [ ] Move Terraform state to S3 so more than one person can deploy; see `backend/infra/versions.tf`
- [ ] Give the API a custom domain such as `api.perceptionlms.com`, with an ACM certificate. Its validation CNAMEs must be **DNS only** (grey cloud) in Cloudflare
- [x] `www.perceptionlms.com` redirects to `perceptionlms.com` (301); its old CNAME wasn't deliberate
- [ ] Turn on `deletion_protection_enabled` before anything is called prod

## Done

- [x] Domain `perceptionlms.com` added to Cloudflare, with the nameservers switched
- [x] Google OAuth client created for `http://localhost:5173`, `https://perceptionlms.com` and `https://www.perceptionlms.com`
- [x] Backend runs locally, with 27 tests passing · KAN-41
- [x] Backend deployed to the AWS `dev` environment; `/health` and `/docs` respond, and `/me` returns 401 without a token · KAN-55
- [x] Hosting decided, and the website bucket added to Terraform (PR #60)
- [x] Docs organised into `Product Build/`, `Product Management/` and `Teams and Roles/`
- [x] Coursework backend: files, late and missing work, resubmissions and extensions, gradebook and CSV export, scheduled announcements, with 48 tests passing (Roshan, PR #85). Merged into `frontend`; not deployed yet
- [x] Quiz builder and quiz taking backend, with auto-marking and scores feeding the gradebook; 61 tests pass (Roshan, PRs #129 and #130, 16 Nov). On `dev`; not on `frontend` or deployed yet
- [x] WCAG 2.2 accessibility audit (Yogesh, PR #131) and DPIA link fix (PR #132), 16 Nov
- [x] PR #25 reverted by PR #59. To bring that code back, revert PR #59: merging `frontend-login-dashboard` again won't restore it

## Rules for everyone

- **Work on a branch and open a PR,** following [branching-workflow.md](branching-workflow.md): frontend work into `frontend`, and backend, infrastructure and docs into `dev`. Only `dev` merges into `main`. Check [pull-request-rules.md](pull-request-rules.md) before opening a PR, including which folder your files go in.
- **Never commit secrets:** `backend/.env`, `backend/infra/terraform.tfvars` or `terraform.tfstate*`. The Google client ID isn't secret, so it's safe to share.
- **Never make the private files bucket public.** It holds student submissions. Only the separate `perceptionlms.com` bucket serves the website.
- **Only Amora runs Terraform and deploys for now,** because Terraform state is on one machine. Run it from an up-to-date `main`: on an older branch, it could try to delete resources that branch doesn't know about.
- **Google origins and `allowed_origins` must match exactly:** `https://`, no trailing slash, and `www` counts separately.

## Setup problems we've already solved

Full setup steps are in [backend/README.md](../backend/README.md).

- **Podman machine won't start on Windows:** run `wsl --update`. It needs WSL 3.0 or later.
- **"Expected pipe is not available":** a failed start can leave `win-sshproxy` running. Stop that process and try again.
- **`ConnectionClosedError` from the local AWS stand-in:** set `AWS_ENDPOINT_URL` to `http://127.0.0.1:5000`, not `localhost`.
- **Local data has gone:** the `lms-aws` container keeps data in memory. Run `podman start lms-aws`, then `scripts/local_setup.py`.
- **Don't run `cp .env.example .env`** if you already have a `.env`. It replaces your real values.
