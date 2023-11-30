import { Construct } from "constructs";
import { CfnRuleGroup, CfnWebACL, CfnIPSet } from "aws-cdk-lib/aws-wafv2";
import { wafConfig } from "../config/config";
import { WafStatements } from "./utils/waf-statement";

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

    // 信頼できるIPアドレスのWAFバイパス(緊急用)
    if (wafConfig.emergencyAllowIpsRule.isEnabled) {
      const emergencyAllowIpsRule = this.createRuleEmergencyAllowIps(
        rules.length
      );
      rules.push(emergencyAllowIpsRule);
    }

    // レートベースの制限ルールの追加
    if (wafConfig.limitRequestsRule.isEnabled) {
      const limitRequestsRule = this.createRuleLimitRequests(rules.length);
      rules.push(limitRequestsRule);
    }

    // サイズ制限のルール追加
    if (wafConfig.sizeRestrictionRule.isEnabled) {
      const sizeRestrictionRule = this.createSizeRestrictionExcludedAdmin(
        rules.length
      );
      rules.push(sizeRestrictionRule);
    }

    // IP制限ルールの追加
    if (wafConfig.blockNonSpecificIps.isEnabled) {
      const blockNonSpecificIpsRule = this.createRuleBlockNonSpecificIps(
        rules.length
      );
      rules.push(blockNonSpecificIpsRule);
    }

    // Geo情報によるブロックルールの追加
    if (wafConfig.geoMatchRule.isEnabled) {
      const geoMatchRule = this.createRuleGeoMatch(rules.length);
      rules.push(geoMatchRule);
    }

    // マネージドルールの追加
    if (wafConfig.managedRules.isEnabled) {
      const managedRuleGroups = this.createManagedRules(rules.length);
      rules.push(...managedRuleGroups);

      const XsslabelMatchRule = this.createXSSLabelMatch(rules.length);
      rules.push(XsslabelMatchRule);
    }

    return rules;
  }

  private createRuleEmergencyAllowIps(
    priority: number
  ): CfnRuleGroup.RuleProperty {
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
    return WafStatements.allow(
      "TrustedIp",
      priority,
      WafStatements.ipv4v6Match(trustedIpv4Set, trustedIpv6Set)
    );
  }

  private createSizeRestrictionExcludedAdmin(
    priority: number
  ): CfnRuleGroup.RuleProperty {
    // 管理用IP　（ファイルアップロード）
    // TODO: 全てのIPを対象にする場合を考える
    const adminIpv4Set = new CfnIPSet(this, "AdminIpv4Set", {
      name: "AdminIpv4Set",
      scope: "CLOUDFRONT",
      ipAddressVersion: "IPV4",
      addresses: wafConfig.sizeRestrictionRule.IPv4List,
    });
    const adminIpv6Set = new CfnIPSet(this, "AdminIpv6Set", {
      name: "AdminIpv6Set",
      scope: "CLOUDFRONT",
      ipAddressVersion: "IPV6",
      addresses: wafConfig.sizeRestrictionRule.IPv6List,
    });

    return WafStatements.block(
      "SizeRestriction",
      priority,
      WafStatements.and(
        WafStatements.oversizedRequestBody(16 * 1000),
        WafStatements.not(
          WafStatements.and(
            WafStatements.or(
              WafStatements.startsWith("/admin/"),
              WafStatements.startsWith("/api/")
            ),
            WafStatements.ipv4v6Match(adminIpv4Set, adminIpv6Set)
          )
        )
      )
    );
  }

  private createRuleLimitRequests(priority: number): CfnRuleGroup.RuleProperty {
    return WafStatements.block(
      "LimitRequests",
      priority,
      WafStatements.rateBasedByIp(1000)
    );
  }

  private createRuleBlockNonSpecificIps(
    priority: number
  ): CfnRuleGroup.RuleProperty {
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

    return WafStatements.block(
      "AllowedIp",
      priority,
      WafStatements.not(
        WafStatements.ipv4v6Match(allowedIpv4Set, allowedIpv6Set)
      )
    );
  }

  private createRuleGeoMatch(priority: number): CfnRuleGroup.RuleProperty {
    return WafStatements.block(
      "GeoMatch",
      priority,
      WafStatements.not(WafStatements.matchCountryCodes(["JP"]))
    );
  }

  private createXSSLabelMatch(priority: number): CfnRuleGroup.RuleProperty {
    return WafStatements.block(
      "XssLabelMatch",
      priority,
      WafStatements.and(
        WafStatements.matchLabel(
          "LABEL",
          "awswaf:managed:aws:core-rule-set:CrossSiteScripting_Body"
        ),
        WafStatements.not(WafStatements.startsWith("/api/"))
      )
    );
  }

  // マネージドルールの生成
  private createManagedRules(
    startPriorityNumber: number
  ): CfnRuleGroup.RuleProperty[] {
    var rules: CfnRuleGroup.RuleProperty[] = [];
    interface listOfRules {
      name: string;
      priority?: number;
      overrideAction: string;
      excludedRules: string[];
      scopeDownStatement?: CfnWebACL.StatementProperty;
    }
    const managedRules: listOfRules[] = [
      // {
      //   name: "EXAMPLE_MANAGED_RULEGROUP",
      //   priority: 20, // if not specified, priority is automatically assigned.
      //   overrideAction: "none",
      //   excludedRules: ["EXCLUDED_MANAGED_RULE"],
      //   scopeDownStatement: WafStatements.not(WafStatements.startsWith("/admin")),
      // },
      {
        name: "AWSManagedRulesCommonRuleSet",
        overrideAction: "none",
        excludedRules: ["SizeRestrictions_BODY", "CrossSiteScripting_BODY"],
      },
      {
        name: "AWSManagedRulesAmazonIpReputationList",
        overrideAction: "none",
        excludedRules: [],
      },
      {
        name: "AWSManagedRulesKnownBadInputsRuleSet",
        overrideAction: "none",
        excludedRules: [],
      },
      {
        name: "AWSManagedRulesAnonymousIpList",
        overrideAction: "none",
        excludedRules: [],
      },
      {
        name: "AWSManagedRulesLinuxRuleSet",
        overrideAction: "none",
        excludedRules: [],
      },
      {
        name: "AWSManagedRulesSQLiRuleSet",
        overrideAction: "none",
        excludedRules: [],
      },
    ];

    managedRules.forEach((r, index) => {
      var rule: CfnWebACL.RuleProperty = WafStatements.managedRuleGroup(
        r,
        startPriorityNumber,
        index
      );

      rules.push(rule);
    });

    return rules;
  }
}
