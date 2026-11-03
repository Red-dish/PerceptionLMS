# Task: backend, sign-in and domain (Amora)

My own checklist for the Week 1 technical work, picking up where my last Claude session left off. The team's full list for the week is in [docs/product build/tasks.md](docs/product%20build/tasks.md) (Jira epic KAN-54, due Fri 6 Nov 2026).

## Done

- [x] Domain **perceptionlms.com** (bought by Nancy) added to Cloudflare, and the registrar's nameservers switched to Cloudflare's.
- [x] Google OAuth client created. Authorized JavaScript origins: `http://localhost:5173`, `https://perceptionlms.com`, `https://www.perceptionlms.com`.
- [x] `backend/.env` created with the real `GOOGLE_CLIENT_ID`, `JWT_SECRET` and `ADMIN_EMAILS` (my email only). It's git-ignored.

## Now: run the backend locally (KAN-41)

Run from `backend/`. **Skip** the `cp .env.example .env` step in the README, because it would overwrite the real `.env`.

- [ ] `uv sync`
- [ ] `podman run -d --name lms-aws -p 5000:5000 docker.io/motoserver/moto:5.2.5` (if it already exists: `podman start lms-aws`)
- [ ] `uv run --env-file .env python scripts/local_setup.py`
- [ ] `uv run --env-file .env uvicorn app.main:app --reload`
- [ ] Open http://localhost:8000/docs and check it loads
- [ ] `uv run pytest` passes
- [ ] Sign in from the frontend on `localhost:5173` with my Google account and confirm I become admin
- [ ] Add a test student and lecturer, enrol them in a course, and check each role sees the right things

## Next: deploy to AWS (KAN-55, with Roshan)

- [ ] AWS CLI signed in (`aws sts get-caller-identity`)
- [ ] Copy `backend/infra/terraform.tfvars.example` to `terraform.tfvars`. Fill in `google_client_id`, `admin_emails`, and `allowed_origins` (`http://localhost:5173`, `https://perceptionlms.com`, `https://www.perceptionlms.com`)
- [ ] `uv run python scripts/deploy.py` and note the API URL it prints
- [ ] Only one person deploys until Terraform state moves to S3 (see `infra/versions.tf`)

## Next: point the domain at the app (KAN-56, with Dipesh)

- [ ] Decide where the frontend is hosted (for example S3 + CloudFront, Amplify or Vercel)
- [ ] In Cloudflare, replace the registrar's two parking A records with records for the frontend host
- [ ] Ask Nancy whether the `www` CNAME (`perception-lms.od...`) was set up on purpose; replace or delete it
- [ ] Give the API a custom domain such as `api.perceptionlms.com`. Terraform doesn't do this yet: it needs an ACM certificate and an API Gateway custom domain
- [ ] Set AWS certificate validation CNAMEs to **DNS only** (gray cloud) in Cloudflare
- [ ] Set Cloudflare SSL/TLS mode to **Full (strict)**

## Housekeeping

- [ ] The docs moved into `docs/product build/`, `docs/product management/` and `docs/teams and roles/`. Update the links in `README.md`, `backend/README.md` and `docs/teams and roles/teams.md` that still point to the old paths
- [ ] Commit the doc moves, `docs/project-outline.md`, this file and `CLAUDE.md` on a branch and open a PR
