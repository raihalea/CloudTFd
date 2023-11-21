import { Construct } from "constructs";
import { CfnReplicationGroup } from "aws-cdk-lib/aws-elasticache";
import { IApplicationLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import {
  HostedZone,
  IHostedZone,
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
import { domainConfig } from "../config/config";

export interface DomainProps {
  readonly hostname: string;
  readonly domain: string;
}

export class Domain extends Construct {
  readonly hostedZone: IHostedZone;
  readonly certificate: Certificate;
  readonly fqdn: string;

  constructor(scope: Construct, id: string, props: DomainProps) {
    super(scope, id);

    const { hostname, domain } = props;

    // prettier-ignore

    // const ctfRecord: string = domainConfig.RECORD;
    this.fqdn = `${hostname}.${domain}`;
    this.hostedZone = HostedZone.fromLookup(this, "Domain", {
      domainName: domain,
    });

    this.certificate = new Certificate(this, "Cert", {
      domainName: this.fqdn,
      validation: CertificateValidation.fromDns(this.hostedZone),
    });

  }
}
