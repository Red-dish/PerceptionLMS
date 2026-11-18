# Student-risk Qwen Lambda bundle

This is a CPU-only AWS Lambda container build context. The merged backbone and decision head are stored as Safetensors; no pickle model, training environment, notebook, or accelerator runtime is included. Model initialization occurs at module import and all model reads are local and offline.

## Build

```bash
podman build -t localhost/student-risk-qwen:safetensors .
```

The resulting image uses `lambda_handler.handler`. Start with an x86_64 Lambda configured with 8,192 MB memory and a 60-second timeout. Measure cold starts, concurrency, memory, and batch latency in the target environment before enabling traffic. No deployment configuration is applied by this bundle.

## Request

The handler accepts either a direct event or an API Gateway event whose string `body` contains the same object. A request may contain at most 32 students.

```json
{
  "students": [
    {
      "student_id": "STUDENT-001",
      "attendance_pct": 82.5,
      "quiz_average": 76.0,
      "missed_assignments": 2,
      "weekly_logins": 5,
      "days_since_login": 1
    }
  ]
}
```

A successful response has status 200 and a JSON body containing `model_revision`, the frozen validation `threshold`, and `predictions`. Each prediction contains `student_id`, `probability`, and `predicted_at_risk`. Invalid requests return status 400. Unexpected inference failures propagate to the Lambda runtime.

The five input features are validated with the same domain rules used in training. The decision threshold is the validation-selected cutoff, not a threshold derived from final evaluation data.

## Verification

`SHA256SUMS` covers every bundle file except itself. `package-manifest.json` records model provenance, selected evaluation metrics, runtime settings, and per-file hashes. The two Safetensors weight files are byte-identical to the selected merged checkpoint. Exported JSON metadata is normalized to portable identifiers and the exported loader is restricted to local CPU loading.

Run the pure request-validation tests without loading the model:

```bash
PYTHONPATH=. python -m unittest discover -s tests -p 'test_*.py'
```

Run the model smoke test inside the built image with networking disabled:

```bash
podman run --rm --network=none --memory=8g --cpus=4 \
  --entrypoint python localhost/student-risk-qwen:safetensors /opt/tests/smoke.py
```

The smoke fixture contains synthetic validation examples and expected scores. It checks inference parity, threshold classifications, response structure, and four-record batching.

The stable base is `docker.io/amazon/aws-lambda-python:3.14-x86_64`, pinned to digest `ad25d968fbf58fa87d89f9db213390f5563ccb156d005afa428d4d613f32dd8a` and confirmed as Python 3.14.10. The built image passed this smoke test with four records, maximum probability difference 0.000000149, and complete classification agreement. The image also passed CPU-only package and portable-metadata checks. The OCI archive is 2,314,700,288 bytes with SHA-256 `174320f3a199253aa1fdf54357859309f48d71c9baf6049a19f8902d68eddb80`.

## Limitations

The selected control won the preregistered Qwen development comparison, but its fixed-cutoff recall on the reserved final synthetic cohort was 68.80%, below the 70% operational target. This package is a production-shaped artifact for inspection and testing, not evidence of readiness for real student decisions. All evaluation labels are synthetic because the supplied real dataset is unavailable. The bundle has not been promoted or deployed.
