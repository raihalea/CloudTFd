# Welcome to your CDK TypeScript project

CTFdをCDKでAWSにデプロイするもの
ログインとChallengeは簡単に確認しました。
CloudFrontのキャッシュ部分が悪さをする可能性がありますが、ちゃんと検証できていません。

- /lib/config/settings.ts.copyをsettings.tsにコピーして中身を埋める
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

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
