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

## サインイン

本番環境ではAmazon CognitoのAuthorization Code Flowを使用します。

| 項目 | 値 |
| --- | --- |
| AWSリージョン | `ap-northeast-1` |
| User Pool ID | `ap-northeast-1_X2bwaJNLW` |
| App Client ID | `5p8bb519mo27r6m5b0pm0ekp8o` |
| Cognitoドメイン | `https://manabi-prod-154931139855.auth.ap-northeast-1.amazoncognito.com` |
| Callback URL | `https://manabi-study.k06en23.chatgpt.site` |
| API URL | `https://i0iik19kf1.execute-api.ap-northeast-1.amazonaws.com` |

- [サインイン／新規登録](https://manabi-prod-154931139855.auth.ap-northeast-1.amazoncognito.com/oauth2/authorize?client_id=5p8bb519mo27r6m5b0pm0ekp8o&response_type=code&scope=openid+email+profile&redirect_uri=https%3A%2F%2Fmanabi-study.k06en23.chatgpt.site)
- [サインアウト](https://manabi-prod-154931139855.auth.ap-northeast-1.amazoncognito.com/logout?client_id=5p8bb519mo27r6m5b0pm0ekp8o&logout_uri=https%3A%2F%2Fmanabi-study.k06en23.chatgpt.site)

フロントエンド用の環境変数は次のとおりです。

```dotenv
NEXT_PUBLIC_API_URL=https://i0iik19kf1.execute-api.ap-northeast-1.amazonaws.com
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-northeast-1_X2bwaJNLW
NEXT_PUBLIC_COGNITO_CLIENT_ID=5p8bb519mo27r6m5b0pm0ekp8o
NEXT_PUBLIC_COGNITO_DOMAIN=https://manabi-prod-154931139855.auth.ap-northeast-1.amazoncognito.com
```

パスワード、アクセストークン、AWSアクセスキーはREADMEやGitへ保存しないでください。React側ではPKCE付きAuthorization Code Flowを使用し、トークンはブラウザのセッションストレージにのみ保持します。
