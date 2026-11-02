terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State is kept on your machine by default. To share it with the team, create an S3
  # bucket once, uncomment this block and run `terraform init -migrate-state`.
  # backend "s3" {
  #   bucket       = "perception-lms-terraform-state"
  #   key          = "api/terraform.tfstate"
  #   region       = "ap-southeast-2"
  #   use_lockfile = true
  # }
}
