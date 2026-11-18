import tempfile
import unittest
from pathlib import Path
import numpy as np
import pandas as pd
from workflow import generate, load, split, decision_rows, FEATURES, metrics

class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / 'synthetic.csv'
        self.frame = generate(self.path)

    def test_reproducible_generation(self):
        pd.testing.assert_frame_equal(self.frame, generate(self.path))
        self.assertEqual(len(load(self.path)), 2000)
        self.assertEqual(self.frame.student_id.nunique(), 2000)
        pd.testing.assert_frame_equal(self.frame.iloc[:1000], generate(self.path, count=1000))
        alternate = generate(self.path, seed=63407)
        self.assertFalse(self.frame.equals(alternate))
        pd.testing.assert_frame_equal(alternate, generate(self.path, seed=63407))

    def test_partition_and_target_exclusion(self):
        train, validation, test = split(load(self.path))
        self.assertEqual([len(train), len(validation), len(test)], [1400, 300, 300])
        self.assertFalse(set(train.student_id) & set(test.student_id))
        repeated = pd.concat([self.frame, self.frame.iloc[:10]])
        partitions = split(repeated)
        self.assertFalse(set(partitions[0].student_id) & set(partitions[1].student_id))
        item = decision_rows(train.head(1))[0]
        self.assertNotIn('student_id', item['state'])
        self.assertNotIn('at_risk', item['state'])
        self.assertEqual(len(item['state'].splitlines()), 5)

    def test_invalid_inputs(self):
        for column, value in [('attendance_pct', 101), ('weekly_logins', -1),
                              ('missed_assignments', .5), ('at_risk', 2), ('quiz_average', np.inf)]:
            with self.subTest(column=column):
                frame = self.frame.astype({column: float})
                frame.loc[0, column] = value
                frame.to_csv(self.path, index=False)
                with self.assertRaises(ValueError):
                    load(self.path)

    def test_metrics(self):
        result = metrics([0, 1], [.1, .9])
        self.assertEqual(result['recall'], 1)
        self.assertEqual(result['confusion_matrix'], [[1, 0], [0, 1]])

if __name__ == '__main__':
    unittest.main()
