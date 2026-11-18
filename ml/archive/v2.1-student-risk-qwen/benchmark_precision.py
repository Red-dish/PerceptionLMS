"""Compare TabICLv2 and Qwen using validation thresholds and fresh synthetic students."""
import gc
import hashlib
import importlib.metadata
import json
from pathlib import Path
import tempfile
import time

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_recall_curve
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
import torch
from tabicl import TabICLClassifier

from cpu_runtime import StudentRiskModel
from workflow import FEATURES, ROOT, SEED, generate, load, metrics, split, state

CHECKPOINT = 'tabicl-classifier-v2-20260212.ckpt'
TARGET_RECALL = .70
FRESH_SEED = 63407
OUTPUT = ROOT / 'outputs/precision-benchmark'


def recall_operating_point(labels, probabilities, target=TARGET_RECALL):
    """Return the highest threshold that still achieves the requested recall.

    Used on validation data to select a deployment threshold. Used on evaluation
    data only to describe ranking quality at matched recall, never for deployment.
    Include entire tied score groups when counting predictions.
    """
    labels = np.asarray(labels)
    probabilities = np.asarray(probabilities)
    if labels.ndim != 1 or labels.shape != probabilities.shape or not len(labels):
        raise ValueError('Labels and probabilities must be equal-length, nonempty vectors.')
    if not np.isin(labels, [0, 1]).all() or not (labels == 1).any():
        raise ValueError('Binary labels must include at least one positive student.')
    if not np.isfinite(probabilities).all() or ((probabilities < 0) | (probabilities > 1)).any():
        raise ValueError('Probabilities must be finite values between zero and one.')
    if not 0 < target <= 1:
        raise ValueError('Recall target must be greater than zero and at most one.')
    precision, recall, thresholds = precision_recall_curve(labels, probabilities)
    index = np.flatnonzero(recall[:-1] >= target)[-1]
    return {'threshold': float(thresholds[index]), 'precision': float(precision[index]),
            'recall': float(recall[index])}


def tabicl_probabilities(model, frame):
    positive = list(model.classes_).index(1)
    return np.concatenate([model.predict_proba(frame[FEATURES].iloc[start:start + 512])[:, positive]
                           for start in range(0, len(frame), 512)])


def bootstrap_precision_difference(labels, reference, candidate, repeats=1000):
    """Paired student bootstrap for the matched-recall precision difference."""
    labels = np.asarray(labels)
    rng = np.random.default_rng(SEED)
    differences = []
    for _ in range(repeats):
        indices = rng.integers(0, len(labels), len(labels))
        before = recall_operating_point(labels[indices], reference[indices])['precision']
        after = recall_operating_point(labels[indices], candidate[indices])['precision']
        differences.append(after - before)
    return {'repeats': repeats, 'interval_95': np.quantile(differences, [.025, .975]).tolist()}


def run():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = ROOT / 'outputs/students_synthetic.csv'
    frame = load(source)
    train, validation, test = split(frame)
    with tempfile.TemporaryDirectory() as temporary:
        fresh = generate(Path(temporary) / 'fresh.csv', count=5000, seed=FRESH_SEED)
    fresh.student_id = fresh.student_id.str.replace('DEMO-', 'FRESH-', regex=False)
    frames = {'validation': validation, 'test': test, 'fresh': fresh}
    scores = {}
    timing = {}

    torch.set_num_threads(8)
    start = time.perf_counter()
    qwen = StudentRiskModel(ROOT / 'outputs/merged', device='cuda:0')
    scores['qwen'] = {name: np.asarray(qwen.probabilities([state(row) for _, row in data.iterrows()]))
                      for name, data in frames.items()}
    timing['qwen_seconds_including_load'] = time.perf_counter() - start
    del qwen
    gc.collect()
    torch.cuda.empty_cache()
    print('Finished Qwen reference scoring.', flush=True)

    logistic = make_pipeline(StandardScaler(), LogisticRegression(random_state=SEED))
    logistic.fit(train[FEATURES], train.at_risk)
    scores['logistic_regression'] = {name: logistic.predict_proba(data[FEATURES])[:, 1]
                                     for name, data in frames.items()}

    start = time.perf_counter()
    tabicl = TabICLClassifier(checkpoint_version=CHECKPOINT, n_estimators=8, batch_size=8,
        kv_cache=True, device='cuda:0', use_amp=False, random_state=SEED, n_jobs=8)
    tabicl.fit(train[FEATURES], train.at_risk)
    timing['tabicl_fit_seconds_including_download'] = time.perf_counter() - start
    scores['tabiclv2'] = {}
    for name, data in frames.items():
        start = time.perf_counter()
        scores['tabiclv2'][name] = tabicl_probabilities(tabicl, data)
        timing[f'tabicl_{name}_seconds'] = time.perf_counter() - start
    with Path(tabicl.model_path_).open('rb') as checkpoint_file:
        checkpoint_sha256 = hashlib.file_digest(checkpoint_file, 'sha256').hexdigest()
    # Persist a self-contained CPU artifact with its synthetic training context.
    tabicl.device = 'cpu'
    tabicl.n_jobs = 4
    pending_model = OUTPUT / 'tabiclv2.tmp'
    tabicl.save(pending_model, save_model_weights=True,
                save_training_data=True, save_kv_cache=True)
    pending_model.replace(OUTPUT / 'tabiclv2.pkl')
    print('Finished TabICLv2 scoring and saved its fitted context.', flush=True)

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

    with (OUTPUT / 'tabiclv2.pkl').open('rb') as artifact_file:
        artifact_sha256 = hashlib.file_digest(artifact_file, 'sha256').hexdigest()
    report = {'dataset_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'artifact_sha256': artifact_sha256,
        'split_sizes': {name: len(data) for name, data in [('train', train), *frames.items()]},
        'fresh_seed': FRESH_SEED, 'target_recall': TARGET_RECALL,
        'selection_rule': 'Highest threshold meeting target recall on validation only.',
        'ranking_metric': 'Precision at the smallest ranked alert set meeting target recall, including ties.',
        'checkpoint': CHECKPOINT, 'checkpoint_sha256': checkpoint_sha256,
        'tabicl_configuration': {'n_estimators': 8, 'batch_size': 8, 'kv_cache': True,
                                 'use_amp': False, 'random_state': SEED},
        'qwen_runtime': 'Exported Clef checkpoint with float32 CUDA inference and saved temperature.',
        'timing': timing, 'results': results,
        'paired_bootstrap_tabicl_minus_qwen': bootstrap_precision_difference(
            fresh.at_risk, scores['qwen']['fresh'], scores['tabiclv2']['fresh']),
        'packages': {name: importlib.metadata.version(name) for name in
                     ('tabicl', 'torch', 'numpy', 'pandas', 'scikit-learn')}}
    arrays = {f'{name}_{partition}': probability for name, partitions in scores.items()
              for partition, probability in partitions.items()}
    arrays.update({f'{partition}_labels': data.at_risk.to_numpy() for partition, data in frames.items()})
    arrays.update({f'{partition}_ids': data.student_id.to_numpy(dtype=str) for partition, data in frames.items()})
    np.savez_compressed(OUTPUT / 'scores.npz', **arrays)
    temporary = OUTPUT / 'report.tmp'
    temporary.write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')
    temporary.replace(OUTPUT / 'report.json')
    print(json.dumps(report, indent=2), flush=True)
    return report


if __name__ == '__main__':
    run()
