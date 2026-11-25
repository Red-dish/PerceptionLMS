"""Benchmark the frozen optimization selection with CPU-only visibility."""
import os
os.environ['CUDA_VISIBLE_DEVICES'] = ''
os.environ['UNSLOTH_FORCE_CPU'] = '1'
os.environ['UNSLOTH_DECISION_COMPILE'] = '0'

import hashlib
import json
from pathlib import Path
import resource
import time

import numpy as np
from cpu_runtime import StudentRiskModel
import torch
from workflow import ROOT, load, split, state

OUTPUT = ROOT / 'outputs/qwen-optimization'
torch.set_num_threads(4)
freeze = json.loads((OUTPUT / 'selection-freeze.json').read_text())
checkpoint = (ROOT / freeze['selected_checkpoint']).resolve()
with (checkpoint / 'model.safetensors').open('rb') as artifact:
    model_hash = hashlib.file_digest(artifact, 'sha256').hexdigest()
if model_hash != freeze['selected_merged_model_sha256']:
    raise ValueError('Selected checkpoint hash differs from the selection freeze.')

frame = split(load(ROOT / 'outputs/students_synthetic.csv'))[1].head(10)
states = [state(row) for _, row in frame.iterrows()]
with np.load(ROOT / freeze['selected_scores'], allow_pickle=False) as cached:
    reference = cached['validation_probabilities'][:10]
    reference_ids = cached['validation_ids'][:10].astype(str).tolist()
if reference_ids != list(frame.student_id):
    raise ValueError('Cached GPU scores do not match the benchmark students.')
cutoff = freeze['validation_cutoff']

start = time.perf_counter()
runtime = StudentRiskModel(checkpoint)
load_seconds = time.perf_counter() - start
scores, durations = [], []
for text in states:
    start = time.perf_counter()
    score = runtime.probability(text)
    durations.append(time.perf_counter() - start)
    scores.append(score)
batched = runtime.probabilities(states, batch_size=4)
reference_classes = reference >= cutoff
report = {
    'selected_candidate': freeze['selected_candidate'],
    'checkpoint': freeze['selected_checkpoint'],
    'merged_model_sha256': model_hash,
    'validation_cutoff': cutoff,
    'device': str(next(runtime.model.parameters()).device),
    'threads': 4, 'load_seconds': load_seconds,
    'peak_ram_mb': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024,
    'first_inference_seconds': durations[0],
    'warm_mean_seconds': sum(durations[1:]) / len(durations[1:]),
    'max_probability_difference': float(np.max(np.abs(reference - scores))),
    'class_agreement': bool(np.all(reference_classes == (np.asarray(scores) >= cutoff))),
    'classification_matches': int(np.sum(reference_classes == (np.asarray(scores) >= cutoff))),
    'batch_size': 4,
    'batch_max_single_difference': float(np.max(np.abs(np.asarray(scores) - batched))),
    'batch_max_probability_difference': float(np.max(np.abs(reference - batched))),
    'batch_class_agreement': bool(np.all(reference_classes == (np.asarray(batched) >= cutoff))),
    'single_batch_class_agreement': bool(np.all((np.asarray(scores) >= cutoff) == (np.asarray(batched) >= cutoff))),
    'sample_count': len(scores), 'probability_tolerance': .02,
    'batch_single_tolerance': 1e-6,
    'gpu_reference': 'Frozen selected candidate validation scores from float32 CUDA inference.',
}
(OUTPUT / 'cpu-benchmark.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))

if (report['max_probability_difference'] > report['probability_tolerance']
        or report['batch_max_single_difference'] > report['batch_single_tolerance']
        or report['batch_max_probability_difference'] > report['probability_tolerance']
        or not report['class_agreement'] or not report['batch_class_agreement']
        or not report['single_batch_class_agreement']):
    raise RuntimeError('Selected CPU predictions differ beyond the accepted numerical tolerance.')
