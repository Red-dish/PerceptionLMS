output "api_url" {
  description = "Base URL of the API. The frontend calls this."
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "ecr_repository_url" {
  description = "Where Podman pushes the API image."
  value       = aws_ecr_repository.api.repository_url
}

output "table_name" {
  value = aws_dynamodb_table.data.name
}

output "bucket_name" {
  value = aws_s3_bucket.files.bucket
}
