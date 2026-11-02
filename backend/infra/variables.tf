variable "region" {
  description = "AWS region to deploy to."
  type        = string
  default     = "ap-southeast-2"
}

variable "name" {
  description = "Prefix for every resource name."
  type        = string
  default     = "perception-lms"
}

variable "environment" {
  description = "Environment name, e.g. dev or prod. Part of every resource name."
  type        = string
  default     = "dev"
}

variable "google_client_id" {
  description = "OAuth client ID (type \"Web application\") from Google Cloud console."
  type        = string
}

variable "admin_emails" {
  description = "Google emails that become admins on their first sign-in."
  type        = list(string)
  default     = []
}

variable "allowed_origins" {
  description = "Web addresses of the frontend that may call the API and upload files."
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "allowed_domain" {
  description = "If set, only Google Workspace accounts from this domain can sign in."
  type        = string
  default     = ""
}

variable "image_tag" {
  description = "Tag of the API image in ECR to deploy."
  type        = string
  default     = "latest"
}

variable "log_retention_days" {
  description = "How long to keep API logs."
  type        = number
  default     = 30
}
