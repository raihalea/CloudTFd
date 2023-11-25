import { Construct } from "constructs";
import {
  ConfigurationSet,
  SuppressionReasons,
  ConfigurationSetTlsPolicy,
  EmailIdentity,
  Identity,
} from "aws-cdk-lib/aws-ses";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { domainConfig } from "../config/config";

export interface MailProps {}

export class Mail extends Construct {
  constructor(scope: Construct, id: string, props?: MailProps) {
    super(scope, id);

    const mailDomain = `${domainConfig.MAIL}.${domainConfig.DOMAIN_NAME}`;
    const hostedZone = HostedZone.fromLookup(this, "Domain", {
      domainName: domainConfig.DOMAIN_NAME,
    });

    const configurationSet = new ConfigurationSet(this, "ConfigurationSet", {
      // customTrackingRedirectDomain: domainConfig.DOMAIN_NAME,
      suppressionReasons: SuppressionReasons.BOUNCES_AND_COMPLAINTS,
      tlsPolicy: ConfigurationSetTlsPolicy.REQUIRE,
      reputationMetrics: true,
    });

    const identity = new EmailIdentity(this, "Identity", {
      identity: Identity.publicHostedZone(hostedZone),
      mailFromDomain: mailDomain,
      configurationSet,
    });
  }
}
