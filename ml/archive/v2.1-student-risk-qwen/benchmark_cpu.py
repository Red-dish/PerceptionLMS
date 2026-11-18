"""Run the exported decision checkpoint with CPU-only visibility."""
import os
os.environ['CUDA_VISIBLE_DEVICES'] = ''
os.environ['UNSLOTH_FORCE_CPU'] = '1'
os.environ['UNSLOTH_DECISION_COMPILE'] = '0'

import json
import resource
import time

from cpu_runtime import StudentRiskModel
import torch
from workflow import ROOT, load, split, state

torch.set_num_threads(4)
start = time.perf_counter()
runtime = StudentRiskModel(ROOT / 'outputs/merged')
load_seconds = time.perf_counter() - start
frame = split(load(ROOT / 'outputs/students_synthetic.csv'))[2].head(10)
states = [state(row) for _, row in frame.iterrows()]
scores, durations = [], []
for text in states:
    start = time.perf_counter()
    score = runtime.probability(text)
    durations.append(time.perf_counter() - start)
    scores.append(score)
# Exercise padding and batched logit extraction, not only the single-record wrapper.
batched = runtime.probabilities(states, batch_size=4)
reference = json.loads((ROOT / 'outputs/predictions.json').read_text())['predictions'][:10]
if [row['student_id'] for row in reference] != list(frame.student_id):
    raise ValueError('Saved predictions do not match the benchmark students.')
report = {'device': str(next(runtime.model.parameters()).device), 'threads': 4, 'load_seconds': load_seconds,
    'peak_ram_mb': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024,
    'first_inference_seconds': durations[0], 'warm_mean_seconds': sum(durations[1:]) / len(durations[1:]),
    'max_probability_difference': max(abs(row['probability'] - score) for row, score in zip(reference, scores, strict=True)),
    'class_agreement': all(row['predicted_at_risk'] == (score >= .5) for row, score in zip(reference, scores, strict=True)),
    'batch_size': 4,
    'batch_max_single_difference': max(abs(single - batch) for single, batch in zip(scores, batched, strict=True)),
    'batch_max_probability_difference': max(abs(row['probability'] - score) for row, score in zip(reference, batched, strict=True)),
    'batch_class_agreement': all(row['predicted_at_risk'] == (score >= .5) for row, score in zip(reference, batched, strict=True)),
    'sample_count': len(scores), 'probability_tolerance': .02}
(ROOT / 'outputs/cpu-benchmark.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))

if (report['max_probability_difference'] > report['probability_tolerance']
        or report['batch_max_single_difference'] > report['probability_tolerance']
        or report['batch_max_probability_difference'] > report['probability_tolerance']
        or not report['class_agreement'] or not report['batch_class_agreement']):
    raise RuntimeError('Reloaded CPU predictions differ beyond the accepted numerical tolerance.')
