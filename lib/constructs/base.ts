import { Construct } from "constructs";
import {
  Vpc,
  GatewayVpcEndpointAwsService,
  InterfaceVpcEndpointOptions,
  InterfaceVpcEndpointAwsService,
  InterfaceVpcEndpoint,
} from "aws-cdk-lib/aws-ec2";

export interface BaseProps {}

export class Base extends Construct {
  readonly vpc: Vpc;
  readonly endpointsForECS: InterfaceVpcEndpoint[];

  constructor(scope: Construct, id: string, props?: BaseProps) {
    super(scope, id);

    // prettier-ignore
    this.vpc = new Vpc(this, "Vpc", { natGateways: 0,restrictDefaultSecurityGroup: true});

    const s3Endpoint = this.vpc.addGatewayEndpoint("S3Endpoint", {
      service: GatewayVpcEndpointAwsService.S3,
    });

    // prettier-ignore
    const endpointOptionsForECS: {[name: string]: InterfaceVpcEndpointOptions;} = {
      EcrEndpoint: {
        service: InterfaceVpcEndpointAwsService.ECR,
        // lookupSupportedAzs: true,
        // subnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}
      },
      EcrdkrEndpoint: {
        service: InterfaceVpcEndpointAwsService.ECR_DOCKER,
        // lookupSupportedAzs: true,
        // subnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}
      },
      LogsEndpoint: {
        service: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
        // lookupSupportedAzs: true,
        // subnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}
      },
      SsmEndpoint: {
        service: InterfaceVpcEndpointAwsService.SSM,
        // lookupSupportedAzs: true,
        // subnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}
      },
      SsmMessagesEndpoint: {
        service: InterfaceVpcEndpointAwsService.SSM_MESSAGES,
        // lookupSupportedAzs: true,
        // subnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}
      },
      SecretsManagerEndpoint: {
        service: InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        // lookupSupportedAzs: true,
        // subnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}
      },
    };

    // this.endpointsForECS: InterfaceVpcEndpoint[] = [];
    this.endpointsForECS = [];
    for (const [name, options] of Object.entries(endpointOptionsForECS)) {
      const endpoint = this.vpc.addInterfaceEndpoint(name, options);
      this.endpointsForECS.push(endpoint);
    }

  }
}
