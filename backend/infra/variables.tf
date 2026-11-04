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

variable "frontend_domain" {
  description = "Web address of the frontend, without https://. Also the name of its S3 bucket, which only one environment can own."
  type        = string
  default     = "perceptionlms.com"
}

variable "cloudflare_ipv4_ranges" {
  description = "Addresses allowed to read the frontend bucket. Update from https://www.cloudflare.com/ips-v4/ if Cloudflare changes them."
  type        = list(string)
  default = [
    "173.245.48.0/20",
    "103.21.244.0/22",
    "103.22.200.0/22",
    "103.31.4.0/22",
    "141.101.64.0/18",
    "108.162.192.0/18",
    "190.93.240.0/20",
    "188.114.96.0/20",
    "197.234.240.0/22",
    "198.41.128.0/17",
    "162.158.0.0/15",
    "104.16.0.0/13",
    "104.24.0.0/14",
    "172.64.0.0/13",
    "131.0.72.0/22",
  ]
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
