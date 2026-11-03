# Perception LMS API

The backend for Perception LMS: a Python 3.14 FastAPI app that runs on AWS Lambda.

- **Sign-in:** Google ("Sign in with Google"). Only people an admin has added can get in.
- **Data:** one DynamoDB table.
- **Files:** course materials and assignment submissions are stored in a private S3 bucket. Browsers upload and download them directly with short-lived signed links.
- **Containers:** Podman builds the Lambda image and runs local stand-ins for DynamoDB and S3.
- **Infrastructure:** Terraform creates everything in AWS.

How it fits together, the table layout and who can do what: [system-design.md](../docs/Product%20Build/system-design.md).

## What you need

| Tool | Install (Windows) | Check |
| --- | --- | --- |
| uv (Python 3.14 and packages) | `winget install astral-sh.uv` | `uv --version` |
| Podman | `winget install RedHat.Podman`, then `podman machine init` and `podman machine start` | `podman info` |
| Terraform 1.10+ | `winget install Hashicorp.Terraform` | `terraform version` |
| AWS CLI v2 (deploying only) | `winget install Amazon.AWSCLI`, then `aws configure` or `aws sso login` | `aws sts get-caller-identity` |

You also need a **Google OAuth client ID**:

1. In [Google Cloud console](https://console.cloud.google.com/apis/credentials), create a project.
2. Go to **APIs & Services › Credentials › Create credentials › OAuth client ID**, with type **Web application**.
3. Under **Authorized JavaScript origins**, add `http://localhost:5173`, `https://perceptionlms.com` and `https://www.perceptionlms.com`. Each must be an exact match: `https://` for the real site, no trailing slash and no path. These are frontend addresses, so the API's address doesn't go here.
4. Copy the client ID. It ends in `.apps.googleusercontent.com`.

## Run it on your computer

All commands run from the `backend` folder.

**First time only:** create your `.env` from the template, then fill in `GOOGLE_CLIENT_ID`, `JWT_SECRET` and `ADMIN_EMAILS`. Skip this if you already have a `.env`, because copying again replaces your real values with the blank template.

```bash
cp .env.example .env
```

Then:

```bash
uv sync
podman run -d --name lms-aws -p 5000:5000 docker.io/motoserver/moto:5.2.5
uv run --env-file .env python scripts/local_setup.py
uv run --env-file .env uvicorn app.main:app --reload
```

- Open http://localhost:8000/docs to see every endpoint and try them out.
- `.env` is git-ignored, so your secrets stay on your computer. Never put real values in `.env.example`, because that file is committed.
- The `lms-aws` container is an in-memory stand-in for DynamoDB and S3. Its data disappears when the container stops. Run `podman start lms-aws` and `scripts/local_setup.py` again to get it back. `podman run` only works the first time; after that it fails with "name already in use", so use `podman start lms-aws`.
- Sign in from the frontend with the Google account listed in `ADMIN_EMAILS`. It becomes the first admin, who can then add everyone else.

## Run the tests

```bash
uv run pytest
```

The tests use fake AWS services and a fake Google key. They need no internet access, Podman or AWS account.

## Deploy to AWS

1. Copy `infra/terraform.tfvars.example` to `infra/terraform.tfvars` and fill it in. Set `allowed_origins` to every frontend address: `["http://localhost:5173", "https://perceptionlms.com", "https://www.perceptionlms.com"]`. Like `.env`, `terraform.tfvars` is git-ignored.
2. Make sure Podman's machine is running and the AWS CLI is signed in.
3. Run:

   ```bash
   uv run python scripts/deploy.py
   ```

   This creates the image repository, builds the image with Podman and pushes it. It then shows the Terraform plan and asks before creating or changing anything. At the end it prints the API URL.

Run the same command again to deploy new code. To remove everything from a `dev` environment, run `terraform destroy` in `infra/`. A `prod` environment has delete protection on the table and keeps its files.

**Terraform state** is saved in `infra/` on the computer that deployed, and it contains the token-signing secret. Only one person should deploy until the team moves state to S3. The commented `backend "s3"` block in `infra/versions.tf` shows how.

**Domain:** the site lives at `perceptionlms.com`, with DNS in Cloudflare. Terraform doesn't give the API a custom domain such as `api.perceptionlms.com` yet; for now, use the API URL that `deploy.py` prints. When you add one, set the AWS certificate validation records in Cloudflare to **DNS only** (gray cloud), or validation fails.

## Signing in from the frontend

```html
<script src="https://accounts.google.com/gsi/client" async></script>
<div id="g_id_onload" data-client_id="YOUR_CLIENT_ID" data-callback="onGoogleSignIn"></div>
<div class="g_id_signin" data-type="standard"></div>
<script>
  async function onGoogleSignIn({ credential }) {
    const response = await fetch(`${API_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    const { access_token, user } = await response.json();
    // Send "Authorization: Bearer <access_token>" on every other request.
    // The token lasts 8 hours; sign in again after that.
  }
</script>
```

**Uploading a file** happens in two steps. First call the API, for example `POST /courses/{id}/modules/{id}/materials`. It returns `upload.url` and `upload.fields`. Then POST the file straight to S3 as `multipart/form-data`: add every entry in `fields` first, then the file as `file`. Files can be up to 20 MB.

## Endpoints

| Area | Endpoints | Who |
| --- | --- | --- |
| Sign-in | `POST /auth/google` | Anyone with an account |
| Me | `GET /me`, `GET /me/dashboard`, `GET /me/grades` | Signed in |
| Users | `GET/POST /admin/users`, `PATCH /admin/users/{id}` | Admin |
| Courses and enrolments | `GET/POST /admin/courses`, `GET /admin/courses/{id}/members`, `PUT/DELETE /admin/courses/{id}/members/{userId}` | Admin |
| Course content | `GET /courses`, `GET /courses/{id}`, `POST/PATCH/DELETE …/modules`, `POST/DELETE …/materials`, `GET …/materials/{id}/download` | Enrolled (changes: lecturer) |
| Assignments | `GET/POST /courses/{id}/assignments`, `GET/PATCH …/{assignmentId}` | Enrolled (changes: lecturer) |
| Submissions | `POST …/{assignmentId}/submission` (student), `GET …/submissions`, `PUT …/submissions/{studentId}/grade` (lecturer), `GET …/submissions/{studentId}/download` | As shown |
| Announcements | `GET/POST /courses/{id}/announcements`, `DELETE …/{announcementId}` | Enrolled (changes: lecturer) |

## Folder layout

```
app/
  main.py          FastAPI app and the Lambda handler
  config.py        settings from environment variables
  auth.py          Google sign-in, session tokens, admin check
  access.py        course roles: who can see and change a course
  db.py            DynamoDB keys and helpers
  storage.py       S3 signed upload and download links
  models.py        request and response shapes
  routers/         one file per area of the API
tests/             pytest tests with fake AWS and Google
scripts/           local_setup.py (local table and bucket), deploy.py (Podman + Terraform)
infra/             Terraform for AWS
Containerfile      the Lambda image Podman builds
```
