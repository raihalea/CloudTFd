import { SecretValue } from "aws-cdk-lib";
import { Construct } from "constructs";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import {
  CfnSubnetGroup,
  CfnReplicationGroup,
} from "aws-cdk-lib/aws-elasticache";
import { NoOutboundTrafficSecurityGroup } from "./utils/default-security-group";
import { redisConfig } from "../config/config";

export interface RedisProps {
  readonly vpc: IVpc;
}

export class Redis extends Construct {
  readonly elasticache_redis: CfnReplicationGroup;
  readonly redisAuth: Secret;
  readonly redisSG: NoOutboundTrafficSecurityGroup;

  constructor(scope: Construct, id: string, props: RedisProps) {
    super(scope, id);

    const { vpc } = props;

    // prettier-ignore
    this.redisSG = new NoOutboundTrafficSecurityGroup(
      this, "RedisSecurityGroup", { vpc }
    );

    const redisSubnetGroup = new CfnSubnetGroup(this, "ClusterSubnetGroup", {
      cacheSubnetGroupName: "redis-subnet-group",
      subnetIds: vpc.isolatedSubnets.map(({ subnetId }) => subnetId),
      description: "redis-subnet-group",
    });

    this.redisAuth = new Secret(this, "RedisSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: redisConfig.DB_USER }),
        generateStringKey: "password",
        passwordLength: 128,
        excludePunctuation: true,
      },
    });

    this.elasticache_redis = new CfnReplicationGroup(this, "Redis", {
      cacheNodeType: "cache.t4g.micro",
      engine: "Redis",
      numNodeGroups: 1,
      replicasPerNodeGroup: 1,
      replicationGroupDescription: "redis cache",
      // engineVersion: '5.0.6', // ARM instance requires minimum Redis for ElastiCache 5.0.6 version.
      securityGroupIds: [this.redisSG.securityGroupId],
      cacheSubnetGroupName: redisSubnetGroup.cacheSubnetGroupName,
      automaticFailoverEnabled: true,
      multiAzEnabled: true,
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      transitEncryptionMode: "required",
      authToken: SecretValue.secretsManager(this.redisAuth.secretArn, {
        jsonField: "password",
      }).unsafeUnwrap(),
      port: redisConfig.DB_PORT,
    });
    this.elasticache_redis.addDependency(redisSubnetGroup);
  }
}
