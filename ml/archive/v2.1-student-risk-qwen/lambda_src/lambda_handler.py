"""AWS Lambda entrypoint; model initialization occurs once at module load."""
import json
import os
from pathlib import Path

import torch

from lambda_runtime import StudentRiskModel
from student_risk import RequestError, score_event

MODEL_PATH = Path(os.environ.get('MODEL_PATH', '/opt/model'))
CONFIG = json.loads((MODEL_PATH / 'package_config.json').read_text())
torch.set_num_threads(int(os.environ.get('OMP_NUM_THREADS', '4')))
MODEL = StudentRiskModel(MODEL_PATH)


def response(status, payload):
    return {'statusCode': status,
            'headers': {'Content-Type': 'application/json', 'Cache-Control': 'no-store'},
            'body': json.dumps(payload, allow_nan=False)}


def handler(event, context):
    try:
        predictions = score_event(
            MODEL, event, threshold=CONFIG['validation_cutoff'],
            max_students=CONFIG['max_students_per_request'],
            batch_size=CONFIG['inference_batch_size'])
    except RequestError as error:
        return response(400, {'error': str(error)})
    return response(200, {'model_revision': CONFIG['model_revision'],
                          'threshold': CONFIG['validation_cutoff'],
                          'predictions': predictions})
