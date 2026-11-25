import json
import unittest

from student_risk import FEATURES, RequestError, normalize_student, score_event, serialize

VALID = {'student_id': 'S1', 'attendance_pct': 82.5, 'quiz_average': 76,
         'missed_assignments': 2, 'weekly_logins': 5, 'days_since_login': 1}


class FakeRuntime:
    def __init__(self):
        self.batch_size = None

    def probabilities(self, states, batch_size):
        self.batch_size = batch_size
        return [.25 + .1 * index for index in range(len(states))]


class StudentRiskRequestTests(unittest.TestCase):
    def test_direct_event_and_feature_serialization(self):
        runtime = FakeRuntime()
        result = score_event(runtime, {'students': [VALID]}, threshold=.3)
        self.assertEqual(runtime.batch_size, 4)
        self.assertEqual(result, [{'student_id': 'S1', 'probability': .25,
                                   'predicted_at_risk': False}])
        _, values = normalize_student(VALID, 0)
        self.assertEqual(len(serialize(values).splitlines()), len(FEATURES))
        self.assertNotIn('student_id', serialize(values))

    def test_api_gateway_body(self):
        event = {'body': json.dumps({'students': [VALID, VALID]})}
        result = score_event(FakeRuntime(), event, threshold=.3)
        self.assertEqual([row['probability'] for row in result], [.25, .35])
        self.assertEqual([row['predicted_at_risk'] for row in result], [False, True])

    def test_invalid_requests(self):
        cases = [None, {}, {'students': []}, {'students': 'invalid'},
                 {'body': '{not json}'}, {'students': [None]}]
        for event in cases:
            with self.subTest(event=event), self.assertRaises(RequestError):
                score_event(FakeRuntime(), event, threshold=.5)
        for field, value in [('attendance_pct', 101), ('quiz_average', -1),
                             ('weekly_logins', 1.5), ('missed_assignments', -1),
                             ('days_since_login', float('nan')), ('quiz_average', True)]:
            student = {**VALID, field: value}
            with self.subTest(field=field, value=value), self.assertRaises(RequestError):
                score_event(FakeRuntime(), {'students': [student]}, threshold=.5)

    def test_batch_limit(self):
        with self.assertRaises(RequestError):
            score_event(FakeRuntime(), {'students': [VALID, VALID]},
                        threshold=.5, max_students=1)


if __name__ == '__main__':
    unittest.main()
