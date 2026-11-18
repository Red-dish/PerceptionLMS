import unittest
from benchmark_precision import recall_operating_point


class PrecisionTests(unittest.TestCase):
    def test_cutoff_meets_recall_and_handles_ties(self):
        labels = [1, 0, 1, 0]
        scores = [.9, .8, .8, .1]
        point = recall_operating_point(labels, scores, target=1)
        self.assertEqual(point['threshold'], .8)
        self.assertEqual(point['recall'], 1)
        self.assertAlmostEqual(point['precision'], 2 / 3)
        higher = recall_operating_point(labels, scores, target=.5)
        self.assertEqual(higher['threshold'], .9)

    def test_invalid_probabilities_and_no_positive_labels(self):
        for labels, scores in [([0, 0], [.1, .2]), ([0, 1], [.1, float('nan')]),
                               ([0, 1], [.1, 2]), ([0, 1], [.1])]:
            with self.subTest(labels=labels, scores=scores), self.assertRaises(ValueError):
                recall_operating_point(labels, scores)


if __name__ == '__main__':
    unittest.main()
