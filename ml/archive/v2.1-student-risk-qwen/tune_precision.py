"""Tune TabICLv2 on validation precision and evaluate once on a fresh cohort."""
import gc
import hashlib
import json
from pathlib import Path
import tempfile
import time

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
import torch
from tabicl import TabICLClassifier, FinetunedTabICLClassifier
from tabicl._finetune.base import ValidationMetrics

from benchmark_precision import (CHECKPOINT, OUTPUT, TARGET_RECALL, recall_operating_point,
                                 tabicl_probabilities, bootstrap_precision_difference)
from cpu_runtime import StudentRiskModel
from workflow import FEATURES, ROOT, SEED, generate, load, metrics, split, state

TUNING_OUTPUT = OUTPUT / 'tuning'
FINAL_SEED = 73407


class PrecisionFinetuner(FinetunedTabICLClassifier):
    """Use the package's validation hook to select weights for the outreach metric."""
    @property
    def _metric_name(self):
        return 'precision_at_recall_70'

    def _run_validation(self, inner, X_train, y_train, X_val, y_val):
        inner.fit(X_train, y_train)
        probability = inner.predict_proba(X_val)[:, list(inner.classes_).index(1)]
        point = recall_operating_point(y_val, probability)
        return ValidationMetrics(primary=point['precision'], secondary={
            'precision_at_recall_70': point['precision'], 'recall': point['recall'],
            'pr_auc': float(average_precision_score(y_val, probability))})


def classifier(config, model_path=None):
    if model_path is not None:
        candidate_path = Path(model_path)
        model_path = str(candidate_path if candidate_path.is_absolute() else ROOT / candidate_path)
    return TabICLClassifier(checkpoint_version=CHECKPOINT, model_path=model_path,
        n_estimators=config['n_estimators'], norm_methods=config['norm_methods'],
        kv_cache=True, batch_size=8, device='cuda:0', use_amp=False,
        random_state=SEED, n_jobs=8)


def validation_result(model, validation):
    probability = tabicl_probabilities(model, validation)
    point = recall_operating_point(validation.at_risk, probability)
    return probability, point, float(average_precision_score(validation.at_risk, probability))


def quality(candidate):
    return candidate['validation']['precision'], candidate['validation_pr_auc']


def run():
    TUNING_OUTPUT.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(8)
    source = ROOT / 'outputs/students_synthetic.csv'
    train, validation, test = split(load(source))
    candidates = []
    configs = [
        {'n_estimators': 8, 'norm_methods': None},
        {'n_estimators': 16, 'norm_methods': None},
        {'n_estimators': 32, 'norm_methods': None},
        {'n_estimators': 16, 'norm_methods': ['none']},
        {'n_estimators': 16, 'norm_methods': ['power']},
    ]
    best = None
    for i, config in enumerate(configs):
        start = time.perf_counter()
        model = classifier(config)
        model.fit(train[FEATURES], train.at_risk)
        _, point, ap = validation_result(model, validation)
        candidate = {'name': f'frozen_{i}', 'config': config, 'model_path': None,
            'validation': point, 'validation_pr_auc': ap, 'seconds': time.perf_counter() - start}
        candidates.append(candidate)
        if best is None or quality(candidate) > quality(best):
            best = candidate
        print('CANDIDATE', json.dumps(candidate), flush=True)
        del model
        gc.collect()
        torch.cuda.empty_cache()

    frozen_config = dict(best['config'])
    for learning_rate in (3e-6, 1e-5, 3e-5):
        name = f'finetuned_{learning_rate:g}'
        output = TUNING_OUTPUT / name
        start = time.perf_counter()
        torch.cuda.reset_peak_memory_stats()
        finetuner = PrecisionFinetuner(epochs=30, learning_rate=learning_rate,
            n_estimators_finetune=8, n_estimators_validation=frozen_config['n_estimators'],
            n_estimators_inference=frozen_config['n_estimators'], max_data_size=1400,
            norm_methods=frozen_config['norm_methods'], checkpoint_version=CHECKPOINT,
            early_stopping=True, patience=8, amp=True, device='cuda:0', random_state=SEED,
            save_interval=0, verbose=True,
            extra_classifier_kwargs={'kv_cache': True, 'use_amp': False, 'n_jobs': 8, 'batch_size': 8})
        finetuner.fit(train[FEATURES], train.at_risk, X_val=validation[FEATURES],
                       y_val=validation.at_risk, output_dir=output)
        peak = torch.cuda.max_memory_allocated() / 1024**3
        del finetuner
        gc.collect()
        torch.cuda.empty_cache()
        # Store portable paths in reports; resolve them only when loading weights.
        model_path = str((output / 'best.ckpt').relative_to(ROOT))
        model = classifier(frozen_config, model_path)
        model.fit(train[FEATURES], train.at_risk)
        _, point, ap = validation_result(model, validation)
        candidate = {'name': name, 'config': frozen_config, 'model_path': model_path,
            'learning_rate': learning_rate, 'validation': point, 'validation_pr_auc': ap,
            'seconds': time.perf_counter() - start, 'peak_allocated_vram_gib': peak,
            'training_ensemble_batch': 8}
        candidates.append(candidate)
        if quality(candidate) > quality(best):
            best = candidate
        print('CANDIDATE', json.dumps(candidate), flush=True)
        del model
        gc.collect()
        torch.cuda.empty_cache()

    # The winning settings and thresholds are fixed before creating this cohort.
    with tempfile.TemporaryDirectory() as temporary:
        fresh = generate(Path(temporary) / 'fresh.csv', count=10000, seed=FINAL_SEED)
    fresh.student_id = fresh.student_id.str.replace('DEMO-', 'FINAL-', regex=False)
    frames = {'validation': validation, 'test': test, 'fresh': fresh}
    scores = {}
    for name, config, model_path in [('tabiclv2_default', configs[0], None),
                                    ('tabiclv2_tuned', best['config'], best['model_path'])]:
        model = classifier(config, model_path)
        model.fit(train[FEATURES], train.at_risk)
        scores[name] = {partition: tabicl_probabilities(model, data) for partition, data in frames.items()}
        if name == 'tabiclv2_tuned':
            model.device = 'cpu'
            model.n_jobs = 4
            pending = TUNING_OUTPUT / 'selected.tmp'
            model.save(pending, save_model_weights=True, save_training_data=True, save_kv_cache=True)
            pending.replace(TUNING_OUTPUT / 'selected.pkl')
        del model
        gc.collect()
        torch.cuda.empty_cache()

    qwen = StudentRiskModel(ROOT / 'outputs/merged', device='cuda:0')
    scores['qwen'] = {partition: np.asarray(qwen.probabilities([state(row) for _, row in data.iterrows()]))
                      for partition, data in frames.items()}
    del qwen
    gc.collect()
    torch.cuda.empty_cache()
    logistic = make_pipeline(StandardScaler(), LogisticRegression(random_state=SEED))
    logistic.fit(train[FEATURES], train.at_risk)
    scores['logistic_regression'] = {partition: logistic.predict_proba(data[FEATURES])[:, 1]
                                     for partition, data in frames.items()}

    results = {}
    for name, partitions in scores.items():
        selected = recall_operating_point(validation.at_risk, partitions['validation'])
        results[name] = {'validation_operating_point': selected}
        for partition in ('test', 'fresh'):
            labels = frames[partition].at_risk
            results[name][partition] = {
                'default_threshold': metrics(labels, partitions[partition]),
                'validation_selected_threshold': metrics(labels, partitions[partition], selected['threshold']),
                'ranking_at_target_recall': recall_operating_point(labels, partitions[partition])}
    with (TUNING_OUTPUT / 'selected.pkl').open('rb') as artifact:
        artifact_hash = hashlib.file_digest(artifact, 'sha256').hexdigest()
    report = {'dataset_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'target_recall': TARGET_RECALL, 'final_seed': FINAL_SEED, 'final_students': len(fresh),
        'selection_rule': 'Validation precision at target recall, then validation PR-AUC to break ties.',
        'selected': best, 'candidates': candidates, 'results': results, 'artifact_sha256': artifact_hash,
        'paired_bootstrap_tuned_minus_qwen': bootstrap_precision_difference(
            fresh.at_risk, scores['qwen']['fresh'], scores['tabiclv2_tuned']['fresh']),
        'paired_bootstrap_tuned_minus_default': bootstrap_precision_difference(
            fresh.at_risk, scores['tabiclv2_default']['fresh'], scores['tabiclv2_tuned']['fresh'])}
    arrays = {f'{name}_{partition}': probability for name, partitions in scores.items()
              for partition, probability in partitions.items()}
    arrays.update({f'{partition}_labels': data.at_risk.to_numpy() for partition, data in frames.items()})
    arrays.update({f'{partition}_ids': data.student_id.to_numpy(dtype=str) for partition, data in frames.items()})
    np.savez_compressed(TUNING_OUTPUT / 'scores.npz', **arrays)
    pending = TUNING_OUTPUT / 'report.tmp'
    pending.write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')
    pending.replace(TUNING_OUTPUT / 'report.json')
    print('TUNING_RESULT', json.dumps(report), flush=True)
    return report


if __name__ == '__main__':
    run()
