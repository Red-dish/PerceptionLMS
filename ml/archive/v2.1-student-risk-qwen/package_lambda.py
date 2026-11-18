"""Assemble a sanitized, CPU-only Lambda container context from the frozen winner."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct

import numpy as np

from workflow import ROOT, FEATURES, load, split

SOURCE = ROOT / 'lambda_src'
OUTPUT = ROOT / 'outputs/qwen-lambda-package'
OPTIMIZATION = ROOT / 'outputs/qwen-optimization'
MODEL_FILES = ('LICENSE', 'chat_template.jinja', 'config.json', 'generation_config.json',
               'joint_head.safetensors', 'joint_head_config.json', 'joint_schema_model.py',
               'model.safetensors', 'processor_config.json', 'tokenizer.json',
               'tokenizer_config.json', 'unsloth_decision_config.json')
FORBIDDEN_TEXT = ('/home/', '/Users/', '/tmp/')
GPU_MODEL_PATTERN = re.compile(r'\b(?:NVIDIA\s+GeForce|RTX\s+\d{4})\b', re.IGNORECASE)


def sha256(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')


def safetensors_metadata(path):
    with path.open('rb') as stream:
        size = struct.unpack('<Q', stream.read(8))[0]
        header = json.loads(stream.read(size))
    return header.get('__metadata__', {})


def copy_sanitized_model(source, destination):
    destination.mkdir()
    for name in MODEL_FILES:
        shutil.copyfile(source / name, destination / name)
    config = json.loads((destination / 'config.json').read_text())
    config['model_name'] = 'student-risk-qwen35-0.8b'
    write_json(destination / 'config.json', config)
    decision = json.loads((destination / 'unsloth_decision_config.json').read_text())
    decision['base_model'] = 'student-risk-qwen35-0.8b'
    write_json(destination / 'unsloth_decision_config.json', decision)
    loader_path = destination / 'joint_schema_model.py'
    loader = loader_path.read_text()
    replacements = {
        '    from huggingface_hub import snapshot_download\n': '',
        '        path = Path(snapshot_download(str(model_path)))':
            '        raise FileNotFoundError("A local packaged model directory is required.")',
        'device: str | torch.device = "cuda"': 'device: str | torch.device = "cpu"',
        'dtype: torch.dtype = torch.bfloat16': 'dtype: torch.dtype = torch.float32',
        'processor = AutoProcessor.from_pretrained(path)':
            'processor = AutoProcessor.from_pretrained(path, local_files_only=True)',
    }
    for original, replacement in replacements.items():
        if loader.count(original) != 1:
            raise ValueError(f'Unexpected exported loader content: {original!r}')
        loader = loader.replace(original, replacement)
    loader_path.write_text(loader)
    for name in ('model.safetensors', 'joint_head.safetensors'):
        metadata = safetensors_metadata(destination / name)
        if metadata not in ({}, {'format': 'pt'}):
            raise ValueError(f'Unexpected Safetensors metadata in {name}: {metadata}')
        if sha256(destination / name) != sha256(source / name):
            raise ValueError(f'Weight copy changed {name}.')


def scan_bundle(path):
    """Reject local paths and accelerator-identifying text outside tokenizer vocabulary."""
    findings = []
    for file in sorted(path.rglob('*')):
        if not file.is_file() or file.suffix == '.safetensors' or file.name == 'tokenizer.json':
            continue
        text = file.read_text(errors='strict')
        lowered = text.lower()
        for token in FORBIDDEN_TEXT:
            if token.lower() in lowered:
                findings.append(f'{file.relative_to(path)}: {token}')
        if GPU_MODEL_PATTERN.search(text):
            findings.append(f'{file.relative_to(path)}: accelerator model identifier')
        if 'cuda' in lowered:
            findings.append(f'{file.relative_to(path)}: accelerator runtime reference')
    if findings:
        raise ValueError('Host-specific bundle content: ' + '; '.join(findings))
    for file in path.rglob('*'):
        if '__pycache__' in file.parts or file.suffix == '.pyc':
            raise ValueError(f'Interpreter cache included in bundle: {file}')


def build():
    freeze = json.loads((OPTIMIZATION / 'selection-freeze.json').read_text())
    if freeze['selected_candidate'] != 'qwen_control' or not freeze['baseline_retained']:
        raise ValueError('The assembler expects the preregistered Qwen control winner.')
    source_model = ROOT / freeze['selected_checkpoint']
    if sha256(source_model / 'model.safetensors') != freeze['selected_merged_model_sha256']:
        raise ValueError('Selected model weights differ from the selection freeze.')
    if OUTPUT.exists():
        raise FileExistsError(f'Package already exists: {OUTPUT}')
    staging = OUTPUT.with_name(OUTPUT.name + '.tmp')
    if staging.exists():
        raise FileExistsError(f'Staging directory already exists: {staging}')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(SOURCE, staging, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    copy_sanitized_model(source_model, staging / 'model')

    package_config = {
        'schema_version': 1, 'model_name': 'unsloth/Qwen3.5-0.8B',
        'model_revision': '23c69c53358a07516b5827588b3fdb12ae78fd65',
        'validation_cutoff': freeze['validation_cutoff'], 'features': FEATURES,
        'inference_device': 'cpu', 'inference_dtype': 'float32',
        'inference_batch_size': 4, 'max_students_per_request': 32,
        'offline_loading': True, 'weights_format': 'safetensors',
    }
    write_json(staging / 'model/package_config.json', package_config)

    _, validation, _ = split(load(ROOT / 'outputs/students_synthetic.csv'))
    fixture_rows = validation.head(4)
    with np.load(ROOT / freeze['selected_scores'], allow_pickle=False) as scores:
        expected = scores['validation_probabilities'][:4].tolist()
    students = [{'student_id': str(row.student_id),
                 **{name: float(row[name]) for name in FEATURES}}
                for _, row in fixture_rows.iterrows()]
    write_json(staging / 'tests/smoke.json', {'students': students,
        'expected_probabilities': expected, 'threshold': freeze['validation_cutoff'],
        'inference_batch_size': 4})

    selection = json.loads((OPTIMIZATION / 'development-selection.json').read_text())
    control = next(row for row in selection['candidates'] if row['name'] == 'qwen_control')
    final = json.loads((OPTIMIZATION / 'final-report.json').read_text())
    final_metrics = final['results']['qwen_control']
    manifest = {
        'schema_version': 1, 'package': 'student-risk-qwen-lambda',
        'model': {'name': package_config['model_name'], 'revision': package_config['model_revision'],
                  'backbone_safetensors_sha256': sha256(staging / 'model/model.safetensors'),
                  'decision_head_safetensors_sha256': sha256(staging / 'model/joint_head.safetensors')},
        'selection': {'candidate': 'qwen_control', 'rank': 16, 'learning_rate': .0002,
                      'epochs': 3, 'validation_cutoff': freeze['validation_cutoff'],
                      'development_fixed_precision': control['development']['fixed_cutoff']['precision'],
                      'development_fixed_recall': control['development']['fixed_cutoff']['recall'],
                      'development_matched_precision': control['development']['matched_recall']['precision']},
        'reserved_final_evaluation': {'fixed_precision': final_metrics['fixed_cutoff']['precision'],
            'fixed_recall': final_metrics['fixed_cutoff']['recall'],
            'matched_precision': final_metrics['matched_recall']['precision'],
            'matched_recall': final_metrics['matched_recall']['recall'],
            'pr_auc': final_metrics['fixed_cutoff']['pr_auc'],
            'brier_score': final_metrics['fixed_cutoff']['brier_score'],
            'operational_target_met': final['selected_operational_target_met']},
        'lambda': {'handler': 'lambda_handler.handler', 'architecture': 'x86_64',
                   'memory_mb': 8192, 'timeout_seconds': 60, 'runtime': 'python3.14',
                   'deployment_performed': False},
        'sanitization': {'local_paths_removed': True, 'host_metadata_included': False,
                         'accelerator_metadata_included': False,
                         'weight_files_byte_identical': True},
        'limitations': ['Synthetic evaluation only; real student data is unavailable.',
                        'Final fixed-cutoff recall missed the 70% operational target.',
                        'Production-shaped package; not promoted or deployed.'],
    }
    files = {str(file.relative_to(staging)): sha256(file)
             for file in sorted(staging.rglob('*')) if file.is_file()}
    manifest['files'] = files
    write_json(staging / 'package-manifest.json', manifest)
    all_files = {str(file.relative_to(staging)): sha256(file)
                 for file in sorted(staging.rglob('*')) if file.is_file()}
    (staging / 'SHA256SUMS').write_text(''.join(
        f'{digest}  {name}\n' for name, digest in all_files.items()))
    scan_bundle(staging)
    staging.rename(OUTPUT)
    print(json.dumps({'package': str(OUTPUT.relative_to(ROOT)),
                      'model': manifest['model'], 'lambda': manifest['lambda'],
                      'files_hashed': len(all_files), 'sanitization_scan': 'passed'}, indent=2))
    return manifest


if __name__ == '__main__':
    build()
