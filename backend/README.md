# Perception LMS API

The backend for Perception LMS: a Python 3.14 FastAPI app that runs on AWS Lambda.

- **Sign-in:** Google ("Sign in with Google"). Only people an admin has added can get in.
- **Data:** one DynamoDB table.
- **Files:** course materials and assignment submissions are stored in a private S3 bucket. Browsers upload and download them directly with short-lived signed links.
- **Containers:** Podman builds the Lambda image and runs local stand-ins for DynamoDB and S3.
- **Infrastructure:** Terraform creates everything in AWS.

How it fits together, the table layout and who can do what: [docs/system-design.md](../docs/system-design.md).

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
3. Under **Authorized JavaScript origins**, add `http://localhost:5173` and your deployed frontend address.
4. Copy the client ID. It ends in `.apps.googleusercontent.com`.

## Run it on your computer

All commands run from the `backend` folder.

```bash
uv sync
cp .env.example .env          # then fill in GOOGLE_CLIENT_ID, JWT_SECRET and ADMIN_EMAILS
podman run -d --name lms-aws -p 5000:5000 docker.io/motoserver/moto:5.2.5
uv run --env-file .env python scripts/local_setup.py
uv run --env-file .env uvicorn app.main:app --reload
```

- Open http://localhost:8000/docs to see every endpoint and try them out.
- The `lms-aws` container is an in-memory stand-in for DynamoDB and S3. Its data disappears when the container stops. Run `podman start lms-aws` and `scripts/local_setup.py` again to get it back.
- Sign in from the frontend with the Google account listed in `ADMIN_EMAILS`. It becomes the first admin, who can then add everyone else.

## Run the tests

```bash
uv run pytest
```

The tests use fake AWS services and a fake Google key. They need no internet access, Podman or AWS account.

## Deploy to AWS

1. Copy `infra/terraform.tfvars.example` to `infra/terraform.tfvars` and fill it in.
2. Make sure Podman's machine is running and the AWS CLI is signed in.
3. Run:

   ```bash
   uv run python scripts/deploy.py
   ```

   This creates the image repository, builds the image with Podman and pushes it. It then shows the Terraform plan and asks before creating or changing anything. At the end it prints the API URL.

Run the same command again to deploy new code. To remove everything from a `dev` environment, run `terraform destroy` in `infra/`. A `prod` environment has delete protection on the table and keeps its files.

**Terraform state** is saved in `infra/` on the computer that deployed, and it contains the token-signing secret. Only one person should deploy until the team moves state to S3. The commented `backend "s3"` block in `infra/versions.tf` shows how.

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
