import { Construct } from "constructs";
import { CfnRuleGroup, CfnWebACL, CfnIPSet } from "aws-cdk-lib/aws-wafv2";
import { wafConfig } from "../config/config";
import { managedRules } from "../config/wafManagedRule-config";

export interface WafProps {}

export class Waf extends Construct {
  /**
   * See: https://github.com/aws-samples/aws-cdk-examples/blob/master/typescript/waf/waf-cloudfront.ts
   */

  readonly webAclId?: string;

  constructor(scope: Construct, id: string, props?: WafProps) {
    super(scope, id);

    const wafAclCloudFront = new CfnWebACL(this, "WafCloudFront", {
      defaultAction: { allow: {} },
      scope: "CLOUDFRONT",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "waf-cloudfront",
        sampledRequestsEnabled: true,
      },
      rules: this.makeRules(),
    });

    if (wafConfig.isEnabled) {
      this.webAclId = wafAclCloudFront.attrArn;
    }
  }

  // ルールのマージ
  private makeRules(): CfnRuleGroup.RuleProperty[] {
    const rules: CfnRuleGroup.RuleProperty[] = [];

    // 信頼できるIPアドレスのWAFバイパス(管理者用)
    if (wafConfig.allowTrustedIpsRule.isEnabled) {
      const allowTrustedIpsRule = this.createRuleAllowTrustedIps(rules.length);
      rules.push(allowTrustedIpsRule)
    }

    // サイズ制限のルール追加
    if (wafConfig.sizeRestrictionRule.isEnabled) {
      const sizeRestrictionRule = this.createSizeRestriction(rules.length);
      rules.push(sizeRestrictionRule)
    }

    // IP制限ルールの追加
    if (wafConfig.blockNonSpecificIps.isEnabled) {
      const blockNonSpecificIpsRule = this.createRuleBlockNonSpecificIps(rules.length);
      rules.push(blockNonSpecificIpsRule);
    }

    // Geo情報によるブロックルールの追加
    if (wafConfig.geoMatchRule.isEnabled) {
      const geoMatchRule = this.createRuleGeoMatch(rules.length);
      rules.push(geoMatchRule);
    }

    // レートベースの制限ルールの追加
    if (wafConfig.limitRequestsRule.isEnabled) {
      const limitRequestsRule = this.createRuleLimitRequests(rules.length);
      rules.push(limitRequestsRule);
    }

    // マネージドルールの追加
    if (wafConfig.managedRules.isEnabled) {
      const managedRules = this.createManagedRules(rules.length);
      rules.push(...managedRules);
    }

    return rules;
  }

  private createRuleAllowTrustedIps(priority: number): CfnRuleGroup.RuleProperty {
    const trustedIpv4Set = new CfnIPSet(this, "TrustedIpv4Set", {
      name: "TrustedIpv4Set",
      scope: "CLOUDFRONT",
      ipAddressVersion: "IPV4",
      addresses: wafConfig.blockNonSpecificIps.IPv4List,
    });
    const trustedIpv6Set = new CfnIPSet(this, "TrustedIpv6Set", {
      name: "TrustedIpv6Set",
      scope: "CLOUDFRONT",
      ipAddressVersion: "IPV6",
      addresses: wafConfig.blockNonSpecificIps.IPv6List,
    });

    return {
      name: "TrustedIp",
      priority: priority,
      action: { allow: {} },
      statement: {
        orStatement: {
          statements: [
            {
              ipSetReferenceStatement: {
                arn: trustedIpv4Set.attrArn,
              },
            },
            {
              ipSetReferenceStatement: {
                arn: trustedIpv6Set.attrArn,
              },
            },
          ],
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: "TrustedIp",
      },
    };
  }

  private createSizeRestriction(priority: number): CfnRuleGroup.RuleProperty {
    return {
      name: "SizeRestriction",
      priority: priority,
      action: { block: {} },
      statement: {
        sizeConstraintStatement: {
          fieldToMatch: {
            body: {},
          },
          comparisonOperator: "GT",
          size: 16 * 1000,
          textTransformations: [
            {
              priority: 0,
              type: "NONE",
            },
          ],
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: "SizeRestriction",
      },
    };
  }

  private createRuleBlockNonSpecificIps(priority: number): CfnRuleGroup.RuleProperty {
    // IP制限ルールの具体的な定義
    const allowedIpv4Set = new CfnIPSet(this, "AllowedIpv4Set", {
      name: "AllowedIpv4Set",
      scope: "CLOUDFRONT",
      ipAddressVersion: "IPV4",
      addresses: wafConfig.blockNonSpecificIps.IPv4List,
    });
    const allowedIpv6Set = new CfnIPSet(this, "AllowedIpv6Set", {
      name: "AllowedIpv6Set",
      scope: "CLOUDFRONT",
      ipAddressVersion: "IPV6",
      addresses: wafConfig.blockNonSpecificIps.IPv6List,
    });

    return {
      name: "AllowedIp",
      priority: priority,
      action: { block: {} },
      statement: {
        notStatement: {
          statement: {
            orStatement: {
              statements: [
                {
                  ipSetReferenceStatement: {
                    arn: allowedIpv4Set.attrArn,
                  },
                },
                {
                  ipSetReferenceStatement: {
                    arn: allowedIpv6Set.attrArn,
                  },
                },
              ],
            },
          },
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: "AllowedIp",
      },
    };
  }

  private createRuleLimitRequests(priority: number): CfnRuleGroup.RuleProperty {
    return {
      name: "LimitRequests",
      priority: priority,
      action: { block: {} },
      statement: {
        rateBasedStatement: {
          limit: 1000,
          aggregateKeyType: "IP",
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: "LimitRequests",
      },
    };
  }

  private createRuleGeoMatch(priority: number): CfnRuleGroup.RuleProperty {
    return {
      name: "GeoMatch",
      priority: priority,
      action: {
        block: {}, // To disable, change to *count*
      },
      statement: {
        notStatement: {
          statement: {
            geoMatchStatement: {
              // block connection if source not in the below country list
              countryCodes: ["JP"],
            },
          },
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: "GeoMatch",
      },
    };
  }

  // マネージドルールの生成
  private createManagedRules(
    startPriorityNumber: number
  ): CfnRuleGroup.RuleProperty[] {
    var rules: CfnRuleGroup.RuleProperty[] = [];
    managedRules.forEach((r, index) => {
      var stateProp: CfnWebACL.StatementProperty = {
        managedRuleGroupStatement: {
          name: r.name,
          vendorName: "AWS",
          excludedRules: r.excludedRules.map((ruleName) => ({
            name: ruleName,
          })),
          scopeDownStatement: r.scopeDownStatement,
        },
      };
      var overrideAction: CfnWebACL.OverrideActionProperty = { none: {} };

      var rule: CfnWebACL.RuleProperty = {
        name: r.name,
        priority:
          r.priority !== undefined ? r.priority : startPriorityNumber + index,
        overrideAction: overrideAction,
        statement: stateProp,
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: r.name,
        },
      };
      rules.push(rule);
    }); // forEach

    return rules;
  }
} // class
