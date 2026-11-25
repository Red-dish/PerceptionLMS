FROM docker.io/amazon/aws-lambda-python@sha256:ad25d968fbf58fa87d89f9db213390f5563ccb156d005afa428d4d613f32dd8a

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    TOKENIZERS_PARALLELISM=false \
    OMP_NUM_THREADS=4 \
    MODEL_PATH=/opt/model

COPY requirements.txt ${LAMBDA_TASK_ROOT}/requirements.txt
RUN python -m pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

COPY lambda_runtime.py student_risk.py lambda_handler.py ${LAMBDA_TASK_ROOT}/
COPY model/ /opt/model/
COPY tests/ /opt/tests/

CMD ["lambda_handler.handler"]
