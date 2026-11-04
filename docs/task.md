# Task: backend, sign-in and domain (Amora)

My own checklist for the Week 1 technical work, picking up where my last Claude session left off. The team's full list for the week is in [Product Build/tasks.md](Product%20Build/tasks.md) (Jira epic KAN-54, due Fri 6 Nov 2026).

## Done

- [x] Domain **perceptionlms.com** (bought by Nancy) added to Cloudflare, and the registrar's nameservers switched to Cloudflare's.
- [x] Google OAuth client created. Authorized JavaScript origins: `http://localhost:5173`, `https://perceptionlms.com`, `https://www.perceptionlms.com`.
- [x] `backend/.env` created with the real `GOOGLE_CLIENT_ID`, `JWT_SECRET` and `ADMIN_EMAILS` (my email only). It's git-ignored.

## Done: run the backend locally (KAN-41)

The backend runs locally end to end. Full write-up, including the two environment
blockers and how to restart everything: [Tracking/handover.md](Tracking/handover.md).

Run from `backend/`. **Skip** the README's first-time `cp .env.example .env` step, because it would overwrite the real `.env`.

- [x] `uv sync`
- [x] `podman run -d --name lms-aws -p 5000:5000 docker.io/motoserver/moto:5.2.5` (if it already exists: `podman start lms-aws`)
- [x] `uv run --env-file .env python scripts/local_setup.py` — created table `perception-lms-local` and bucket `perception-lms-local-files`
- [x] `uv run --env-file .env uvicorn app.main:app --reload`
- [x] Open http://localhost:8000/docs and check it loads — 200, all 25 endpoints registered, `/health` returns `{"status":"ok"}`
- [x] `uv run pytest` passes — 27 passed

Blocked on the frontend (no React app in this repo yet, so there is nothing to sign in from):

- [ ] Sign in from the frontend on `localhost:5173` with my Google account and confirm I become admin
- [ ] Add a test student and lecturer, enrol them in a course, and check each role sees the right things

Two environment problems had to be fixed to get here, both done:
- Podman's machine would not start on WSL 2.4.13 (systemd could not boot, so sshd never
  started). Fixed by `wsl --update` to 3.0.3 (kernel 6.18). Podman was also reinstalled
  to clear a stuck machine and an orphaned `win-sshproxy` holding the pipe.
- `AWS_ENDPOINT_URL` must be `http://127.0.0.1:5000`, **not** `localhost`. On Windows
  `localhost` can resolve to IPv6 (`::1`), which Podman's forwarding does not serve, and
  boto3 fails with `ConnectionClosedError`. `.env.example` now says this too.
- `backend/.env` was missing 7 of the 10 variables the app needs; the AWS and table
  values were appended (the three real secrets were left untouched).

## Done: deploy to AWS (KAN-55, with Roshan)

Deployed to the **dev** environment in `ap-southeast-2` on 4 Nov 2026 with
`uv run python scripts/deploy.py`. 22 resources created. Details and the live checks:
[Tracking/handover.md](Tracking/handover.md).

- [x] AWS CLI signed in (`aws sts get-caller-identity`)
- [x] Copy `backend/infra/terraform.tfvars.example` to `terraform.tfvars`. Fill in `google_client_id`, `admin_emails`, and `allowed_origins` (`http://localhost:5173`, `https://perceptionlms.com`, `https://www.perceptionlms.com`)
- [x] `uv run python scripts/deploy.py` and note the API URL it prints
- [x] Only one person deploys until Terraform state moves to S3 (see `infra/versions.tf`)

**API URL:** `https://p4r5x8qd32.execute-api.ap-southeast-2.amazonaws.com/`

Verified live: `/health` returns `{"status":"ok"}`, `/docs` returns 200, and `/me` and
`/admin/users` return 401 without a token.

What was created (all prefixed `perception-lms-dev`): Lambda `perception-lms-dev-api`
(container image, 512 MB, 15 s timeout), API Gateway HTTP API, DynamoDB table
`perception-lms-dev-data` (on-demand, point-in-time recovery on), the private S3 files
bucket, the ECR repository, and the IAM role and CloudWatch log group.

Still to sort out:

- [ ] **Terraform state is local to my machine and holds the JWT signing secret.** It is
      git-ignored, but only I can deploy until it moves to S3 (`infra/versions.tf` has the
      commented `backend "s3"` block). Worth doing before anyone else needs to deploy.
- [ ] `deletion_protection_enabled` is **false** on the dev table. Fine for dev; must be
      on for prod.
- [ ] Add the API URL to the frontend config once the React app exists.

## Next: point the domain at the app (KAN-56, with Dipesh)

- [x] Decide where the frontend is hosted: **S3 static website behind Cloudflare, no CloudFront** (decided by Amora, 4 Nov 2026; nothing built yet)
- [x] Add the frontend bucket to Terraform: a **new, separate** bucket named exactly `perceptionlms.com`, with static website hosting (index and error document both `index.html`), readable only from Cloudflare's IPv4 ranges. `terraform plan` shows 5 to add, 0 to change, 0 to destroy. **Never** make the private files bucket public: it holds student submissions
- [ ] Create the bucket in AWS: run `terraform apply` in `backend/infra/` (not applied yet)
- [ ] Build the React app and upload `dist/` to that bucket
- [ ] In Cloudflare, replace the registrar's two parking A records with a proxied CNAME: `perceptionlms.com` → `perceptionlms.com.s3-website-ap-southeast-2.amazonaws.com`
- [ ] Ask Nancy whether the `www` CNAME (`perception-lms.od...`) was set up on purpose; if not, replace it with a redirect from `www` to `perceptionlms.com`
- [ ] Give the API a custom domain such as `api.perceptionlms.com`. It is currently on the
      raw URL `https://p4r5x8qd32.execute-api.ap-southeast-2.amazonaws.com/`. Terraform
      doesn't do this yet: it needs an ACM certificate and an API Gateway custom domain
- [ ] Set AWS certificate validation CNAMEs to **DNS only** (gray cloud) in Cloudflare
- [ ] Set Cloudflare SSL/TLS: **Full (strict)** by default, plus a Configuration Rule setting **Flexible** for `perceptionlms.com` only, because S3 website endpoints only speak HTTP

## Housekeeping

- [x] The docs moved into `docs/Product Build/`, `docs/Product Management/` and `docs/Teams and Roles/`. Links in `README.md`, `backend/README.md`, `teams.md` and `system-design.md` now point to the new paths
- [ ] Commit the doc moves, `docs/project-outline.md`, this file, `CLAUDE.md`,
      `docs/Tracking/handover.md` and the `backend/.env.example` +
      `backend/scripts/local_setup.py` fixes on a branch and open a PR
- [x] Reverted all of PR #25 (the frontend in `UI-UX-Design/Dashboard/` and `.github/workflows/deploy-frontend.yml`) with [PR #59](https://github.com/Red-dish/PerceptionLMS/pull/59), merged 4 Nov 2026 as `b6db53f`. `main` now matches `44b7a95`, the commit before PR #25. Its deploy to GitHub Pages had failed because Pages is not enabled on the repo. To bring the frontend back later, revert PR #59: merging `frontend-login-dashboard` again will not restore it
