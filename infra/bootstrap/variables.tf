variable "project_name" {
  type    = string
  default = "manabi"
}

variable "aws_region" {
  type    = string
  default = "ap-northeast-1"
}

variable "github_owner" {
  type    = string
  default = "kawafuchieirin"
}

variable "github_repository" {
  type    = string
  default = "study-app"
}

variable "github_branch" {
  type    = string
  default = "main"
}

variable "create_github_oidc_provider" {
  description = "False when the AWS account already has the GitHub Actions OIDC provider."
  type        = bool
  default     = false
}
