# Branching workflow

How code gets from your laptop to the live site. Short version: **never commit straight to `main`, `dev` or `frontend`.** Make a branch for each Jira ticket and open a pull request (PR).

## The branches

| Branch | What it's for | Who merges into it |
| --- | --- | --- |
| `main` | What's live. Only updated from `dev`, once per weekly deliverable | Amora |
| `dev` | Frontend and backend together, tested before going live | Amora |
| `frontend` | All frontend work, before it goes to `dev` | Bishu (frontend lead) |
| `feature/…`, `fix/…`, `docs/…` | One ticket each. Short-lived: deleted once merged | Nobody: you open a PR from it |

```
feature/KAN-12-login-page      ─┐
feature/KAN-15-course-page     ─┼─► frontend ─┐
fix/KAN-20-upload-error        ─┘             ├─► dev ──► main
                                              │
feature/KAN-18-grades-api      ───────────────┘
```

- **Frontend work** (anything in `frontend/`) branches off `frontend` and goes back into `frontend`.
- **Backend and infrastructure work** (anything in `backend/`, including Terraform) branches off `dev` and goes back into `dev`.
- **Docs** branch off `dev` and go back into `dev`.

## Naming your branch

`<type>/KAN-<ticket number>-<a-few-words>`, all lowercase with dashes.

| Type | Use it for | Example |
| --- | --- | --- |
| `feature/` | Something new | `feature/KAN-12-login-page` |
| `fix/` | A bug | `fix/KAN-20-upload-error` |
| `docs/` | Documentation only | `docs/KAN-25-api-guide` |

Don't start a branch name with `frontend/`: git can't have a branch called `frontend` and one called `frontend/something` at the same time.

## Doing a piece of work

**1. Start from the latest code.** For frontend work:

```bash
git switch frontend
```

```bash
git pull
```

```bash
git switch -c feature/KAN-12-login-page
```

For backend, infrastructure or docs work, use `dev` instead of `frontend` in the first command.

**2. Commit as you go,** and push your branch:

```bash
git push -u origin feature/KAN-12-login-page
```

**3. Open a PR on GitHub.** Set the base branch to `frontend` for frontend work, or `dev` for everything else. GitHub picks `main` by default, so check it. Put the Jira ticket number in the title, for example "KAN-12: Login page".

**4. Get it reviewed.** Frontend PRs need Bishu's approval; backend PRs need Amora's or Roshan's. Fix anything they ask for by pushing more commits to the same branch.

**5. Merge with "Squash and merge",** so each ticket becomes one commit. Then delete the branch (GitHub offers a button).

## Moving work up

| From → to | When | Who opens the PR | Merge style |
| --- | --- | --- | --- |
| `frontend` → `dev` | A set of screens works end to end | Bishu | "Create a merge commit" |
| `dev` → `frontend` | Backend changes the frontend needs have landed on `dev` | Bishu or Amora | "Create a merge commit" |
| `dev` → `main` | Once per weekly deliverable, after testing | Amora | "Create a merge commit" |

Use merge commits rather than squashing between `main`, `dev` and `frontend`. Squashing there makes git think the branches have different histories, and the next PR shows old changes again.

Keep `frontend` close to `dev`: merge `dev` into it at least once a week, so the frontend is always built against the latest API.

## Frontend developers don't need anything deployed

You work on your own machine with `npm run dev` (see [frontend/README.md](../frontend/README.md)). The S3 hosting is only for the published site. To use the API:

- **Backend running locally:** set `VITE_API_URL=http://localhost:8000` in `frontend/.env.local`.
- **Endpoint doesn't exist yet:** check the backend's `/docs` page for the request and response shapes, and ask Amora or Roshan for the endpoint. Don't build a server inside `frontend/`.

## Rules

- **No direct commits to `main`, `dev` or `frontend`.** Everything goes through a PR, including the leads' work.
- **One ticket per branch and per PR.** Small PRs get reviewed faster.
- **Don't put backend changes on a frontend branch,** or the other way round. If a ticket needs both, make two branches and two PRs, backend first.
- **Pull before you start, and before you open a PR.** If your PR shows a conflict, merge the base branch into yours (`git merge origin/frontend` or `git merge origin/dev`), fix the conflict, and push.
- **Delete branches once they're merged.**

## If you had the old branches

`frontend-draft-bishu` was renamed to `frontend`, and `frontend-old` and `frontend-draft` were removed. If you have any of them locally, run:

```bash
git fetch origin --prune
```

```bash
git branch -m frontend-draft-bishu frontend
```

```bash
git branch -u origin/frontend frontend
```

If you had work on `frontend-old` or `frontend-draft` that never got merged, don't delete your local copy: move it to a `feature/` branch and open a PR into `frontend`. The earlier frontend draft is still in git at commit `ee7c2f8`.
