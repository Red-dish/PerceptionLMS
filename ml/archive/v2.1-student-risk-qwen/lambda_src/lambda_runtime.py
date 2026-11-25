"""Offline CPU inference for the packaged Safetensors decision checkpoint."""
import importlib.util
import json
from pathlib import Path
import sys

import torch

QUESTION = {'at_risk': {'type': 'noul', 'instructions':
    'Based on these student engagement and performance measurements, is this student at risk of needing academic support?'}}


class StudentRiskModel:
    def __init__(self, checkpoint):
        checkpoint = Path(checkpoint).resolve()
        spec = importlib.util.spec_from_file_location(
            'student_risk_clef', checkpoint / 'joint_schema_model.py')
        self.clef = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = self.clef
        previous_write_bytecode = sys.dont_write_bytecode
        sys.dont_write_bytecode = True
        try:
            spec.loader.exec_module(self.clef)
        finally:
            sys.dont_write_bytecode = previous_write_bytecode
        self.model, self.processor = self.clef.load_release_model(
            checkpoint, device='cpu', dtype=torch.float32, local_files_only=True,
            attn_implementation='sdpa')
        self.config = json.loads((checkpoint / 'unsloth_decision_config.json').read_text())
        self.temperature = self.config['temperature'][2] * self.config.get('head_temperature', 1.0)

    @torch.inference_mode()
    def probabilities(self, states, batch_size=4):
        probabilities = []
        for start in range(0, len(states), batch_size):
            records = [self.clef.encode_record(self.processor.tokenizer,
                {'state': text, 'questions': QUESTION}, max_length=self.config['max_len'],
                processor=self.processor) for text in states[start:start + batch_size]]
            batch = self.clef.collate_records(records, self.processor.tokenizer.pad_token_id,
                                              torch.device('cpu'))
            logits = torch.stack([row[0] for row in self.model(batch)])
            positive = [record.questions[0].option_ids.index('true') for record in records]
            probability = (logits.float() / self.temperature).softmax(-1)
            probabilities.extend(probability[torch.arange(len(records)), positive].cpu().tolist())
        return probabilities
