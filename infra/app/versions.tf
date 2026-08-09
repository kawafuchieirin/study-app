terraform {
  required_version = ">= 1.8.0"
  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 5.0" }
    archive = { source = "hashicorp/archive", version = "~> 2.5" }
  }

  backend "s3" {
    key          = "manabi/app/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region
  default_tags { tags = { Project = var.project_name, Environment = var.environment, ManagedBy = "Terraform" } }
}
