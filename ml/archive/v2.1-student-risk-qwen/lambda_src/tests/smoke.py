"""Run packaged model inference and compare its synthetic validation fixture."""
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, os.environ.get('LAMBDA_TASK_ROOT', '/var/task'))
import lambda_handler

fixture = json.loads(Path(__file__).with_name('smoke.json').read_text())
response = lambda_handler.handler({'students': fixture['students']}, None)
if response['statusCode'] != 200:
    raise RuntimeError(response)
payload = json.loads(response['body'])
predictions = payload['predictions']
if len(predictions) != len(fixture['expected_probabilities']):
    raise RuntimeError('Smoke response has the wrong number of predictions.')
differences = [abs(row['probability'] - expected) for row, expected in
               zip(predictions, fixture['expected_probabilities'], strict=True)]
classifications = [row['predicted_at_risk'] == (expected >= fixture['threshold'])
                   for row, expected in zip(predictions, fixture['expected_probabilities'], strict=True)]
report = {'status': 'passed' if max(differences) <= .02 and all(classifications) else 'failed',
          'sample_count': len(predictions), 'max_probability_difference': max(differences),
          'classification_agreement': all(classifications),
          'batch_size': fixture['inference_batch_size']}
print(json.dumps(report, indent=2))
if report['status'] != 'passed':
    raise RuntimeError('Packaged model smoke test failed.')
