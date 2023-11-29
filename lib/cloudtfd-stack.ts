import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Base } from "./constructs/base";
import { BucketWithAccessKey } from "./constructs/bucket";
import { Database } from "./constructs/database";
import { Redis } from "./constructs/redis";
import { Mail } from "./constructs/mail";
import { ApplicationPatterns } from "./constructs/application-patterns";
import { Waf } from "./constructs/waf";
import { Cdn } from "./constructs/cdn";

export class CloudTFdStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const base = new Base(this, "Base");
    const bucketWithAccessKey = new BucketWithAccessKey(this, "Default");
    const database = new Database(this, "Database", { vpc: base.vpc });
    const redis = new Redis(this, "Redis", { vpc: base.vpc });
    // const main = new Mail(this, "Mail")
    const ctfd = new ApplicationPatterns(this, "ApplicationPatterns", {
      vpc: base.vpc,
      bucketWithAccessKey,
      endpointsForECS: base.endpointsForECS,
      database,
      redis,
    });
    const waf = new Waf(this, "Waf");
    const cdn = new Cdn(this, "Cdn", {
      bucketWithAccessKey,
      webAclId: waf.webAclId,
    });
  }
}
