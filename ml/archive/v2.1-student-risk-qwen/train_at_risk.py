# /// script
# requires-python = ">=3.12"
# dependencies = ["scikit-learn>=1.5", "pandas>=2.2", "joblib>=1.4"]
# ///
"""AI Task 2: train, test and save the at-risk model on students_demo.csv.

Run from the repository root:

    uv run ml/archive/v2.1-student-risk-qwen/train_at_risk.py

It trains a logistic regression on 80% of the students, measures it on the other 20%,
saves the model, and then predicts for one new fictional student.
"""

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, precision_score, recall_score
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).resolve().parent
DATASET = HERE.parents[1] / "dataset" / "students_demo.csv"  # ml/dataset/
OUTPUT = HERE / "at-risk-model"
FEATURES = ["attendance_pct", "quiz_average", "missed_assignments", "weekly_logins", "days_since_login"]
TARGET = "at_risk"
SEED = 42  # fixed so the split, and so the accuracy, is the same every run
THRESHOLD = 0.5

# Plain-English names used when explaining a prediction.
REASON_TEXT = {
    "attendance_pct": "attendance",
    "quiz_average": "quiz average",
    "missed_assignments": "missed assignments",
    "weekly_logins": "weekly logins",
    "days_since_login": "days since last login",
}

# One new fictional student, not in the dataset.
NEW_STUDENT = {
    "student_id": "NEW-001",
    "attendance_pct": 58,
    "quiz_average": 47,
    "missed_assignments": 3,
    "weekly_logins": 2,
    "days_since_login": 9,
}


def main() -> None:
    # 1. Load the data
    students = pd.read_csv(DATASET)
    print(f"Loaded {len(students)} students from {DATASET.name}; {students[TARGET].sum()} are at risk.")
    X, y = students[FEATURES], students[TARGET]

    # 2. Split into training data (80%) and testing data (20%), keeping the same share of
    #    at-risk students in each.
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=SEED)
    print(f"Training on {len(X_train)} students, testing on {len(X_test)} students the model has not seen.")

    # 3. Train: scale each feature, then fit a logistic regression
    model = make_pipeline(StandardScaler(), LogisticRegression(random_state=SEED))
    model.fit(X_train, y_train)
    print("Model trained successfully.")

    # 4. Test: predict for the held-out students and compare with their real labels
    predicted = model.predict(X_test)
    accuracy = accuracy_score(y_test, predicted)
    precision = precision_score(y_test, predicted)
    recall = recall_score(y_test, predicted)
    tn, fp, fn, tp = confusion_matrix(y_test, predicted).ravel()
    cv = cross_val_score(make_pipeline(StandardScaler(), LogisticRegression(random_state=SEED)), X, y, cv=5)
    print(f"\nAccuracy:  {accuracy:.1%}  ({tp + tn} of {len(y_test)} test students correct)")
    print(f"Precision: {precision:.1%}  (of students flagged at risk, how many really were)")
    print(f"Recall:    {recall:.1%}  (of students really at risk, how many were flagged)")
    print(f"Confusion: {tn} true negatives, {fp} false positives, {fn} false negatives, {tp} true positives")
    print(f"5-fold cross-validation accuracy: {cv.mean():.1%} (+/- {cv.std():.1%})")

    scaler, regression = model.named_steps["standardscaler"], model.named_steps["logisticregression"]
    weights = dict(zip(FEATURES, regression.coef_[0]))
    print("\nWeights (positive means more likely at risk):")
    for name, weight in sorted(weights.items(), key=lambda item: -abs(item[1])):
        print(f"  {name:20} {weight:+.3f}")

    # 5. Save the model: joblib for Python, JSON for the LMS API (no scikit-learn needed there)
    OUTPUT.mkdir(exist_ok=True)
    joblib.dump(model, OUTPUT / "at_risk_model.joblib")
    exported = {
        "algorithm": "logistic_regression",
        "features": FEATURES,
        "mean": dict(zip(FEATURES, scaler.mean_.tolist())),
        "scale": dict(zip(FEATURES, scaler.scale_.tolist())),
        "coefficients": {name: float(value) for name, value in weights.items()},
        "intercept": float(regression.intercept_[0]),
        "threshold": THRESHOLD,
        "reason_text": REASON_TEXT,
        "trained_on": {"dataset": DATASET.name, "students": len(students), "train": len(X_train), "test": len(X_test), "seed": SEED},
        "test_metrics": {
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
            "cross_validation_accuracy": float(cv.mean()),
        },
    }
    (OUTPUT / "at_risk_model.json").write_text(json.dumps(exported, indent=2) + "\n")
    print(f"\nSaved the model to {OUTPUT.relative_to(HERE.parents[2])}/")

    # 6. Use the saved model on one new fictional student
    loaded = joblib.load(OUTPUT / "at_risk_model.joblib")
    new = pd.DataFrame([NEW_STUDENT])[FEATURES]
    probability = loaded.predict_proba(new)[0, 1]
    z_scores = (new.iloc[0] - scaler.mean_) / scaler.scale_
    contributions = {name: weights[name] * z_scores[name] for name in FEATURES}
    reasons = [REASON_TEXT[name] for name, value in sorted(contributions.items(), key=lambda item: -item[1]) if value > 0][:3]
    print(f"\nNew fictional student {NEW_STUDENT['student_id']}: "
          + ", ".join(f"{name}={NEW_STUDENT[name]}" for name in FEATURES))
    print(f"  Probability of being at risk: {probability:.1%}")
    print(f"  Prediction: {'may need support (at risk)' if probability >= THRESHOLD else 'not at risk'}")
    print(f"  Main reasons: {', '.join(reasons) or 'none'}")


if __name__ == "__main__":
    main()
