# Manabi

学習計画、振り返り、要点ノート、AI解説、苦手問題のグルーピングを一つにつなぐ学習管理アプリです。

## 構成

- React / Vinext: 学習ダッシュボード
- Python / FastAPI / AWS Lambda: API
- Amazon Cognito: ログイン
- DynamoDB: 学習データ
- Amazon Bedrock: AI解説
- Terraform: AWSインフラとGitHub OIDC

## ローカル起動

```bash
pnpm install
pnpm dev
```

## AWSへの初回セットアップ

GitHub ActionsはOIDCでAWSへ接続するため、長期アクセスキーは不要です。最初に一度だけ管理者権限を持つローカルAWSプロファイルでbootstrapを実行します。

```bash
cd infra/bootstrap
terraform init
terraform apply
```

出力された値をGitHub Repositoryの `Settings > Environments` に登録します。

- `production` と `plan` のEnvironmentを作成
- `production` の `AWS_DEPLOY_ROLE_ARN`: `github_deploy_role_arn` の値
- `plan` の `AWS_PLAN_ROLE_ARN`: `github_plan_role_arn` の値
- 両方の `TF_STATE_BUCKET`: `terraform_state_bucket` の値

既存のGitHub OIDC Providerを再利用する構成です。ProviderがまだないAWSアカウントでは、bootstrap時に `-var=create_github_oidc_provider=true` を指定します。

## CI/CD

- Pull Request: 読み取り専用OIDCロールでTerraform format/validate/plan
- `main` へのマージ: OIDCでAWSロールを引き受け、Terraform apply
- AWSリソース: Cognito、DynamoDB、Lambda、API Gateway、IAM、CloudWatch Logs

`production` EnvironmentにRequired reviewersを設定すると、本番apply前にGitHub上で承認できます。
