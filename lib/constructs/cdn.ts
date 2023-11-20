import { Construct } from "constructs";
import { CfnReplicationGroup } from "aws-cdk-lib/aws-elasticache";
import { IApplicationLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import {
  HostedZone,
  ARecord,
  AaaaRecord,
  RecordTarget,
} from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import {
  OriginProtocolPolicy,
  Distribution,
  AllowedMethods,
  ViewerProtocolPolicy,
  OriginRequestPolicy,
  CachePolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { LoadBalancerV2Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { cdnConfig } from "../config/config";

export interface CdnProps {
  readonly lb: IApplicationLoadBalancer;
}

export class Cdn extends Construct {
  readonly elasticache_redis: CfnReplicationGroup;

  constructor(scope: Construct, id: string, props: CdnProps) {
    super(scope, id);

    const { lb } = props;

    // prettier-ignore

    const ctfRecord: string = cdnConfig.RECORD;
    const ctfDomain: string = `${ctfRecord}.${cdnConfig.DOMAIN_NAME}`;
    const hostedZone = HostedZone.fromLookup(this, "Domain", {
      domainName: cdnConfig.DOMAIN_NAME,
    });

    const certificate = new Certificate(this, "Cert", {
      domainName: ctfDomain,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    // prettier-ignore
    const origin = new LoadBalancerV2Origin(
      lb,
      { protocolPolicy: OriginProtocolPolicy.HTTP_ONLY }
    )
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
      domainNames: [ctfDomain],
      certificate,
    });

    new ARecord(this, "ARecord", {
      recordName: `${ctfRecord}`,
      zone: hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });
    new AaaaRecord(this, "AaaaRecord", {
      recordName: `${ctfRecord}`,
      zone: hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });
  }
}
