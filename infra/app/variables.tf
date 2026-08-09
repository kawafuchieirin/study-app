variable "project_name" {
  type    = string
  default = "manabi"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "aws_region" {
  type    = string
  default = "ap-northeast-1"
}

variable "frontend_url" {
  type    = string
  default = "https://manabi-study.k06en23.chatgpt.site"
}

variable "bedrock_model_id" {
  type    = string
  default = "amazon.nova-lite-v1:0"
}
