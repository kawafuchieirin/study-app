output "github_deploy_role_arn" { value = aws_iam_role.github_deploy.arn }
output "github_plan_role_arn" { value = aws_iam_role.github_plan.arn }
output "terraform_state_bucket" { value = aws_s3_bucket.terraform_state.id }
output "aws_region" { value = var.aws_region }
