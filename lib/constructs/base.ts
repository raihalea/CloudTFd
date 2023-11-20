import { RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Vpc,
  GatewayVpcEndpointAwsService,
  InterfaceVpcEndpointOptions,
  InterfaceVpcEndpointAwsService,
  InterfaceVpcEndpoint,
} from "aws-cdk-lib/aws-ec2";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { User, AccessKey } from "aws-cdk-lib/aws-iam";

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

    const bucket = new Bucket(this, "S3", {
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const user = new User(this, "S3User");
    const s3AccessKey = new AccessKey(this, "S3AccessKey", { user });
    // prettier-ignore
    const s3SecretAccessKey = new Secret(this, "S3SecretAccessKey", {
      secretStringValue: s3AccessKey.secretAccessKey,
    });
    bucket.grantReadWrite(user);
  }
}
