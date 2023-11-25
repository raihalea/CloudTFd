import { Aws } from "aws-cdk-lib";
import { Construct } from "constructs";
import { InterfaceVpcEndpoint, Peer, Port, IVpc } from "aws-cdk-lib/aws-ec2";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import {
  Cluster,
  ContainerImage,
  Secret as EcsScret,
} from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import { NoOutboundTrafficSecurityGroup } from "./utils/default-security-group";
import { AwsManagedPrefixList } from "./utils/aws-managed-prefix-list";
import { BucketWithAccessKey } from "./bucket";
import { Redis } from "./redis";
import { Database } from "./database";
import { Domain } from "./utils/domain";
import { domainConfig } from "../config/config";

export interface ApplicationPatternsProps {
  readonly vpc: IVpc;
  readonly bucketWithAccessKey: BucketWithAccessKey;
  readonly endpointsForECS: InterfaceVpcEndpoint[];
  readonly database: Database;
  readonly redis: Redis;
}

export class ApplicationPatterns extends Construct {
  constructor(scope: Construct, id: string, props: ApplicationPatternsProps) {
    super(scope, id);

    const { vpc, bucketWithAccessKey, endpointsForECS, database, redis } =
      props;

    // prettier-ignore
    const albSecurityGroup = new NoOutboundTrafficSecurityGroup(
      this, "AlbSecurityGroup", { vpc,}
    );

    // prettier-ignore
    const ecsSecurityGroup = new NoOutboundTrafficSecurityGroup(
      this, "EcsSecurityGroup", { vpc }
    );

    // prettier-ignore
    const ctfdSecretKey = new Secret(this, "CtfdSecretKey", {
      generateSecretString: {
        passwordLength: 32,
      },
    });

    const ctfAlbDomain = new Domain(this, "Domain", {
      hostname: domainConfig.ALB_HOSTNAME,
      domain: domainConfig.DOMAIN_NAME,
    });

    // prettier-ignore
    const cluster = new Cluster(this, "Cluster", { vpc });

    // prettier-ignore
    const loadBalancedFargateService =
    new ApplicationLoadBalancedFargateService(this, "Service", {
      cluster,
      memoryLimitMiB: 1024,
      desiredCount: 1,
      cpu: 512,
      taskImageOptions: {
        image: ContainerImage.fromAsset("./CTFd", {
          // platform: Platform.LINUX_ARM64
        }),
        environment: {
          WORKERS: "4",
          UPLOAD_PROVIDER: "s3",
          AWS_ACCESS_KEY_ID: bucketWithAccessKey.s3AccessKey.accessKeyId,
          AWS_S3_BUCKET: `${bucketWithAccessKey.bucket.bucketName}`,
          // AWS_S3_CUSTOM_DOMAIN: `${domainConfig.HOSTNAME}.${domainConfig.DOMAIN_NAME}`,
          // AWS_S3_CUSTOM_PREFIX: "files/",
          DATABASE_USER: database.DB_USERNAME,
          DATABASE_HOST: database.dbCluster.clusterEndpoint.hostname,
          DATABASE_PORT: String(database.dbCluster.clusterEndpoint.port),
          REDIS_PROTOCOL: "rediss",
          REDIS_HOST: redis.elasticache_redis.attrPrimaryEndPointAddress,
          REDIS_PORT: redis.elasticache_redis.attrPrimaryEndPointPort,
          ACCESS_LOG: "-",
          ERROR_LOG: "-",
          REVERSE_PROXY: "true",
        },
        secrets: {
          SECRET_KEY: EcsScret.fromSecretsManager( ctfdSecretKey ),
          AWS_SECRET_ACCESS_KEY: EcsScret.fromSecretsManager( bucketWithAccessKey.s3SecretAccessKey ),
          DATABASE_PASSWORD: EcsScret.fromSecretsManager( database.dbCluster.secret!, "password"),
          REDIS_PASSWORD: EcsScret.fromSecretsManager( redis.redisAuth, "password" ),
        },
        containerPort: 8000,
      },
      // runtimePlatform: {
      //   cpuArchitecture: CpuArchitecture.ARM64,
      //   operatingSystemFamily: OperatingSystemFamily.LINUX,
      // },
      // enableExecuteCommand: true,
      openListener: false,
      listenerPort: 443,
      domainName: ctfAlbDomain.fqdn,
      domainZone: ctfAlbDomain.hostedZone,
      certificate: ctfAlbDomain.certificate,
      securityGroups: [ecsSecurityGroup],
    });

    loadBalancedFargateService.targetGroup.configureHealthCheck({
      path: "/healthcheck",
    });

    loadBalancedFargateService.service.node.addDependency(
      redis.elasticache_redis
    );

    endpointsForECS.forEach((endpoint) => {
      endpoint.connections.allowFrom(ecsSecurityGroup, Port.tcp(443));
    });

    // prettier-ignore
    const s3PrefixList = new AwsManagedPrefixList( this, "S3PrefixList",
      { name: `com.amazonaws.${Aws.REGION}.s3` }
    ).prefixList;

    ecsSecurityGroup.addEgressRule(
      Peer.prefixList(s3PrefixList.prefixListId),
      Port.tcp(443)
    );

    database.dbCluster.connections.allowFrom(
      loadBalancedFargateService.service,
      Port.tcp(database.dbCluster.clusterEndpoint.port),
      "Allow inbound DB connection"
    );

    redis.redisSG.connections.allowFrom(
      loadBalancedFargateService.service,
      Port.tcp(redis.elasticache_redis.port!),
      "Allow inbound Redis connection"
    );

    // rettier-ignore
    const cloudfrontPrefixList = new AwsManagedPrefixList(
      this,
      "CloudfrontOriginPrefixList",
      { name: "com.amazonaws.global.cloudfront.origin-facing" }
    ).prefixList;

    albSecurityGroup.addIngressRule(
      Peer.prefixList(cloudfrontPrefixList.prefixListId),
      Port.tcp(443)
    );

    loadBalancedFargateService.loadBalancer.addSecurityGroup(albSecurityGroup);
  }
}
