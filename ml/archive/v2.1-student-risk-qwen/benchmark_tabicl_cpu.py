"""Measure the fitted TabICLv2 artifact on CPU with cached training context."""
import os
os.environ['CUDA_VISIBLE_DEVICES'] = ''
os.environ['HF_HUB_OFFLINE'] = '1'

import json
import argparse
import hashlib
import resource
import time

import numpy as np
import torch
from tabicl import TabICLClassifier
from benchmark_precision import OUTPUT
from workflow import FEATURES, ROOT, load, split


def run(tuned=False):
    output = OUTPUT / 'tuning' if tuned else OUTPUT
    artifact = output / ('selected.pkl' if tuned else 'tabiclv2.pkl')
    score_name = 'tabiclv2_tuned_test' if tuned else 'tabiclv2_test'
    provenance = json.loads((output / 'report.json').read_text())
    with artifact.open('rb') as model_file:
        if hashlib.file_digest(model_file, 'sha256').hexdigest() != provenance['artifact_sha256']:
            raise ValueError('The fitted model does not match the benchmark report.')
    torch.set_num_threads(4)
    start = time.perf_counter()
    model = TabICLClassifier.load(artifact, device='cpu')
    model.n_jobs = 4
    load_seconds = time.perf_counter() - start
    test = split(load(ROOT / 'outputs/students_synthetic.csv'))[2].head(10)
    positive = list(model.classes_).index(1)
    durations, probabilities = [], []
    for i in range(len(test)):
        start = time.perf_counter()
        probabilities.append(float(model.predict_proba(test[FEATURES].iloc[i:i + 1])[0, positive]))
        durations.append(time.perf_counter() - start)
    reference = np.load(output / 'scores.npz', allow_pickle=False)
    assert list(reference['test_ids'][:len(test)]) == list(test.student_id)
    expected = reference[score_name][:len(test)]
    report = {'device': str(model.device_), 'threads': 4, 'sample_count': len(test),
        'load_seconds': load_seconds, 'first_inference_seconds': durations[0],
        'warm_mean_seconds': float(np.mean(durations[1:])),
        'peak_ram_mb': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024,
        'artifact_mb': artifact.stat().st_size / 1024**2,
        'max_probability_difference': float(np.max(np.abs(expected - probabilities))),
        'class_agreement': bool(np.all((expected >= .5) == (np.asarray(probabilities) >= .5))),
        'probability_tolerance': .01}
    (output / 'cpu-benchmark.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    if report['max_probability_difference'] > report['probability_tolerance'] or not report['class_agreement']:
        raise RuntimeError('CPU reload differs beyond the accepted tolerance.')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--tuned', action='store_true', help='Measure the validation-selected fine-tuned model.')
    run(parser.parse_args().tuned)
