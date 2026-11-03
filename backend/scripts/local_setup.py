"""Create the DynamoDB table and S3 bucket in the local AWS stand-in started by
`podman run -d --name lms-aws -p 5000:5000 docker.io/motoserver/moto:5.2.5`
(once it exists, `podman start lms-aws`). Safe to run more than once.

    uv run --env-file .env python scripts/local_setup.py

The table layout must match infra/main.tf. The tests use this too.
"""

import os

import boto3

TABLE_SCHEMA = {
    "BillingMode": "PAY_PER_REQUEST",
    "AttributeDefinitions": [
        {"AttributeName": name, "AttributeType": "S"} for name in ("PK", "SK", "GSI1PK", "GSI1SK")
    ],
    "KeySchema": [
        {"AttributeName": "PK", "KeyType": "HASH"},
        {"AttributeName": "SK", "KeyType": "RANGE"},
    ],
    "GlobalSecondaryIndexes": [
        {
            "IndexName": "GSI1",
            "KeySchema": [
                {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
            ],
            "Projection": {"ProjectionType": "ALL"},
        }
    ],
}


def create_resources(table_name: str, bucket_name: str, allowed_origins: list[str]) -> None:
    dynamodb = boto3.client("dynamodb")
    if table_name not in dynamodb.list_tables()["TableNames"]:
        dynamodb.create_table(TableName=table_name, **TABLE_SCHEMA)
        print(f"Created table {table_name}")

    s3 = boto3.client("s3")
    if bucket_name not in {bucket["Name"] for bucket in s3.list_buckets()["Buckets"]}:
        region = s3.meta.region_name
        location = {} if region == "us-east-1" else {"CreateBucketConfiguration": {"LocationConstraint": region}}
        s3.create_bucket(Bucket=bucket_name, **location)
        print(f"Created bucket {bucket_name}")
    if allowed_origins:
        s3.put_bucket_cors(
            Bucket=bucket_name,
            CORSConfiguration={
                "CORSRules": [
                    {"AllowedMethods": ["GET", "POST"], "AllowedOrigins": allowed_origins, "AllowedHeaders": ["*"]}
                ]
            },
        )


if __name__ == "__main__":
    origins = [origin.strip() for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",") if origin.strip()]
    create_resources(os.environ["TABLE_NAME"], os.environ["BUCKET_NAME"], origins)
    print("Local resources are ready.")
