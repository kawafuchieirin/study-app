# Manabi

学習計画、振り返り、要点ノート、AI解説、苦手問題のグルーピングを一つにつなぐ学習管理アプリです。

## 構成

- React / Vinext: 学習ダッシュボード
- Python / FastAPI / AWS Lambda: API
- Amazon Cognito: ログイン
- DynamoDB: 学習データ
- Amazon Bedrock: AI解説
- AWS SAM: インフラ定義

## ローカル起動

```bash
pnpm install
pnpm dev
```

## AWSへのデプロイ

AWS SAM CLIを設定後、`sam build && sam deploy --guided` を実行します。出力されたCognitoとAPIの値を `.env.local` に設定してください。
