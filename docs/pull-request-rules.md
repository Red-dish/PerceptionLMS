# Pull request rules

Every change to this repo goes through a pull request (PR), for both teams, including docs. A PR that breaks these rules is closed or reverted, even after it's merged, so check them before you open one. How branches work is in [branching-workflow.md](branching-workflow.md).

## Before you open a PR

1. **Start from the right branch, and pull first.** Docs, backend and infrastructure start from `dev`. Frontend work starts from `frontend`.
2. **Name your branch** `<type>/KAN-<ticket>-<a-few-words>`, for example `docs/KAN-80-privacy-policy`. Use `feature/`, `fix/` or `docs/`.
3. **Put each file in the right folder** (see below). Don't create new top-level folders.
4. **Keep it to one ticket.** One document or one feature per PR.
5. **Don't commit secrets or junk:** no `.env`, `terraform.tfvars`, `terraform.tfstate*`, `node_modules/`, build output, or personal notes.

## Where files go

| What you're adding | Folder |
| --- | --- |
| Compliance, security, privacy, accessibility and legal docs (policies, DPIA, WCAG audit, terms of use) | `docs/Compliance/` |
| Business case, research, stakeholders, user stories, personas | `docs/Product Management/` |
| Business analyst weekly reports (one file per week, `week-NN-ba-report.md`) | `docs/BA Weekly Reports/` |
| Weekly tasks, system design, build plans | `docs/Product Build/` |
| Roles and team structure | `docs/Teams and Roles/` |
| Wireframes and design mock-ups | `UI-UX-Design/` |
| App screens (React) | `frontend/` |
| API, database and infrastructure | `backend/` |

File names are lowercase with dashes, for example `docs/Compliance/privacy-policy.md`. If nothing fits, ask Amora before making a new folder.

## Opening the PR

- **Base branch:** `dev` for docs, backend and infrastructure; `frontend` for frontend work. GitHub picks `main` by default, so **change it**. PRs into `main` are closed unless Amora opened them.
- **Title:** `KAN-<ticket>: what it does`, for example `KAN-80: Add privacy policy`.
- **Description:** what changed, why, and how to check it. Link the Jira ticket, and the GitHub issue if there is one.
- **Files changed tab:** check every file is in the right folder and nothing extra slipped in.

## Review and merging

| PR | Reviewer | Merged by |
| --- | --- | --- |
| Frontend, into `frontend` | The other frontend developer (Dipesh or Bishu) | The reviewer |
| Backend or infrastructure, into `dev` | The other backend developer (Amora or Roshan) | Amora |
| Docs, into `dev` | Amora | Amora |
| `frontend` → `dev`, `dev` → `main` | Amora | Amora |

- **Don't merge your own PR.** Wait for an approval.
- **Fix review comments on the same branch.** Push more commits rather than opening a new PR.
- **Ticket PRs use "Squash and merge".** Merges between `main`, `dev` and `frontend` use "Create a merge commit". See [branching-workflow.md](branching-workflow.md).
- **Delete the branch** once it's merged.

## If your PR was closed or reverted

Don't open the same PR again unchanged. Read the comment on it, make a new branch from the latest base branch, fix what it says (usually the folder or the base branch), and open a new PR.
