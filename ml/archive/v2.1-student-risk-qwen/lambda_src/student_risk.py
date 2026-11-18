"""Request validation and feature serialization for student-risk inference."""
import json
import math

FEATURES = ('attendance_pct', 'quiz_average', 'missed_assignments',
            'weekly_logins', 'days_since_login')
INTEGER_FEATURES = frozenset(FEATURES[2:])


class RequestError(ValueError):
    """An inference request is malformed or outside the supported input domain."""


def parse_payload(event):
    if not isinstance(event, dict):
        raise RequestError('The event must be a JSON object.')
    payload = event
    if 'body' in event:
        payload = event['body']
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except json.JSONDecodeError as error:
                raise RequestError('The request body must contain valid JSON.') from error
    if not isinstance(payload, dict):
        raise RequestError('The request body must be a JSON object.')
    students = payload.get('students')
    if not isinstance(students, list):
        raise RequestError('students must be a nonempty list.')
    return students


def normalize_student(record, index):
    if not isinstance(record, dict):
        raise RequestError(f'Student {index + 1} must be a JSON object.')
    identifier = record.get('student_id', f'ROW-{index + 1:04d}')
    if isinstance(identifier, bool) or not isinstance(identifier, (str, int)):
        raise RequestError(f'Student {index + 1} has an invalid student_id.')
    identifier = str(identifier)
    if not identifier or len(identifier) > 128:
        raise RequestError(f'Student {index + 1} student_id must contain 1 to 128 characters.')
    values = {}
    for name in FEATURES:
        value = record.get(name)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise RequestError(f'Student {index + 1} field {name} must be numeric.')
        value = float(value)
        if not math.isfinite(value):
            raise RequestError(f'Student {index + 1} field {name} must be finite.')
        if name in INTEGER_FEATURES:
            if value < 0 or not value.is_integer():
                raise RequestError(f'Student {index + 1} field {name} must be a nonnegative integer.')
        elif not 0 <= value <= 100:
            raise RequestError(f'Student {index + 1} field {name} must be between 0 and 100.')
        values[name] = value
    return identifier, values


def serialize(values):
    return '\n'.join(f'{name}: {values[name]:g}' for name in FEATURES)


def score_event(runtime, event, *, threshold, max_students=32, batch_size=4):
    students = parse_payload(event)
    if not students:
        raise RequestError('students must be a nonempty list.')
    if len(students) > max_students:
        raise RequestError(f'A request may contain at most {max_students} students.')
    normalized = [normalize_student(record, index) for index, record in enumerate(students)]
    states = [serialize(values) for _, values in normalized]
    probabilities = runtime.probabilities(states, batch_size=batch_size)
    if len(probabilities) != len(normalized):
        raise RuntimeError('The model returned an unexpected number of scores.')
    predictions = []
    for (identifier, _), probability in zip(normalized, probabilities, strict=True):
        probability = float(probability)
        if not math.isfinite(probability) or not 0 <= probability <= 1:
            raise RuntimeError('The model returned an invalid probability.')
        predictions.append({'student_id': identifier, 'probability': probability,
                            'predicted_at_risk': probability >= threshold})
    return predictions
