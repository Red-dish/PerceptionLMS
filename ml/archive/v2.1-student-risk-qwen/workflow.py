"""Reproducible student-risk experiment. Run with the adjacent Python environment."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, brier_score_loss, confusion_matrix,
                             precision_recall_fscore_support, accuracy_score)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent
FEATURES = ['attendance_pct', 'quiz_average', 'missed_assignments', 'weekly_logins', 'days_since_login']
SEED = 3407
SYNTHETIC_COHORT_SIZE = 1000
SYNTHETIC_STUDENT_COUNT = 2000
QUESTION = {'at_risk': {'type': 'noul', 'instructions':
    'Based on these student engagement and performance measurements, is this student at risk of needing academic support?'}}
MODEL = 'unsloth/Qwen3.5-0.8B'
DEMO = ROOT.parent.parent / 'backend/app/data/student-risk-demo.json'


def _synthetic_cohort(offset, seed):
    count = SYNTHETIC_COHORT_SIZE
    rng = np.random.default_rng(seed + offset // count)
    engagement = rng.beta(3, 2, count)
    frame = pd.DataFrame({
        'student_id': [f'DEMO-{offset + i + 1:04d}' for i in range(count)],
        'attendance_pct': np.clip(35 + 65 * engagement + rng.normal(0, 9, count), 0, 100).round(1),
        'quiz_average': np.clip(30 + 65 * engagement + rng.normal(0, 13, count), 0, 100).round(1),
        'missed_assignments': rng.poisson(4 * (1 - engagement)),
        'weekly_logins': rng.poisson(1 + 8 * engagement),
        'days_since_login': rng.poisson(7 * (1 - engagement)),
    })
    logit = (-0.7 + (70 - frame.attendance_pct) / 15 + (60 - frame.quiz_average) / 18
             + .4 * frame.missed_assignments - .15 * frame.weekly_logins + .2 * frame.days_since_login)
    frame['at_risk'] = rng.binomial(1, 1 / (1 + np.exp(-logit)))
    return frame


def generate(path, count=SYNTHETIC_STUDENT_COUNT, *, seed=None):
    if count < 1:
        raise ValueError('Generate at least one synthetic student.')
    # Fixed cohort seeds preserve existing student measurements as the dataset grows.
    seed = SEED if seed is None else seed
    cohorts = [_synthetic_cohort(offset, seed) for offset in range(0, count, SYNTHETIC_COHORT_SIZE)]
    frame = pd.concat(cohorts, ignore_index=True).iloc[:count]
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)
    return frame


def load(path):
    frame = pd.read_csv(path)
    required = FEATURES + ['at_risk']
    absent = set(required) - set(frame.columns)
    if absent:
        raise ValueError(f'Missing required columns: {sorted(absent)}')
    frame[required] = frame[required].apply(pd.to_numeric, errors='raise')
    if not np.isfinite(frame[required].to_numpy()).all():
        raise ValueError('Measurements and labels must be finite and complete.')
    if not frame.at_risk.isin([0, 1]).all() or frame.at_risk.nunique() != 2:
        raise ValueError('at_risk must contain both binary labels 0 and 1.')
    if not frame[FEATURES[:2]].apply(lambda col: col.between(0, 100)).all().all():
        raise ValueError('Attendance and quiz percentages must be between 0 and 100.')
    counts = frame[FEATURES[2:]]
    if (counts < 0).any().any() or (counts % 1 != 0).any().any():
        raise ValueError('Assignment, login, and day counts must be nonnegative integers.')
    # Repeated students stay together. Contradictory labels need an explicit temporal policy.
    if 'student_id' in frame:
        if frame.student_id.isna().any():
            raise ValueError('Student identifiers must be complete when supplied.')
        if (frame.groupby('student_id').at_risk.nunique() > 1).any():
            raise ValueError('Repeated students with changing labels require a dated dataset and temporal split.')
    return frame


def split(frame):
    groups = frame.student_id if 'student_id' in frame else pd.Series(frame.index, index=frame.index)
    labels = pd.DataFrame({'group': groups, 'label': frame.at_risk}).drop_duplicates('group')
    train_groups, holdout = train_test_split(labels, test_size=.3, stratify=labels.label, random_state=SEED)
    validation, test = train_test_split(holdout, test_size=.5, stratify=holdout.label, random_state=SEED)
    return tuple(frame.loc[groups.isin(part.group)].copy() for part in (train_groups, validation, test))


def state(row):
    return '\n'.join(f'{name}: {float(row[name]):g}' for name in FEATURES)


def decision_rows(frame):
    return [{'state': state(row), 'questions': QUESTION, 'gold': {'at_risk': bool(row.at_risk)}}
            for _, row in frame.iterrows()]


def metrics(labels, probability, threshold=.5):
    prediction = np.asarray(probability) >= threshold
    precision, recall, f1, _ = precision_recall_fscore_support(labels, prediction, average='binary', zero_division=0)
    return {'accuracy': float(accuracy_score(labels, prediction)), 'precision': float(precision),
            'recall': float(recall), 'f1': float(f1), 'pr_auc': float(average_precision_score(labels, probability)),
            'brier_score': float(brier_score_loss(labels, probability)),
            'confusion_matrix': confusion_matrix(labels, prediction, labels=[0, 1]).tolist()}


def baseline(train, test):
    results = {}
    for name, estimator in [('majority', DummyClassifier(strategy='most_frequent')),
                            ('logistic_regression', make_pipeline(StandardScaler(), LogisticRegression(random_state=SEED)))]:
        estimator.fit(train[FEATURES], train.at_risk)
        probabilities = estimator.predict_proba(test[FEATURES])[:, 1]
        results[name] = metrics(test.at_risk, probabilities)
    return results


def positive_probability(answer):
    probabilities = answer['probabilities']
    # Unsloth versions serialize boolean options as true/false or yes/no strings.
    for key in (True, 'true', 'True', 'yes', 'Yes'):
        if key in probabilities:
            return float(probabilities[key])
    raise ValueError(f'Unknown binary probability keys: {list(probabilities)}')


def predict(model, tokenizer, frame):
    from unsloth import FastDecisionModel
    FastDecisionModel.for_inference(model)
    return np.array([positive_probability(FastDecisionModel.predict(model, tokenizer, state(row), QUESTION)['at_risk'])
                     for _, row in frame.iterrows()])


def sanitize_export_metadata(output):
    """Remove local training paths from exported deployment metadata."""
    for filename, key in [('config.json', 'model_name'),
                          ('unsloth_decision_config.json', 'base_model')]:
        path = Path(output) / 'merged' / filename
        metadata = json.loads(path.read_text())
        metadata[key] = 'student-risk-qwen35-0.8b'
        path.write_text(json.dumps(metadata, indent=2, allow_nan=False) + '\n')


def train_qwen(train, validation, output):
    # Unsloth must be imported before transformers.
    from unsloth import FastDecisionModel, DecisionTrainer, is_bfloat16_supported
    import torch
    from transformers import TrainingArguments
    from huggingface_hub import model_info
    revision = model_info(MODEL).sha
    model, tokenizer = FastDecisionModel.from_pretrained(
        MODEL, revision=revision, max_seq_length=512, load_in_4bit=True)
    model = FastDecisionModel.get_peft_model(model, r=16, lora_alpha=16, lora_dropout=0, random_state=SEED)
    train_items, report = FastDecisionModel.build_dataset(decision_rows(train), tokenizer, model)
    validation_items, validation_report = FastDecisionModel.build_dataset(decision_rows(validation), tokenizer, model)
    if report['skipped'] or validation_report['skipped']:
        raise ValueError('Unsloth skipped input decisions. Inspect the dataset before training.')
    trainer = DecisionTrainer(model=model, processing_class=tokenizer, train_dataset=train_items,
        eval_dataset=validation_items, args=TrainingArguments(
            output_dir=str(output / 'training'), num_train_epochs=3, learning_rate=2e-4,
            per_device_train_batch_size=8, gradient_accumulation_steps=1, warmup_steps=10,
            bf16=is_bfloat16_supported(), fp16=not is_bfloat16_supported(),
            eval_strategy='epoch', save_strategy='no', logging_steps=10, report_to='none', seed=SEED))
    torch.cuda.reset_peak_memory_stats()
    training = trainer.train().metrics
    training.update(batch_size=trainer.args.per_device_train_batch_size,
                    gradient_accumulation_steps=trainer.args.gradient_accumulation_steps,
                    peak_allocated_vram_gib=torch.cuda.max_memory_allocated() / 1024**3)
    calibration = FastDecisionModel.calibrate(model, tokenizer, validation_items)
    model.save_pretrained(str(output / 'adapters'))
    model.save_pretrained_merged(str(output / 'merged'))
    # Evaluate and calibrate the merged deployment weights after quantized training.
    # Merging into the full-precision base can change scores from the 4-bit model.
    import gc
    del trainer, model
    gc.collect()
    torch.cuda.empty_cache()
    model, tokenizer = FastDecisionModel.from_pretrained(
        str(output / 'merged'), load_in_4bit=False, dtype=torch.bfloat16, max_seq_length=512)
    validation_items, _ = FastDecisionModel.build_dataset(decision_rows(validation), tokenizer, model)
    calibration = FastDecisionModel.calibrate(model, tokenizer, validation_items)
    model.save_pretrained_merged(str(output / 'merged'))
    sanitize_export_metadata(output)
    return model, tokenizer, revision, calibration, training


def export(frame, test, probability, results, source, synthetic, revision, output):
    artifact = {
        'schema_version': 1, 'dataset': {'name': source.name, 'synthetic': synthetic,
        'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'record_count': len(frame),
        'student_count': int(frame.student_id.nunique()) if 'student_id' in frame else None,
        'class_counts': {str(k): int(v) for k, v in frame.at_risk.value_counts().items()}},
        'model': {'name': MODEL, 'revision': revision, 'threshold': .5},
        'features': FEATURES, 'metrics': results, 'predictions': []}
    for (index, row), score in zip(test.iterrows(), probability, strict=True):
        artifact['predictions'].append({'student_id': str(row.get('student_id', f'ROW-{index + 1}')),
            **{name: float(row[name]) for name in FEATURES}, 'at_risk': int(row.at_risk),
            'probability': float(score), 'predicted_at_risk': bool(score >= .5)})
    text = json.dumps(artifact, indent=2, allow_nan=False)
    output.mkdir(parents=True, exist_ok=True)
    (output / 'predictions.json').write_text(text + '\n')
    # Only the approved synthetic dataset is packaged for the public demonstration.
    if synthetic:
        DEMO.parent.mkdir(parents=True, exist_ok=True)
        temporary = DEMO.with_suffix('.tmp')
        temporary.write_text(text + '\n')
        temporary.replace(DEMO)
    return artifact


def run(source=None):
    synthetic = source is None
    source = Path(source) if source else ROOT / 'outputs/students_synthetic.csv'
    if synthetic:
        generate(source)
    frame = load(source)
    train, validation, test = split(frame)
    output = ROOT / 'outputs'
    output.mkdir(exist_ok=True)
    results = baseline(train, test)
    model, tokenizer, revision, calibration, training = train_qwen(train, validation, output)
    probability = predict(model, tokenizer, test)
    results['qwen'] = metrics(test.at_risk, probability)
    artifact = export(frame, test, probability, results, source, synthetic, revision, output)
    manifest = {'seed': SEED, 'model_revision': revision, 'dataset': artifact['dataset'],
                'split_sizes': [len(part) for part in (train, validation, test)],
                'calibration': calibration, 'training': training,
                'packages': {d.metadata['Name']: d.version for d in importlib.metadata.distributions()}}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2, default=str) + '\n')
    print(json.dumps(results, indent=2))
    return artifact


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--csv', type=Path, help='Supplied dataset; omission generates synthetic demonstration data.')
    args = parser.parse_args()
    run(args.csv)
