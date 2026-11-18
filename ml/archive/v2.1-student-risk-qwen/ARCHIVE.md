# Archived: v2.1 student-risk experiments

**Status: superseded on 18 Nov 2026 by requirements v3. Not maintained.** Kept as a record of the approach we tried and why we moved on. See [docs/requirements/v2.1.md](../../../docs/requirements/v2.1.md) for the decisions behind it and [docs/requirements/v3.md](../../../docs/requirements/v3.md) for the current requirements.

**Original location:** `ml/student-risk/`. Paths inside the older files (README.md, plan.md, the scripts) still say `ml/student-risk/`; read them as this folder.

## What's here
| Part | What it is | Who wrote it |
|---|---|---|
| `workflow.py`, `optimize_qwen.py`, `tune_precision.py`, `package_lambda.py`, `benchmark_*.py`, `cpu_runtime.py`, `test_*.py`, `lambda_src/`, `student-risk.ipynb`, `requirements.lock`, `README.md` | Qwen3.5-0.8B fine-tuned with a decision head to predict at risk, with TabICL and logistic regression comparisons, a CPU-only AWS Lambda package and tests. **Trained on 2,000 synthetic students**, before the real CSV was available | A friend of the team, outside the team (credit to be added) |
| `train_at_risk.py`, `at-risk-model/` | Logistic regression trained on the real `ml/dataset/students_demo.csv` (400 students) for Session 4 Task 2. Accuracy 77.5%, at-risk recall 39.1% | Amora, with Claude Code |
| `plan.md` | The v2.1 plan and handover for retraining Qwen on the real CSV. **Never carried out** | Amora, with Claude Code |

## Why it was superseded
Requirements v3 (the *ASA Smart LMS* brief) requires a **Decision Tree baseline and a small MLP**, scoring a five-student demo class, and a **student** chatbot over unit documents. A fine-tuned LLM classifier isn't part of v3. It would also need GPU training and an 8 GB Lambda with a 2.3 GB image, which isn't worth the cost for a five-student demo. The v3 models will live in a new folder, `ml/at-risk/`.

## Not in the repo
The model weights and generated files in `outputs/` (about 1.7 GB) are gitignored and stay on the author's machine. To match a copy later, check these SHA-256 hashes from `outputs/qwen-lambda-image-report.json`:

| File | SHA-256 |
|---|---|
| `model.safetensors` (backbone, about 1.7 GB) | `73428537abbeaf69fbfdf02594a43177c42bd21d3c4be279bc9bb477be3db5ce` |
| `joint_head.safetensors` (decision head, about 55 MB) | `72c0db1cdd310bd5d4f55322db50cd34153ae4b80958aafe15160ee5479b52e8` |
| `qwen-student-risk-lambda-image.tar` (Lambda image, about 2.3 GB) | `174320f3a199253aa1fdf54357859309f48d71c9baf6049a19f8902d68eddb80` |

## Running it
- **Logistic regression** still runs from the repository root: `uv run ml/archive/v2.1-student-risk-qwen/train_at_risk.py` (checked 18 Nov; same results).
- **The Qwen scripts** need the author's GPU environment and the pruned weights, so they won't run as they are. They aren't maintained.
