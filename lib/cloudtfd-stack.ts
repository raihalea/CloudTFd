import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Base } from "./constructs/base";
import { Database } from "./constructs/database";
import { Redis } from "./constructs/redis";
import { ApplicationPatterns } from "./constructs/application-patterns";
import { Cdn } from "./constructs/cdn";

export class CloudTFdStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const base = new Base(this, "Base");
    const database = new Database(this, "Database", { vpc: base.vpc });
    const redis = new Redis(this, "Redis", { vpc: base.vpc });
    const ctfd = new ApplicationPatterns(this, "ApplicationPatterns", {
      vpc: base.vpc,
      endpointsForECS: base.endpointsForECS,
      database,
      redis,
    });
    const cdn = new Cdn(this, "Cdn");
  }
}
