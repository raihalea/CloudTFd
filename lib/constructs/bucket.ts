import { RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { User, AccessKey } from "aws-cdk-lib/aws-iam";

export interface BucketWithAccessKeyProps {}

export class BucketWithAccessKey extends Construct {
  readonly bucket: Bucket;
  readonly s3AccessKey: AccessKey;
  readonly s3SecretAccessKey: Secret;

  constructor(scope: Construct, id: string, props?: BucketWithAccessKeyProps) {
    super(scope, id);

    this.bucket = new Bucket(this, "S3", {
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const user = new User(this, "S3User");
    this.s3AccessKey = new AccessKey(this, "S3AccessKey", { user });
    // prettier-ignore
    this.s3SecretAccessKey = new Secret(this, "S3SecretAccessKey", {
      secretStringValue: this.s3AccessKey.secretAccessKey,
    });
    this.bucket.grantReadWrite(user);
  }
}
