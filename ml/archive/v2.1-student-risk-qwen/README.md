# Student-risk ML

## Current state

- Training and evaluation use 2,000 synthetic students because `students_demo.csv` is unavailable.
- The active LMS `GET /analytics/student-risk-demo` endpoint serves saved Qwen predictions; it does not perform live model inference.
- The controlled Qwen sweep retained the original rank-16, learning-rate-0.0002, three-epoch Qwen3.5-0.8B control.
- A sanitized, CPU-only Lambda image containing that control is packaged and tested locally. It has not been pushed, promoted, connected to the LMS, or deployed.
- Only the production Lambda Safetensors weights are retained. Original baseline and unselected challenger weights were removed after evaluation; selection/final metrics and pruning metadata remain. Residual per-candidate directories and old TabICL binaries were also removed.
- The frozen validation cutoff is `0.5285671949386597`. Final synthetic fixed-cutoff recall was **68.80%**, below the 70% operational target.

## Setup and data

Run training and analysis from the repository root with the existing Python 3.12 environment and local GPU. The separate Lambda package uses Python 3.14; these environments are intentionally distinct.

```bash
uv venv --python 3.12 ml/student-risk/.venv
uv pip sync --python ml/student-risk/.venv/bin/python ml/student-risk/requirements.lock
ml/student-risk/.venv/bin/python ml/student-risk/workflow.py
```

**The baseline command regenerates model artifacts and the active synthetic LMS demo.** Do not run it against the current outputs unless replacement is intended. Optimization and packaging workflows write to separate directories.

The generator creates reproducible fictional records in fixed cohorts of 1,000. Engagement drives correlated measurements, a logistic function defines risk probability, and Bernoulli sampling produces noisy binary labels. The original dataset contains 2,000 unique students and uses seed 3407 for a fixed 1,400/300/300 train/validation/test split. Repeated student IDs remain in one partition.

Required numeric columns are:

1. `attendance_pct`, range 0–100
2. `quiz_average`, range 0–100
3. `missed_assignments`, nonnegative integer
4. `weekly_logins`, nonnegative integer
5. `days_since_login`, nonnegative integer

The target is binary `at_risk`. `student_id` is optional. Missing or invalid values require correction; dated records with changing labels need a temporal policy. To train on a supplied dataset:

```bash
ml/student-risk/.venv/bin/python ml/student-risk/workflow.py --csv /path/to/students_demo.csv
```

`student-risk.ipynb` uses Polars for CSV exploration and result tables while model interfaces retain their dataframe adapters. Its existing `RUN_TRAINING=False` setting is unchanged.

## Training and evaluation policy

The Qwen control uses base revision `23c69c53358a07516b5827588b3fdb12ae78fd65`, 4-bit loading, rank-16 LoRA with alpha 16, three epochs, learning rate 0.0002, seed 3407, 512-token sequences, and effective batch eight. Merged deployment weights are reloaded and recalibrated on validation data before evaluation.

Operational thresholds are the highest cutoffs reaching at least 70% recall on the original 300 validation records. Applying such a cutoff to another cohort does not guarantee 70% recall. Matched-recall precision is a separate descriptive ranking metric calculated from each evaluation cohort's precision-recall curve, including complete tied-score groups. Evaluation-derived matched-recall cutoffs are never deployment thresholds.

## Verification

From `ml/student-risk`:

```bash
.venv/bin/python -m unittest test_workflow test_precision test_optimization
PYTHONPATH=lambda_src .venv/bin/python -m unittest discover -s lambda_src/tests -p 'test_*.py'
```

These cover six original tests, seven optimization tests, and four package request tests. The earlier full optimization audit passed before pruning and is now marked `superseded_by_pruning`; it cannot rerun against deleted candidate directories.

The historical CPU harness uses the Python 3.12 experiment dependencies. **The original non-production weights have been pruned, so these scripts require regenerating those artifacts before they can run again.** The current production image smoke test does not need them. After regeneration, run from the repository root:

```bash
podman run --rm --network=none --memory=8g --cpus=4 \
  -v "$PWD:/work" -w /work/ml/student-risk \
  -e PYTHONPATH=/work/ml/student-risk/.venv/lib/python3.12/site-packages \
  docker.io/library/python:3.12-slim-bookworm python benchmark_cpu.py
```

Substitute `benchmark_qwen_optimization_cpu.py` for the frozen optimization control or `benchmark_tabicl_cpu.py --tuned` for the experimental TabICL artifact. These are local container checks, not AWS latency measurements. The current Python 3.14 Lambda image has its own smoke-test instructions in `lambda_src/README.md`.

## Results

### Original held-out demonstration

On the original 300-record test set at Qwen's default 0.50 cutoff, accuracy was 83.3%, precision 79.8%, recall 70.8%, F1 75.0%, and PR-AUC 84.8%. Logistic regression achieved 84.7% accuracy and 72.6% recall. On a separate 1,000-student cohort from seed 9817, expanding training from 1,000 to 2,000 records increased Qwen accuracy from 81.8% to 82.9% and recall from 61.8% to 69.7%.

The effective-batch-eight training benchmark processed 96.0 examples/s with physical batch eight; the complete run averaged 55.6 examples/s including compilation and validation. These measurements describe the training environment and are not deployment benchmarks.

### Earlier TabICL comparison

The earlier comparison used 5,000 development students from seed 63407 and a final 10,000-student cohort from seed 73407. The tuned TabICL candidate used 32 ensemble members and learning rate 0.00003. Final matched-recall measurements reached approximately 70.016% recall.

| Model | Validation cutoff | Matched-recall precision | Fixed-cutoff precision | Fixed-cutoff recall |
| --- | ---: | ---: | ---: | ---: |
| Qwen | 0.528567 | 80.77% | 80.43% | 70.40% |
| Default TabICLv2 | 0.602703 | 83.83% | 85.10% | 66.97% |
| Tuned TabICLv2 | 0.617173 | 83.69% | 86.21% | 64.03% |
| Logistic regression | 0.568895 | 84.19% | 84.76% | 68.59% |

Tuned minus default TabICL matched-recall precision was -0.14 percentage points, with a paired-bootstrap 95% interval of -0.66 to +0.46. Fine-tuning is therefore not an established improvement over default TabICL. Its higher fixed-cutoff precision came with recall below 70%. These previously inspected cohorts were not reused for Qwen candidate selection.

### Controlled Qwen development selection

The Qwen optimization workflow is implemented in `optimize_qwen.py`. Seven challengers varied only learning rate, epochs, or LoRA rank while the other control settings remained fixed. Every challenger was merged and recalibrated before scoring. Development eligibility required at least 70% fixed-cutoff recall on 5,000 new students from seed 83407. Selection then used fixed-cutoff precision, matched-recall precision, and PR-AUC, with the saved Qwen control included.

| Candidate | Rank | LR | Epochs | Validation cutoff | Fixed precision | Fixed recall | Matched precision | PR-AUC | Eligible |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |
| **Qwen control** | 16 | 0.0002 | 3 | 0.528567 | **80.91%** | 71.26% | **81.20%** | 0.8435 | Yes |
| `r16_lr5e-05_e3` | 16 | 0.00005 | 3 | 0.522743 | 79.73% | 70.44% | 80.13% | 0.8344 | Yes |
| `r16_lr1e-04_e3` | 16 | 0.0001 | 3 | 0.531866 | 80.63% | 69.29% | 80.13% | 0.8397 | No |
| `r16_lr3e-04_e3` | 16 | 0.0003 | 3 | 0.587520 | 82.70% | 66.70% | 80.84% | 0.8404 | No |
| `r16_lr2e-04_e2` | 16 | 0.0002 | 2 | 0.590408 | 79.33% | 70.66% | 79.77% | 0.8376 | Yes |
| `r16_lr2e-04_e4` | 16 | 0.0002 | 4 | 0.514138 | 80.89% | 70.00% | 80.89% | 0.8452 | Yes |
| `r8_lr2e-04_e3` | 8 | 0.0002 | 3 | 0.513972 | 79.47% | 72.31% | 80.13% | 0.8423 | Yes |
| `r32_lr2e-04_e3` | 32 | 0.0002 | 3 | 0.500238 | 79.38% | 72.14% | 80.68% | 0.8410 | Yes |

All matched-recall rows reached exactly 70%. The LR-0.0003 challenger had higher fixed precision but was ineligible because recall fell to 66.70%. No eligible challenger beat the control, so the original checkpoint was retained. There was no final challenger-versus-control comparison or bootstrap because only the retained control was evaluated on the reserved final cohort.

The original experiment sequence was `optimize_qwen.py sweep`, `final`, then `audit`. The final cohort and report now exist; the final command intentionally refuses to generate another cohort or repeat that evaluation.

### Reserved Qwen final evaluation

After selection and cutoff freezing, 10,000 students were generated once with seed 93407. At the frozen validation cutoff, the retained control produced:

| Measurement | Result |
| --- | ---: |
| Fixed-cutoff precision | 80.25% |
| Fixed-cutoff recall | **68.80%** |
| Accuracy | 82.72% |
| F1 | 74.09% |
| PR-AUC | 0.832969 |
| Brier score | 0.123509 |
| TN / FP / FN / TP | 5,802 / 608 / 1,120 / 2,470 |
| Descriptive matched-recall precision | 79.25% |
| Actual matched recall | 70.00% |
| Descriptive matched-recall cutoff | 0.5097193717956543 |

The final operational target was missed. The lower matched-recall cutoff is descriptive and was not substituted for the frozen cutoff. This is a no-preferable-challenger result, not an established improvement or a final evaluation of an unevaluated challenger.

### CPU verification summary

| Benchmark | Peak RAM | Load | Warm mean | Maximum score difference | Agreement |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline saved predictions | 5,879 MiB | 2.83 s | 0.636 s | 0.0011 | 10/10 |
| Frozen optimization control | 5,877 MiB | 2.830 s | 0.634 s | 0.000000179 | 10/10 |

Both used four CPUs, 8 GB RAM, and networking disabled. The optimization benchmark compared the exported control runtime with cached float32 CUDA validation scores at the frozen cutoff; single-record and batch-of-four parity also passed. These rows use different references and are not a model-quality comparison.

## Lambda package

The selected Qwen control is packaged in `outputs/qwen-lambda-package/` with byte-identical Safetensors backbone and decision-head weights, calibration, tokenizer files, a CPU-only offline loader, and the `lambda_handler.handler` entrypoint. The stable base is the publisher's non-experimental Python 3.14.10 `3.14-x86_64` image, pinned by digest. Local training paths, host identifiers, accelerator metadata, and accelerator runtime packages are excluded from the portable artifact.

The portable image is `outputs/qwen-student-risk-lambda-image.tar`; its current identity, hashes, size, Python version, and verification results are recorded in `outputs/qwen-lambda-image-report.json`.

**Package build, request schema, smoke tests, and limitations have one editable source: `lambda_src/README.md`.** The copy at `outputs/qwen-lambda-package/README.md` is generated from that source by `package_lambda.py`; do not independently edit the generated copy. The current local image tag is `localhost/student-risk-qwen:safetensors`. The build context is self-contained; rerunning the assembler itself requires the pruned original weights and is not necessary to rebuild this image.

The package is production-shaped, not production-approved. The final recall miss and synthetic-data limitations still apply.

## Artifact map

| Artifact | Purpose |
| --- | --- |
| `outputs/merged/`, `outputs/adapters/` | Original control metadata and tokenizer files; Safetensors weights pruned |
| `outputs/manifest.json`, `outputs/predictions.json` | Original training provenance and saved predictions |
| `outputs/precision-benchmark/` | Earlier comparison reports and score arrays; fitted TabICL binaries pruned |
| `outputs/qwen-optimization/` | Selection, final, and pruning reports; per-candidate directories and all candidate weights pruned |
| `outputs/qwen-lambda-package/` | Generated Lambda container build context |
| `outputs/qwen-student-risk-lambda-image.tar` | Portable OCI image archive |
| `outputs/qwen-lambda-image-report.json` | Current image and archive verification |

Generated adapter model cards and per-candidate files are artifact contents, not separately maintained documentation. Their duplication is intentional and covered by artifact hashes.

## Limitations

All reported outcomes use synthetic labels. The logistic generator gives logistic regression a structural advantage and Bernoulli sampling adds irreducible noise. Real-student predictive validity, fairness, outreach policy, AWS cold starts, concurrency, and production latency remain unverified. No real data collection, production promotion, backend/frontend change, AWS infrastructure change, or deployment was performed.
