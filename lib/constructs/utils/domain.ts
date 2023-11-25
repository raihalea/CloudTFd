import { Construct } from "constructs";
import { HostedZone, IHostedZone } from "aws-cdk-lib/aws-route53";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";

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
