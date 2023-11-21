import { Construct } from "constructs";
import { CfnReplicationGroup } from "aws-cdk-lib/aws-elasticache";
import { ARecord, AaaaRecord, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import {
  Distribution,
  AllowedMethods,
  ViewerProtocolPolicy,
  OriginRequestPolicy,
  CachePolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Domain } from "./domain";
import { domainConfig } from "../config/config";

export interface CdnProps {}

export class Cdn extends Construct {
  readonly elasticache_redis: CfnReplicationGroup;

  constructor(scope: Construct, id: string, props?: CdnProps) {
    super(scope, id);

    const ctfDomain = new Domain(this, "Domain", {
      hostname: domainConfig.HOSTNAME,
      domain: domainConfig.DOMAIN_NAME,
    });

    // prettier-ignore
    const origin = new HttpOrigin(`${domainConfig.ALB_HOSTNAME}.${domainConfig.DOMAIN_NAME}`)
    // prettier-ignore
    const distribution = new Distribution(this, "CloudFront", {
      defaultBehavior: {
        origin,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        compress: true,
      },
      additionalBehaviors: {
        "themes/*": {
          origin,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022,
          compress: true,
        },
        "files/*": {
          origin,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022,
          compress: true,
        }
      },
      domainNames: [ctfDomain.fqdn],
      certificate: ctfDomain.certificate,
    });

    new ARecord(this, "ARecord", {
      recordName: `${domainConfig.HOSTNAME}`,
      zone: ctfDomain.hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });
    new AaaaRecord(this, "AaaaRecord", {
      recordName: `${domainConfig.HOSTNAME}`,
      zone: ctfDomain.hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });
  }
}
