# Technical team to-do

The to-do list for the whole technical team: Amora, Roshan, Dipesh and Bishu. Tick items off as they land, in the same PR as the work where you can. The week's deliverables and the business team's tasks are in [Product Build/tasks.md](Product%20Build/tasks.md).

## Current goal

**Week 1, due Fri 6 Nov 2026 (Jira epic KAN-54):** open `https://perceptionlms.com`, sign in with Google, and reach the dashboard for your role: student, staff or admin. The dashboard can use sample data this week; live data comes later (KAN-42).

| Piece | Status (4 Nov 2026) |
| --- | --- |
| Backend API | Live at `https://p4r5x8qd32.execute-api.ap-southeast-2.amazonaws.com/` |
| Website S3 bucket | In Terraform on `main`, not created yet |
| Domain | On Cloudflare, not pointing at the app yet |
| React app | In `frontend/` on `frontend-draft-bishu`, using our API; not on `main` yet |

## Week 1: frontend

The app is in [frontend/](../frontend), and its [README](../frontend/README.md) explains how to run it and add pages. It has no server or database of its own: all data and sign-in go through the FastAPI backend. Tested locally against the API, but not yet with a real Google account or the live API.

- [ ] **Set up the React app** · KAN-64
  - [x] App runs on `http://localhost:5173`
  - [x] API URL and Google client ID come from environment settings, not hard-coded
  - [x] One shared way to call the API with the sign-in token
  - [ ] Works against the live API (Amora)
  - [ ] Merged to `main` (Amora)
- [ ] **Build the sign-in page** · KAN-57
  - [ ] Sign in with a real Google account through `POST /auth/google` (Amora)
  - [ ] Someone an admin hasn't added sees a clear error (Amora)
  - [x] Each role goes to its own dashboard, using `GET /me`
  - [x] An invalid or expired session returns to sign-in
  - [x] Signing out returns to sign-in
- [x] **Build the dashboard** · KAN-58
  - [x] Opens for student, staff and admin
  - [x] Uses live data from `GET /me/dashboard`
- [ ] **Shared layout and visual design** (Bishu) · KAN-65
  - [x] Navigation shared by every page
  - [x] Works at phone width
  - [ ] Final colours, type and page design (Bishu)
  - [ ] Design feedback from Apeksha applied (KAN-66, due Thu 5 Nov) (Bishu)
- [ ] **Frontend features and design** (Bishu); start with [frontend/handover.md](../frontend/handover.md)
  - [ ] Build new screens on `frontend/`, following the rules in its README
  - [ ] Reuse anything useful from the earlier draft, in git at commit `ee7c2f8`
  - [ ] Ask Amora or Roshan for an endpoint when a screen needs data the API doesn't offer

## Week 1: hosting and domain

Hosting is an S3 website behind Cloudflare, with no CloudFront. Amora runs the AWS and Cloudflare steps.

- [ ] Create the website bucket with `terraform apply` from an up-to-date `main` (Amora)
- [ ] Upload a test page and check it loads through the domain (Amora)
- [ ] In Cloudflare, add a Configuration Rule setting SSL to **Flexible** for `perceptionlms.com` only, keeping the default on **Full (strict)** (Amora)
- [ ] In Cloudflare, replace the two parking A records with a proxied CNAME: `perceptionlms.com` → `perceptionlms.com.s3-website-ap-southeast-2.amazonaws.com` (Amora) · KAN-56
- [ ] Build the app and upload `dist/` to the bucket (Amora, Dipesh) · KAN-56
- [ ] `https://perceptionlms.com` opens the sign-in page (Amora, Dipesh) · KAN-56

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
- [ ] Decide what `www.perceptionlms.com` does, once Nancy confirms whether its CNAME was deliberate
- [ ] Turn on `deletion_protection_enabled` before anything is called prod

## Done

- [x] Domain `perceptionlms.com` added to Cloudflare, with the nameservers switched
- [x] Google OAuth client created for `http://localhost:5173`, `https://perceptionlms.com` and `https://www.perceptionlms.com`
- [x] Backend runs locally, with 27 tests passing · KAN-41
- [x] Backend deployed to the AWS `dev` environment; `/health` and `/docs` respond, and `/me` returns 401 without a token · KAN-55
- [x] Hosting decided, and the website bucket added to Terraform (PR #60)
- [x] Docs organised into `Product Build/`, `Product Management/` and `Teams and Roles/`
- [x] PR #25 reverted by PR #59. To bring that code back, revert PR #59: merging `frontend-login-dashboard` again won't restore it

## Rules for everyone

- **Work on a branch and open a PR to `main`.** Start new work from an up-to-date `main`.
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
