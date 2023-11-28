import { Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ARecord, AaaaRecord, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import {
  CacheCookieBehavior,
  CacheHeaderBehavior,
  CacheQueryStringBehavior,
  Distribution,
  AllowedMethods,
  ViewerProtocolPolicy,
  OriginRequestPolicy,
  CachePolicy,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestQueryStringBehavior,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin, S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { BucketWithAccessKey } from "./bucket";
import { Domain } from "./utils/domain";
import { domainConfig, basicAuthConfig } from "../config/config";
import { BasicAuth } from "./basic-auth";

export interface CdnProps {
  readonly bucketWithAccessKey: BucketWithAccessKey;
  readonly webAclId?: string;
}

export class Cdn extends Construct {
  readonly distributionArn: string;

  constructor(scope: Construct, id: string, props: CdnProps) {
    super(scope, id);

    const { bucketWithAccessKey, webAclId } = props;

    const ctfDomain = new Domain(this, "Domain", {
      hostname: domainConfig.HOSTNAME,
      domain: domainConfig.DOMAIN_NAME,
    });

    const cachePolicy = new CachePolicy(this, "myCachePolicy", {
      defaultTtl: Duration.days(2),
      minTtl: Duration.minutes(1),
      maxTtl: Duration.days(10),
      cookieBehavior: CacheCookieBehavior.none(),
      headerBehavior: CacheHeaderBehavior.allowList(
        "Host",
        "CloudFront-Forwarded-Proto"
      ),
      queryStringBehavior: CacheQueryStringBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const testPolicy = new CachePolicy(this, "test", {
      defaultTtl: Duration.days(2),
      minTtl: Duration.minutes(1),
      maxTtl: Duration.days(10),
      cookieBehavior: CacheCookieBehavior.none(),
      headerBehavior: CacheHeaderBehavior.allowList(
        "Host",
        "CloudFront-Forwarded-Proto"
      ),
      queryStringBehavior: CacheQueryStringBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const allViewRequestPolicy = new OriginRequestPolicy(this, "TestRequestPolicy",{
      cookieBehavior: OriginRequestCookieBehavior.all(),
      headerBehavior: OriginRequestHeaderBehavior.denyList("Authorization"),
      queryStringBehavior: OriginRequestQueryStringBehavior.all(),
    })

    // prettier-ignore
    const albOrigin = new HttpOrigin(`${domainConfig.ALB_HOSTNAME}.${domainConfig.DOMAIN_NAME}`)
    const s3Origin = new S3Origin(bucketWithAccessKey.bucket);
    const basicAuth = new BasicAuth(this, "BasicAuth");
    const functionAssociations = basicAuthConfig.IsEnabled ? [basicAuth.functionAssociation] : [];

    // prettier-ignore
    const distribution = new Distribution(this, "CloudFront", {
      defaultBehavior: {
        origin: albOrigin,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        originRequestPolicy: allViewRequestPolicy,
        cachePolicy: cachePolicy,
        compress: true,
        functionAssociations: functionAssociations
      },
      additionalBehaviors: {
        "themes/*": {
          origin: albOrigin,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: allViewRequestPolicy,
          compress: true,
        },
        "api/*": {
          origin: albOrigin,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: cachePolicy,
          originRequestPolicy: allViewRequestPolicy,
          compress: true,
          functionAssociations: functionAssociations
        },
        "admin/*": {
          origin: albOrigin,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          originRequestPolicy: allViewRequestPolicy,
          cachePolicy: cachePolicy,
          compress: true,
          functionAssociations: functionAssociations
        },
        "files/*": {
          origin: albOrigin,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: allViewRequestPolicy,
          compress: true,
          functionAssociations: functionAssociations
        },
        // "files/*": {
        //   origin: s3Origin,
        //   viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        //   cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        //   originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
        //   compress: true,
        //   functionAssociations: functionAssociations
        // }
      },
      domainNames: [ctfDomain.fqdn],
      certificate: ctfDomain.certificate,
      webAclId
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
