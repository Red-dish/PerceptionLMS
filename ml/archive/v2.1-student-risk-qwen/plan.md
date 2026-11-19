# Student at-risk prediction: plan and handover

> **Superseded on 18 Nov 2026. Don't start section 6 (Qwen retraining).** The lecturer issued a new brief (requirements v3): risk labels must come from a **Decision Tree and a small MLP**, scoring a five-student demo class, and the chatbot is a **student** chatbot over unit documents. Qwen is no longer needed. See `docs/requirements/v3.md` and `docs/Product Build/ai-features-plan.md`. This folder is archived at `ml/archive/v2.1-student-risk-qwen/` (see `ARCHIVE.md`). The text below is kept as a record of the v2.1 decisions.

**Updated:** 18 Nov 2026 · **Owner:** Amora · **Qwen retraining:** you (the outside contributor who built this folder)

This document has two jobs:
1. **A handover for you.** It explains the course requirement and the website, what has changed since you built the Qwen model, and exactly what we need from you next (section 6). You don't need access to GitHub or the course pages; everything you need is here or comes with this folder.
2. **A plan for Amora to review.** It records the decisions made and the build order (sections 4, 5, 7 and 8).

---

## 1. Background

### The project
We are building **Perception LMS**, a learning management system (like a small Canvas or Moodle) for a college, as a university team project.
- **Website:** React, hosted on AWS (S3).
- **API:** Python 3.14 (FastAPI) running on **AWS Lambda** as a container image (x86_64, stored in Amazon ECR), behind **API Gateway**. Data lives in **DynamoDB**. Region: **Sydney (`ap-southeast-2`)**.
- **Users:** admins, lecturers and students, who sign in with Google. Only people an admin has added can sign in.
- **Deploying:** Amora builds images with Podman and deploys with Terraform.

### The lecturer's requirement
In Session 4 the lecturer asked us to make the LMS smarter with AI: **lecturers should be able to see which students may be struggling**, so they can offer support. Later features (a course chatbot and study recommendations) are not part of this work.

**Task 2 from the brief**, word for word:

> **Test Your Model**
> After creating the program:
> 1. Run the Python program.
> 2. Check whether the model was trained successfully.
> 3. Find the accuracy score.
> 4. Test the model using one new fictional student.
>
> **Questions**
> 1. What is the name of the Machine Learning algorithm?
> 2. What does training a model mean?
> 3. What is the difference between training data and testing data?
> 4. What accuracy did your model achieve?
>
> **Expected Outcome**
> You have trained and saved your first Machine Learning model using student data.
> You can explain what the model predicts and how its accuracy was measured.

Our own team requirements on top of the brief:
- An at-risk view for each course, visible to **lecturers and admins only**, never to students.
- Each student's risk comes with its **main reasons** (for example "low quiz average, missed assignments").
- The wording is a **prompt to offer support, not a judgement** of the student.
- It works on the **live website** by the end of development, so the models must run on **AWS Lambda**, not on anyone's laptop.

### The dataset
`ml/dataset/students_demo.csv`, provided by the lecturer. It is now available, so you no longer need synthetic data.
- **400 fictional students**, `S001` to `S400`, named "Demo Student 001" and so on. **114 are at risk (28.5%).**
- **Columns:** `student_id, student_name, attendance_pct, quiz_average, missed_assignments, weekly_logins, days_since_login, at_risk`
- **SHA-256:** `da4c1caa976ed98822388b2673ea9ff107df0194c03ae7b395421b88ed1c5b65`. Amora sends you the file; check the hash before training.
- It passes your `workflow.py` `load()` checks: same five features and a 0/1 label.

## 2. What you built (reviewed 18 Nov)
- A fine-tuned **Qwen3.5-0.8B** (rank-16 LoRA, 3 epochs) with a decision head. **Trained on 2,000 synthetic students**, because the real CSV wasn't available then.
- **On your synthetic test set:** 83.3% accuracy; your logistic regression baseline reached 84.7%.
- **A CPU-only Lambda package** (`outputs/qwen-lambda-package/`, 2.3 GB image), smoke-tested in a local container. It is not deployed or connected to the LMS.
- **Not supported by our backend:** the `/analytics/student-risk-demo` endpoint your README mentions doesn't exist on our side.

It's solid engineering and the Lambda packaging saves us a lot of work. Two things have to change: it must be **retrained on the real CSV**, and the packaging script must handle that new run (section 6).

## 3. What Amora has done since
- **Logistic regression trained on the real CSV:** `train_at_risk.py` (run with `uv run ml/student-risk/train_at_risk.py`).
  - **Split:** 320 to train and 80 to test, stratified, seed 42. **Results:** accuracy 77.5%, precision 69.2%, recall 39.1%; 5-fold cross-validation accuracy 79.0% (± 4.0%).
  - **Saved to** `at-risk-model/`: `at_risk_model.joblib`, plus `at_risk_model.json` with the weights and scaler, so the API can predict without scikit-learn.
  - **One new fictional student** (58% attendance, quiz average 47, 3 missed assignments, 2 logins a week, 9 days since last login) scores **92.1% at risk**. Main reasons: missed assignments, quiz average, weekly logins.
- **Open:** switching to `class_weight="balanced"` raises recall to 78.3%. Precision drops to 60.0%, accuracy is 78.8% on the same test, and cross-validation accuracy is 73.2%.

## 4. Decisions

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | Main model for the brief | **Logistic regression** on the real CSV | Matched or beat Qwen on your own test, is easy to explain, and gives the "main reasons" from its weights |
| 2 | Is Qwen still wanted? | **Yes, as a second opinion** on the website | Shows the comparison between a simple model and a fine-tuned language model; good material for the report |
| 3 | Who trains Qwen? | **You, on your GPU** | Amora's laptop has an MX250 (2 GB of video memory, compute capability 6.1); training needs about 1.9 GB, and Unsloth needs 7.0 or newer |
| 4 | Where do the models run? | **Both on AWS Lambda** | The website must work without anyone's laptop |
| 5 | How does Qwen run? | **Background batch; scores stored in DynamoDB** | Cold start (10–30+ s) and about a minute for 400 students are over API Gateway's 30 s limit. Keeping it warm would cost about $100+ a month; a batch run costs about $0.01 |
| 6 | Who deploys Qwen? | **Amora**, building the image from your bundle | No AWS access needed on your side |
| 7 | How do the fictional students get into the LMS? | **A `test-student` role**, imported from the CSV by an admin; they can't sign in | Keeps fictional data separate from real students |
| 8 | Where do the model inputs come from? | **The CSV values**, stored on each test student | The LMS doesn't track attendance or logins yet |
| 9 | Finding people among 400+ users | **Search and role filter on the Users page** | The current list is unusable at that size |

## 5. How it will work on the website

```
Admin imports the CSV → 400 test students created with their 5 metrics, enrolled in a course
Lecturer opens the course's at-risk page and clicks "Run analysis"
  → API Lambda (512 MB): logistic regression scores everyone at once (flag + main reasons) → DynamoDB
  → API starts the Qwen Lambda (8 GB) in the background
       → your model scores students in batches of up to 32 → scores saved to DynamoDB
At-risk page reads the saved results: logistic regression flag and reasons,
plus a "Qwen second opinion" column (shows "still running" until it finishes)
```

Amora writes a thin wrapper around your `lambda_handler` that saves the scores instead of returning them. **Your request and response format stays exactly as it is** (section 6.3).

## 6. Your task: retrain Qwen on the real data

**Target:** please aim to send the bundle by **Sun 22 Nov** so it can be deployed before the next deadline on **Wed 25 Nov**. Tell Amora early if that doesn't work.

### 6.1 Train
1. **Back up `outputs/` first.** The baseline command overwrites it.
2. Put the CSV at `ml/dataset/students_demo.csv` and check its SHA-256 (section 1).
3. Run your workflow on it:
   ```bash
   ml/student-risk/.venv/bin/python ml/student-risk/workflow.py --csv ml/dataset/students_demo.csv
   ```
   With your seed 3407 and 70/15/15 split this gives about **280 training, 60 validation and 60 test students**. Keep the same Qwen settings (rank 16, learning rate 0.0002, 3 epochs) unless you have a reason to change them; with so little data, a big sweep isn't worth it.
4. **Pick the cutoff on the 60 validation students only**, with your usual rule: the highest cutoff that reaches at least 70% recall. Never pick it on the test students.

### 6.2 Fix the packaging
`package_lambda.py` currently only works for your synthetic run:
- It reads `outputs/qwen-optimization/selection-freeze.json` and checks the weights' hash against your old sweep.
- It builds the smoke test from `outputs/students_synthetic.csv`.
- Its manifest and limitations say "synthetic evaluation only".

Please change it, or add a mode, so that it:
- packages the **new** merged checkpoint with the **new** validation cutoff;
- builds `tests/smoke.json` from 4 of **our** validation students, with their expected scores;
- updates the manifest: dataset `students_demo.csv` and its hash, split sizes, the new metrics, and limitations that mention 400 fictional students and a small test set;
- still writes `SHA256SUMS` and passes your bundle scans.

### 6.3 Keep these the same (our API depends on them)
- **Entry point:** `lambda_handler.handler`. **Base image:** the pinned `aws-lambda-python:3.14-x86_64`. **Hardware:** CPU only, loading offline from `/opt/model`.
- **Request:** `{"students": [{"student_id", "attendance_pct", "quiz_average", "missed_assignments", "weekly_logins", "days_since_login"}]}`, at most **32** students per request, with the same validation rules.
- **Response:** `{"model_revision", "threshold", "predictions": [{"student_id", "probability", "predicted_at_risk"}]}`.
- `StudentRiskModel(path).probabilities(states, batch_size=...)` and `student_risk.score_event(...)` keep their signatures, so the wrapper can reuse them.
- **Memory:** the package fits in **8,192 MB**.

### 6.4 Check
- Your unit tests pass, plus the package request tests in `lambda_src/tests`.
- Build the image and run the smoke test with networking off:
  ```bash
  podman run --rm --network=none --memory=8g --cpus=4 \
    --entrypoint python localhost/student-risk-qwen:safetensors /opt/tests/smoke.py
  ```
- Note the **cold start** (time to load the model) and the time to score one batch of 32 on CPU.

### 6.5 Send to Amora
Use Google Drive or OneDrive, **not Git**: the files are too big, and `outputs/` is gitignored.
1. **The bundle folder** `outputs/qwen-lambda-package/` (about 1.8 GB): Dockerfile, code, `model/`, `tests/`, `package-manifest.json` and `SHA256SUMS`. **Don't send the 2.3 GB image `.tar`;** Amora rebuilds it from the bundle.
2. **Results on the 60 test students:** accuracy, precision, recall, F1, PR-AUC, the confusion matrix, and the cutoff used. Include **your logistic regression baseline on the same split**, so we compare like with like.
3. **Your `manifest.json` and `predictions.json`** from the run.
4. **The smoke test output** and your cold-start and batch timings.
5. **Code changes** to `workflow.py` and `package_lambda.py`, as files or a zip of the changed scripts.

### 6.6 Done when
- [ ] Trained on `students_demo.csv`, with the hash checked
- [ ] Cutoff chosen on validation students only
- [ ] Bundle builds, and the smoke test passes offline in 8 GB
- [ ] Request and response format unchanged
- [ ] Bundle, results, manifests, timings and code changes sent

### Ground rules
- Use only this fictional dataset; no real student data.
- If Qwen doesn't beat logistic regression on 280 training students, that's fine; just report it honestly. It's a valid finding.

## 7. Amora's build steps

1. ~~**Logistic regression model and saved files**~~ (done, section 3). Decide on balanced class weights.
2. **Answer the 4 brief questions** in `README.md` in this folder, with Qwen as the comparison. *(Brief deliverable.)*
3. **`test-student` role:** blocked from signing in; enrolled in courses as a student.
4. **CSV import endpoint** for admins: creates or updates test students with their metrics, can enrol them in a course, and never duplicates on re-import.
5. **At-risk API:** logistic regression predicts in plain Python from the JSON weights; endpoints to "run analysis" and read the results, for the course's lecturers and admins only; results stored in DynamoDB.
6. **Tests:** sign-in blocked, import repeatable, students refused, predictions match the saved model.
7. **Website:**
   - Users page: search, role filter with counts, deactivated toggle, import button, and a "Test" badge.
   - Course at-risk page: reasons, the Qwen column, and a "Run analysis" button.
8. **Your bundle (section 6)** arrives.
9. **Qwen Lambda:**
   - Terraform: a new ECR repository and Lambda (8,192 MB, 900 s timeout, x86_64), with permission for the API to invoke it.
   - A wrapper that saves scores to DynamoDB.
   - A build-and-push step in `deploy.py`.
10. **Deploy and check on the live website.**

## 8. Feasibility and risks

| Check | Finding | Verdict |
|---|---|---|
| Image size | 2.3 GB, under Lambda's 10 GB limit for container images | OK |
| Memory | About 6 GB peak → run at 8,192 MB | OK; confirm the account allows it on the first deploy |
| Account limits | 1,000 concurrent executions; the API already runs as a container image | OK |
| Speed | Cold start 10–30+ s; about 1 min for 400 students | Batch only, not live |
| Cost | About $0.01 per run, plus about $0.25 a month for the image | OK |
| Reasons | Qwen gives only a probability | Logistic regression provides the reasons |

**Risks**
- **Small data.** 400 students make accuracy noisy (about ±4%), and Qwen trains on only 280.
- **Packaging.** It needs the changes in section 6.2 before a model trained on the real data can be deployed.
- **Upload.** Each Qwen update means pushing a 2.3 GB image from Amora's laptop.
- **Testing.** Running Qwen locally needs about 8 GB of RAM, so it may only be tested on Lambda.
- **Ethics and privacy.** The team's ethics note should cover a language model scoring students. All data stays in AWS Sydney.

## 9. Review checklist (Amora)
- [ ] Decisions 1–9 agreed
- [ ] Balanced class weights for logistic regression
- [ ] Deadline (Sun 22 Nov) agreed with the contributor
- [ ] Section 6 sent to the contributor with the CSV
