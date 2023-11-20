
- CTFdをCDKでAWSにデプロイするもの
- ログインとChallengeは簡単に確認しました。
- CloudFrontのキャッシュ部分が悪さをする可能性がありますが、ちゃんと検証できていません。

- /lib/config/config.ts.copyをconfig.tsにコピーして中身を埋める
  - デプロイするAWSのアカウントIDとリージョン
  - 事前に用意したRoute53のHostedZone

- 作成されるもの
  - VPC / VPC Endpoint
  - ECS / Fargate
  - ECR
  - ALB
  - S3
  - Elasticache for Redis
  - RDS Aurora Serverless
  - CloudFront
  - Route53 records
  - Secrets Manager
  - etc...
