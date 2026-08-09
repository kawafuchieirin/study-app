terraform {
  required_version = ">= 1.8.0"
  backend "s3" {
    key          = "manabi/bootstrap/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
    tls = { source = "hashicorp/tls", version = "~> 4.0" }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = { Project = var.project_name, ManagedBy = "Terraform" }
  }
}
