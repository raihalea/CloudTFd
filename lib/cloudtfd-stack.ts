import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { NoOutboundTrafficSecurityGroup } from "./default-security-group";
import { AwsManagedPrefixList } from "./aws-managed-prefix-list";
import { domainName } from "./config/settings";

export class CloudTFdStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // prettier-ignore
    const vpc = new ec2.Vpc(this, "Vpc", { natGateways: 0,restrictDefaultSecurityGroup: true});

    const s3Endpoint = vpc.addGatewayEndpoint("S3Endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // prettier-ignore
    const endpointOptionsForECS: {[name: string]: ec2.InterfaceVpcEndpointOptions;} = {
      EcrEndpoint: {
        service: ec2.InterfaceVpcEndpointAwsService.ECR,
        // lookupSupportedAzs: true,
        // subnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}
      },
      EcrdkrEndpoint: {
        service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
        // lookupSupportedAzs: true,
        // subnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}
      },
      LogsEndpoint: {
        service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
        // lookupSupportedAzs: true,
        // subnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}
      },
      SsmEndpoint: {
        service: ec2.InterfaceVpcEndpointAwsService.SSM,
        // lookupSupportedAzs: true,
        // subnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}
      },
      SsmMessagesEndpoint: {
        service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
        // lookupSupportedAzs: true,
        // subnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}
      },
      SecretsManagerEndpoint: {
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        // lookupSupportedAzs: true,
        // subnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}
      },
    };

    const endpointsForECS: ec2.InterfaceVpcEndpoint[] = [];
    for (const [name, options] of Object.entries(endpointOptionsForECS)) {
      const endpoint = vpc.addInterfaceEndpoint(name, options);
      endpointsForECS.push(endpoint);
    }

    const bucket = new s3.Bucket(this, "S3", {
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const user = new iam.User(this, "S3User");
    const s3AccessKey = new iam.AccessKey(this, "S3AccessKey", { user });
    // prettier-ignore
    const s3SecretAccessKey = new secretsmanager.Secret(this, "S3SecretAccessKey", {
      secretStringValue: s3AccessKey.secretAccessKey,
    });
    bucket.grantReadWrite(user);

    const DB_USERNAME = "ctfd";

    // prettier-ignore
    const dbClusterSecurityGroup = new NoOutboundTrafficSecurityGroup(
      this, "DbSecurityGroup", { vpc,}
    );

    const dbCluster = new rds.DatabaseCluster(this, "Db", {
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_3_04_0,
      }),
      credentials: rds.Credentials.fromGeneratedSecret(DB_USERNAME),
      writer: rds.ClusterInstance.serverlessV2("writer", {
        caCertificate: rds.CaCertificate.RDS_CA_ECC384_G1,
      }),
      readers: [
        // rds.ClusterInstance.serverlessV2("reader1", {
        //   caCertificate: rds.CaCertificate.RDS_CA_ECC384_G1,
        //   scaleWithWriter: true,
        // }),
      ],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      vpc,
      securityGroups: [dbClusterSecurityGroup],
      serverlessV2MaxCapacity: 32,
      serverlessV2MinCapacity: 0.5,
      storageEncrypted: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, //
    });

    // prettier-ignore
    const redisSG = new NoOutboundTrafficSecurityGroup(
      this, "RedisSecurityGroup", { vpc });

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(
      this,
      "ClusterSubnetGroup",
      {
        cacheSubnetGroupName: "redis-subnet-group",
        subnetIds: vpc.isolatedSubnets.map(({ subnetId }) => subnetId),
        description: "redis-subnet-group",
      }
    );

    const REDIS_USER = "ctfd";
    const REDIS_PORT = 6379;
    const redisAuth = new secretsmanager.Secret(this, "RedisSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: REDIS_USER }),
        generateStringKey: "password",
        passwordLength: 32,
        excludePunctuation: true,
      },
    });

    const elasticache_redis = new elasticache.CfnReplicationGroup(
      this,
      "Redis",
      {
        cacheNodeType: "cache.t4g.micro",
        engine: "Redis",
        numNodeGroups: 1,
        replicasPerNodeGroup: 1,
        replicationGroupDescription: "redis cache",
        // engineVersion: '5.0.6', // ARM instance requires minimum Redis for ElastiCache 5.0.6 version.
        securityGroupIds: [redisSG.securityGroupId],
        cacheSubnetGroupName: redisSubnetGroup.cacheSubnetGroupName,
        automaticFailoverEnabled: true,
        multiAzEnabled: true,
        atRestEncryptionEnabled: true,
        transitEncryptionEnabled: true,
        transitEncryptionMode: "required",
        authToken: cdk.SecretValue.secretsManager(redisAuth.secretArn, {
          jsonField: "password",
        }).unsafeUnwrap(),
        port: REDIS_PORT,
      }
    );
    elasticache_redis.addDependency(redisSubnetGroup);

    // prettier-ignore
    const ecsSecurityGroup = new NoOutboundTrafficSecurityGroup(
      this, "EcsSecurityGroup", { vpc });

    // prettier-ignore
    const cluster = new ecs.Cluster(this, "Cluster", { vpc });

    // prettier-ignore
    const loadBalancedFargateService =
      new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Service", {
        cluster,
        memoryLimitMiB: 1024,
        desiredCount: 1,
        cpu: 512,
        taskImageOptions: {
          image: ecs.ContainerImage.fromAsset("./CTFd", {
            platform: ecrAssets.Platform.LINUX_ARM64
          }),
          environment: {
            // AWS_S3_CUSTOM_DOMAIN : 
            UPLOAD_PROVIDER: "s3",
            AWS_ACCESS_KEY_ID: s3AccessKey.accessKeyId,
            AWS_S3_BUCKET: bucket.bucketName,
            DATABASE_USER: DB_USERNAME,
            DATABASE_HOST: dbCluster.clusterEndpoint.hostname,
            DATABASE_PORT: String(dbCluster.clusterEndpoint.port),
            REDIS_PROTOCOL: "rediss",
            REDIS_HOST: elasticache_redis.attrPrimaryEndPointAddress,
            REDIS_PORT: elasticache_redis.attrPrimaryEndPointPort,
            ACCESS_LOG: "-",
            ERROR_LOG: "-",
            REVERSE_PROXY: "true",
          },
          secrets: {
            AWS_SECRET_ACCESS_KEY: ecs.Secret.fromSecretsManager( s3SecretAccessKey ),
            DATABASE_PASSWORD: ecs.Secret.fromSecretsManager( dbCluster.secret!, "password"),
            REDIS_PASSWORD: ecs.Secret.fromSecretsManager( redisAuth, "password" ),
          },
          containerPort: 8000,
        },
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.ARM64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
        // enableExecuteCommand: true,
        openListener: false,
        securityGroups: [ecsSecurityGroup],
        // taskSubnets: {
        //   subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        // },
      });

    loadBalancedFargateService.targetGroup.configureHealthCheck({
      path: "/healthcheck",
    });

    loadBalancedFargateService.service.node.addDependency(elasticache_redis);

    endpointsForECS.forEach((endpoint) => {
      endpoint.connections.allowFrom(ecsSecurityGroup, ec2.Port.tcp(443));
    });

    // prettier-ignore
    const s3PrefixList = new AwsManagedPrefixList( this, "S3PrefixList",
      { name: `com.amazonaws.${this.region}.s3` }
    ).prefixList;

    ecsSecurityGroup.addEgressRule(
      ec2.Peer.prefixList(s3PrefixList.prefixListId),
      ec2.Port.tcp(80)
    );

    dbCluster.connections.allowFrom(
      loadBalancedFargateService.service,
      ec2.Port.tcp(dbCluster.clusterEndpoint.port),
      "Allow inbound DB connection"
    );

    redisSG.connections.allowFrom(
      loadBalancedFargateService.service,
      ec2.Port.tcp(elasticache_redis.port!),
      "Allow inbound Redis connection"
    );

    // prettier-ignore
    const albSecurityGroup = new NoOutboundTrafficSecurityGroup(
      this, "AlbSecurityGroup", { vpc,}
    );

    // prettier-ignore
    const cloudfrontPrefixList = new AwsManagedPrefixList( this, "CloudfrontOriginPrefixList",
      { name: "com.amazonaws.global.cloudfront.origin-facing" }
    ).prefixList;

    albSecurityGroup.addEgressRule(
      ec2.Peer.prefixList(cloudfrontPrefixList.prefixListId),
      ec2.Port.tcp(443)
    );

    loadBalancedFargateService.loadBalancer.addSecurityGroup(albSecurityGroup);

    const ctfDomain: string = `ctf.${domainName}`;
    const hostedZone = route53.HostedZone.fromLookup(this, "Domain", {
      domainName,
    });

    const certificate = new acm.Certificate(this, "Cert", {
      domainName: ctfDomain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    new cloudfront.Distribution(this, "CloudFront", {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(
          loadBalancedFargateService.loadBalancer,
          { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY }
        ),
      },
      domainNames: [ctfDomain],
      certificate,
    });
  }
}
