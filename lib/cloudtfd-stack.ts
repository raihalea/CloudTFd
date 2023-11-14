import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";

export class CloudTFdStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "VPC", {
      natGateways: 0,
    });

    vpc.addGatewayEndpoint("s3_endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });
    vpc.addInterfaceEndpoint("ecr_endpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
    });
    vpc.addInterfaceEndpoint("ecrdkr_endpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
    });

    vpc.addInterfaceEndpoint("logs_endpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
    });
    vpc.addInterfaceEndpoint("ssm_endpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
    });
    vpc.addInterfaceEndpoint("ssmmessages_endpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
    });
    vpc.addInterfaceEndpoint("secretsmanager_endpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });

    const DB_USERNAME = "ctfd";

    const db_cluster = new rds.DatabaseCluster(this, "Database", {
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
      serverlessV2MaxCapacity: 32,
      serverlessV2MinCapacity: 0.5,
      storageEncrypted: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, //
    });

    // const db_pass = cdk.SecretValue.secretsManager(
    //   db_cluster.secret!.secretArn,
    //   { jsonField: "password" }
    // ).unsafeUnwrap();
    // const database_url = new secretsmanager.Secret(this, "db_secrets", {
    //   secretStringValue: cdk.SecretValue.unsafePlainText(
    //     `mysql+pymysql://${DB_USERNAME}:${db_pass}@${db_cluster.clusterEndpoint.socketAddress}/ctfd`
    //   ),
    // });

    const redisSG = new ec2.SecurityGroup(this, "RedisSecurityGroup", {
      vpc,
      description: "Allow redis access from server",
      allowAllOutbound: false,
    });

    const subnetGroup = new elasticache.CfnSubnetGroup(
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
    const redis_auth = new secretsmanager.Secret(this, "RedisSecret", {
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
        cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
        automaticFailoverEnabled: true,
        multiAzEnabled: true,
        atRestEncryptionEnabled: true,
        transitEncryptionEnabled: true,
        transitEncryptionMode: "required",
        authToken: cdk.SecretValue.secretsManager(redis_auth.secretArn, {
          jsonField: "password",
        }).unsafeUnwrap(),
        port: REDIS_PORT,
      }
    );
    elasticache_redis.addDependency(subnetGroup);

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
    });

    const loadBalancedFargateService =
      new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Service", {
        cluster,
        memoryLimitMiB: 1024,
        desiredCount: 1,
        cpu: 512,
        taskImageOptions: {
          image: ecs.ContainerImage.fromAsset("./CTFd"),
          environment: {
            DATABASE_USER: DB_USERNAME,
            DATABASE_HOST: db_cluster.clusterEndpoint.hostname,
            DATABASE_PORT: String(db_cluster.clusterEndpoint.port),
            REDIS_PROTOCOL: "rediss",
            REDIS_HOST: elasticache_redis.attrPrimaryEndPointAddress,
            REDIS_PORT: elasticache_redis.attrPrimaryEndPointPort,
            ACCESS_LOG: "-",
            ERROR_LOG: "-",
            REVERSE_PROXY: "true",
          },
          secrets: {
            DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(
              db_cluster.secret!,
              "password"
            ),
            REDIS_PASSWORD: ecs.Secret.fromSecretsManager(
              redis_auth,
              "password"
            ),
          },
          containerPort: 8000,
        },
        enableExecuteCommand: true,
        // taskSubnets: {
        //   subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        // },
      });

    db_cluster.connections.allowFrom(
      loadBalancedFargateService.service,
      ec2.Port.tcp(db_cluster.clusterEndpoint.port),
      "Allow inbound DB connection"
    );

    loadBalancedFargateService.service.node.addDependency(elasticache_redis);
    redisSG.connections.allowFrom(
      loadBalancedFargateService.service,
      ec2.Port.tcp(elasticache_redis.port!),
      "Allow inbound Redis connection"
    );

    loadBalancedFargateService.targetGroup.configureHealthCheck({
      path: "/healthcheck",
    });
  }
}
