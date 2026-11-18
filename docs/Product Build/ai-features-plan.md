# AI features plan (requirements v3)

**Status:** draft for review, 18 Nov 2026. Covers requirements **v3**, the ASA Smart LMS brief; see [requirements/v3.md](../requirements/v3.md) and the version history in [requirements/](../requirements/README.md).
**Aim:** meet the v3 definition of done at the lowest running cost, reusing what the LMS already has. We don't have to use the tools the brief suggests, as long as the end requirements are met.

## 1. Summary
| Need | Cheapest approach that meets it | Extra running cost |
|---|---|---|
| Risk labels from a trained model (Feature B) | Decision Tree + small MLP in scikit-learn, trained offline on the 400-record CSV; the saved model is loaded **inside the existing API Lambda** | About $0 (the existing Lambda and DynamoDB, within the free tier) |
| Grounded student chatbot (Feature A) | Extract text from unit documents uploaded to the course; send that text with the question to a pay-per-use LLM API; return JSON with the answer, sources, conflict and "cannot confirm" fields. No vector database | Cents for the whole demo (see section 5) |
| Demo logins without real passwords | A **demo sign-in** switch: demo accounts sign in from a picker, only while demo mode is on | $0 |
| Five-student MAI600 class | A seed script that creates the class, the people, the quiz marks, the activity data and the unit documents | $0 |

**Dropped from v2.1, saving cost and time:**
- Qwen fine-tuning, GPU training, the 8 GB Lambda and the 2.3 GB image.
- The lecturer chatbot over the CSV.
- Importing 400 `test-student` users.
- Study recommendations.

## 2. Feature B: lecturer at-risk prediction

### Data and features
- **Training data:** `ml/dataset/students_demo.csv`, 400 fictional students, 114 at risk.
- **Features:** the five demo students have attendance, Quiz 1 and Quiz 2, missed work and weekly logins, but **no "days since login"**. So the models train on the **4 features both sources share**: `attendance_pct`, `quiz_average` (the mean of Quiz 1 and Quiz 2), `missed_assignments` and `weekly_logins`. Making up a "days since login" value for the demo would be inventing data.
- **Quick check, 18 Nov** (80-student stratified test set, seed 42, not tuned):

  | Model | Features | Accuracy | At-risk recall |
  |---|---|---|---|
  | Decision Tree (depth 4) | 5 | 78.8% | 47.8% |
  | Decision Tree (depth 4) | 4 | 78.8% | 43.5% |
  | MLP (16, 8) | 5 | 70.0% | 52.2% |
  | MLP (16, 8) | 4 | 71.3% | 52.2% |

  Dropping "days since login" costs little. Recall is low for both models, so the real training run should try class weighting or oversampling and pick the decision threshold on training data only. Whatever count of flagged demo students results is reported as it is.

### Training (offline, on any laptop CPU)
Build it in a new folder, `ml/at-risk/`. The v2.1 logistic regression script is archived in `ml/archive/v2.1-student-risk-qwen/`. The new script or notebook:
1. Loads and describes the dataset (the dataset description the brief asks for).
2. Makes a stratified train/test split with a fixed seed.
3. Trains a **Decision Tree baseline** and a **small MLP** (`MLPClassifier` with a scaler). Tries class weights or oversampling to raise at-risk recall.
4. Reports **accuracy, at-risk recall, precision and a confusion matrix** for both, on the test set only.
5. Picks the chosen model with a written reason (recall matters most: a missed student is worse than a false alarm).
6. **Saves** it (`at_risk_model.joblib` plus a `model_card.json` with the features, metrics, threshold, date and dataset hash), then **reloads** it and scores one new fictional student (the inference example).
7. Answers the Session 4 questions for the chosen model.

Logistic regression can stay in the comparison as an extra, but the brief requires the Decision Tree and the MLP.

### Serving (inside the existing API)
- Add `scikit-learn` to the backend image. The API **loads the saved `.joblib`** at start-up, which proves the label comes from the saved model.
- **Inputs come from the LMS**, so the data flow is visible:
  - **Quiz 1 and Quiz 2:** real MAI600 quizzes in the LMS, with the demo students' marks in the gradebook. `quiz_average` is computed from them.
  - **Attendance, missed work and weekly logins:** a per-student, per-course "activity" record (pre-filled demo data, which the brief allows).
- **Endpoints:** `GET /courses/{id}/risk` for **that course's lecturers and admins only**, and `GET /courses/{id}/risk/{student_id}` for the detail. They return, per student:
  - the label ("Review recommended" or "Not flagged") and the probability;
  - the **exact inputs sent to the model**;
  - the model name and version, and the reasons (the decision path for the tree, or the features furthest towards risk).
- **Students can never call these endpoints.** No notifications or penalties are triggered.

### Website (lecturer)
- **Class table:** a risk column beside each student's name, with a fixed note that the flag is a learning-support prompt, not proof a student will fail.
- **Student detail:** the inputs sent to the model, the reasons, the model version and the raw API response (for demo step 5).
- **Limitations panel:** false negatives (for example, a struggling student with good attendance), a small fictional training set, and the threshold used. The lecturer should review, not act automatically.

## 3. Feature A: student course chatbot

### Approach: send the documents with each question, no vector database
The demo has a handful of short unit documents (the MAI600 knowledge document and two A3 documents). That fits easily in one prompt, so we skip embeddings and vector stores entirely.
1. **Upload:** a lecturer uploads unit documents as course materials. That feature already exists: modules and materials, with S3 uploads.
2. **Extract:** on upload, or with a "Prepare for chatbot" button, the API extracts the text (PDF via `pypdf`, DOCX, Markdown or plain text) and stores it, with the file name and upload date, against the course.
3. **Ask:** `POST /courses/{id}/chat`, for that course's **enrolled students** (and its lecturers and admins). The prompt holds:
   - strict instructions: answer only from these documents; cite the document and section; if two documents disagree, say so and send the student to the current official Canvas page; if the answer isn't in them, reply "I cannot confirm" and suggest who to ask;
   - every document's text, labelled by file name;
   - the question.
4. **Answer format:** the model returns JSON, `{answer, sources: [{document, quote}], conflict: bool, can_confirm: bool}`. The API checks that each quoted source text really appears in the cited document. If it doesn't, it marks the answer "cannot confirm", so the bot can't invent a source.
5. **Privacy:** no student records, grades or risk data ever go to the LLM. Only unit documents and the question do.

If the documents later grow too big for one prompt, add simple keyword search to pick the most relevant sections before sending.

### Which LLM (cost first)
| Option | Cost | Pros | Cons |
|---|---|---|---|
| **Amazon Bedrock** (a small model such as Amazon Nova Lite or Claude Haiku) | Pay per token: a fraction of a cent per question at demo size | Stays in AWS; the Lambda uses IAM, so there's **no API key to manage**; no idle cost | Model access must be enabled; **check which models are offered in Sydney** (`ap-southeast-2`) |
| Groq API (the brief's suggestion) | Free tier | Very fast; suggested by the lecturer | Another vendor and an API key to store as a secret; free-tier rate limits; data leaves AWS |
| Chatbase | Free tier is limited, paid plans above it | No code | Its own widget, outside our login and roles; hard to meet "students only" and "only their own data" |
| Local Ollama + Open WebUI | Free | No cloud cost | Not on the live website; runs only on a team laptop during the demo |

**Recommendation:** Bedrock, with Groq as the fallback if Bedrock model access is a problem. Either way the LLM call sits behind one small function, so swapping providers is a one-file change. Add a per-user daily question limit to cap costs.

### Website (student)
- A chat panel on the course page, showing sources under each answer and a clear "Conflicting sources: check the official Canvas page" or "I cannot confirm" state.

### Tests
- **Automated, with a fake LLM:** students outside the course are refused; source quotes are checked; student data never appears in the prompt.
- **Live evaluation script:** the 3 required questions, 1 answer that isn't in the notes, and the A3 due-date conflict. Saved outputs and screenshots become the chatbot evidence.

## 4. Demo accounts and sign-in
The brief needs live logins as `emma.park@example.com` (and the other four students), the lecturer `mmotahar@asahe.edu.au`, and a team-lead admin, with **no real passwords**. Our sign-in is Google-only, and those addresses can't sign in with Google.

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Demo sign-in (recommended)** | Accounts flagged `demo: true`. While a `DEMO_MODE` setting is on, the sign-in page shows "Demo accounts" and signs in as the chosen one without a password | Exact identities from the brief; no passwords; easy to demo | Anyone can use demo accounts while it's on. Limit them to the demo class and turn it off after the presentation |
| B. Team members' Google accounts | Team members act as the five students; the lecturer is a team account | No code | Names and emails won't match the brief; the lecturer identity isn't possible; juggling many Google sign-ins live |

**This reverses the v2.1 `test-student` idea:** demo users must be able to sign in. A `demo` flag on normal student and lecturer accounts does the job without a new role. The Users page search and filter is no longer needed for the demo; keep it as a nice-to-have.

## 5. Cost estimate
| Item | Cost |
|---|---|
| API Lambda, DynamoDB, S3, API Gateway | Existing; demo traffic stays within the free tier or costs cents |
| Risk model | $0 extra (runs in the API Lambda; scikit-learn makes the image bigger, not the bill) |
| Chatbot LLM (Bedrock) | Each question sends about 5–15k tokens of documents. At small-model prices, a few hundred test and demo questions should cost **well under $5**. Check current Bedrock pricing before starting |
| Removed: Qwen 8 GB Lambda / GPU | Saves the GPU training time, the 2.3 GB image, and roughly $100+ a month if kept warm |

## 6. Build steps
1. **Get the pack files** from the lecturer: the five-student CSV, the MAI600 knowledge document and the two A3 documents.
2. **ML:** the training notebook or script (section 2), saved model, metrics and model card, plus a `README.md` in `ml/at-risk/` with the dataset description, results and answers.
3. **Backend, risk:** the activity record, the risk endpoints with the saved model loaded, and tests (lecturers and admins only; students refused; labels match the saved model).
4. **Backend, chatbot:** text extraction for course materials, the chat endpoint with the JSON answer format, source checking, a rate limit, Bedrock permissions in Terraform, and tests with a fake LLM.
5. **Backend, demo:** demo sign-in behind `DEMO_MODE`, and a seed script for MAI600 (lecturer, five students, Quiz 1 and Quiz 2 with marks, activity data, unit documents).
6. **Website:**
   - **Student course page:** their own quiz marks and assignments, plus the chat panel.
   - **Lecturer class table:** the risk column, the student detail and the limitations panel.
   - **Sign-in page:** the demo accounts picker.
7. **Deploy:** also covers KAN-72, the gradebook and quiz API that isn't live yet. Then run both demo journeys end to end on the live site.
8. **Evidence:** the ML report, chatbot test outputs and screenshots, the 1–2 page prototype handover, and the presentation, with every member speaking.

**Owner:** Amora owns all of it (decided 18 Nov).

**Timeline**
- **Wed 25 Nov, progress checkpoint:** steps 2 and 3 done (models trained, compared, saved; risk API working with tests), plus the demo seed data and a chosen chatbot provider. Ideally deployed.
- **Thu 3 Dec, final demo and presentation:** everything else, including the chatbot (step 4) once the knowledge documents arrive, demo sign-in, the website and the evidence.

## 7. Decisions and open questions
**Decided 18 Nov**
- **Deadlines:** final demo and presentation Thu 3 Dec; visible progress by Wed 25 Nov.
- **Five-student data:** there's no separate CSV; the values are in the brief (requirements v3). The seed script uses them as given.
- **A3 document:** the brief Amora attached is the latest A3.
- **Knowledge documents:** coming later. Planning first.
- **Owner:** Amora, for everything.
- **GitHub epics and Jira:** don't update yet.

**Still open**
1. **Sign-in:** demo sign-in (A) or team Google accounts (B)?
2. **LLM provider:** under review. Compare the options in section 3 before choosing.
3. **The friend who built Qwen:** any role in v3?
