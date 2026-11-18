import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from optimize_qwen import (CANDIDATES, CONTROL, development_eligible, expected_preregistration,
                           save_scores, select_candidate, selection_key, sha256_file, sha256_tree,
                           validate_candidate_manifest, validate_score_npz)


def result(name, recall=.72, precision=.75, matched=.76, pr_auc=.82):
    return {'name': name, 'development': {
        'fixed_cutoff': {'recall': recall, 'precision': precision, 'pr_auc': pr_auc},
        'matched_recall': {'precision': matched, 'recall': .7002}}}


class SelectionTests(unittest.TestCase):
    def test_eligibility_enforces_operational_recall(self):
        self.assertTrue(development_eligible(result(CONTROL, recall=.70)))
        self.assertFalse(development_eligible(result(CONTROL, recall=.70 - 1e-6)))

    def test_ineligible_high_precision_candidate_cannot_win(self):
        results = [result(row['name']) for row in CANDIDATES]
        results[0] = result(CONTROL, precision=.80)
        results[1] = result(CANDIDATES[1]['name'], recall=.699, precision=.99)
        results[2] = result(CANDIDATES[2]['name'], precision=.82)
        selection = select_candidate(results)
        self.assertEqual(selection['selected_candidate'], CANDIDATES[2]['name'])
        self.assertNotIn(CANDIDATES[1]['name'], selection['eligible_candidates'])

    def test_tie_breakers_and_strict_control_rule(self):
        results = [result(row['name'], precision=.70, matched=.70, pr_auc=.70) for row in CANDIDATES]
        results[0] = result(CONTROL, precision=.80, matched=.80, pr_auc=.80)
        results[1] = result(CANDIDATES[1]['name'], precision=.81, matched=.80, pr_auc=.99)
        results[2] = result(CANDIDATES[2]['name'], precision=.81, matched=.81, pr_auc=.80)
        self.assertEqual(select_candidate(results)['selected_candidate'], CANDIDATES[2]['name'])
        results[2] = result(CANDIDATES[2]['name'], precision=.81, matched=.80, pr_auc=.98)
        self.assertEqual(select_candidate(results)['selected_candidate'], CANDIDATES[1]['name'])
        for index in range(1, len(results)):
            results[index] = result(CANDIDATES[index]['name'], precision=.80, matched=.80, pr_auc=.80)
        selection = select_candidate(results)
        self.assertEqual(selection['selected_candidate'], CONTROL)
        self.assertTrue(selection['baseline_retained'])

    def test_selection_requires_exact_preregistered_candidates(self):
        with self.assertRaises(ValueError):
            select_candidate([result(CONTROL)])
        with self.assertRaises(ValueError):
            select_candidate([result(row['name']) for row in CANDIDATES] + [result('late_candidate')])


class HashingTests(unittest.TestCase):
    def test_file_and_tree_hashes_change_with_content(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            artifact = root / 'weights.bin'
            artifact.write_bytes(b'abc')
            self.assertEqual(sha256_file(artifact), hashlib.sha256(b'abc').hexdigest())
            before = sha256_tree(root)
            (root / 'config.json').write_text('{}')
            self.assertNotEqual(sha256_tree(root), before)
            artifact.write_bytes(b'def')
            self.assertNotEqual(sha256_tree(root), before)
            stable = sha256_tree(root)
            cache = root / '__pycache__'
            cache.mkdir()
            (cache / 'generated.cpython-312.pyc').write_bytes(b'runtime cache')
            self.assertEqual(sha256_tree(root), stable)


class ArtifactValidationTests(unittest.TestCase):
    def setUp(self):
        self.validation = pd.DataFrame({'student_id': ['V1', 'V2', 'V3'], 'at_risk': [0, 1, 1]})
        self.development = pd.DataFrame({'student_id': ['D1', 'D2', 'D3', 'D4'],
                                         'at_risk': [0, 1, 0, 1]})

    def test_score_dimensions_ids_labels_and_bounds(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'scores.npz'
            save_scores(path, self.validation, self.development, [.1, .8, .7], [.2, .9, .3, .6])
            dimensions = validate_score_npz(path, self.validation, self.development)
            self.assertEqual(dimensions['validation_probabilities'], [3])
            self.assertEqual(dimensions['development_probabilities'], [4])
            with np.load(path, allow_pickle=False) as scores:
                arrays = {name: scores[name] for name in scores.files}
            arrays['development_ids'] = np.array(['D1', 'D2', 'D3', 'WRONG'])
            np.savez_compressed(path, **arrays)
            with self.assertRaises(ValueError):
                validate_score_npz(path, self.validation, self.development)
            arrays['development_ids'] = self.development.student_id.to_numpy(dtype=str)
            arrays['validation_probabilities'] = np.array([.1, np.nan, .7])
            np.savez_compressed(path, **arrays)
            with self.assertRaises(ValueError):
                validate_score_npz(path, self.validation, self.development)

    def test_manifest_requires_preregistration_batch_and_recalibration(self):
        preregistration = expected_preregistration()
        config = CANDIDATES[1]
        manifest = {
            'name': config['name'], 'config': config, 'model': preregistration['model'],
            'source_dataset_sha256': preregistration['source_dataset']['sha256'],
            'development_dataset_sha256': 'abc', 'calibration': {'merged': {'loss': .4}},
            'training': {'batch_size': 8, 'gradient_accumulation_steps': 1,
                         'effective_batch_size': 8},
            'artifacts': {}, 'scores_sha256': 'def', 'measurements': {},
        }
        self.assertTrue(validate_candidate_manifest(manifest, preregistration))
        changed = {**manifest, 'training': {**manifest['training'], 'effective_batch_size': 16}}
        with self.assertRaises(ValueError):
            validate_candidate_manifest(changed, preregistration)
        changed = {**manifest, 'calibration': {}}
        with self.assertRaises(ValueError):
            validate_candidate_manifest(changed, preregistration)
        changed = {**manifest, 'config': {**config, 'learning_rate': .001}}
        with self.assertRaises(ValueError):
            validate_candidate_manifest(changed, preregistration)


if __name__ == '__main__':
    unittest.main()
