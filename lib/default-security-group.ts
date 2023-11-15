import { SecurityGroup, SecurityGroupProps } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class NoOutboundTrafficSecurityGroup extends SecurityGroup {
  constructor(scope: Construct, id: string, props: SecurityGroupProps) {
    super(scope, id, {
      ...props,
      allowAllOutbound: false,
    });
  }
}
