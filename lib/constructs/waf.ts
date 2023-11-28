import { Construct } from "constructs";
import { CfnRuleGroup, CfnWebACL } from "aws-cdk-lib/aws-wafv2";

type listOfRules = {
  name: string;
  priority: number;
  overrideAction: string;
  excludedRules: string[];
};

export interface WafProps {}

export class Waf extends Construct {
  /**
   * Take in list of rules
   * Create output for use in WAF config
   */
  /**
   * See: https://github.com/aws-samples/aws-cdk-examples/blob/master/typescript/waf/waf-cloudfront.ts
   */

  readonly webAclId: string;

  protected makeRules(listOfRules: listOfRules[] = []) {
    var rules: CfnRuleGroup.RuleProperty[] = [];
    listOfRules.forEach(function (r) {
      var mrgsp: CfnWebACL.ManagedRuleGroupStatementProperty = {
        name: r["name"],
        vendorName: "AWS",
        excludedRules: [],
      };

      var stateProp: CfnWebACL.StatementProperty = {
        managedRuleGroupStatement: {
          name: r["name"],
          vendorName: "AWS",
        },
      };
      var overrideAction: CfnWebACL.OverrideActionProperty = { none: {} };

      var rule: CfnWebACL.RuleProperty = {
        name: r["name"],
        priority: r["priority"],
        overrideAction: overrideAction,
        statement: stateProp,
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: r["name"],
        },
      };
      rules.push(rule);
    }); // forEach

    // Allowed country list
    var ruleGeoMatch: CfnWebACL.RuleProperty = {
      name: "GeoMatch",
      priority: 0,
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
    }; // GeoMatch
    rules.push(ruleGeoMatch);

    /**
     * The rate limit is the maximum number of requests from a
     * single IP address that are allowed in a five-minute period.
     * This value is continually evaluated,
     * and requests will be blocked once this limit is reached.
     * The IP address is automatically unblocked after it falls below the limit.
     */
    var ruleLimitRequests: CfnWebACL.RuleProperty = {
      name: "LimitRequests",
      priority: 1,
      action: {
        block: {}, // To disable, change to *count*
      },
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
    }; // limit requests
    rules.push(ruleLimitRequests);

    return rules;
  } // function makeRules

  constructor(scope: Construct, id: string, props?: WafProps) {
    super(scope, id);

    /**
     * List available Managed Rule Groups using AWS CLI
     * aws wafv2 list-available-managed-rule-groups --scope CLOUDFRONT
     */
    const managedRules: listOfRules[] = [
      // {
      //   name: "AWSManagedRulesCommonRuleSet",
      //   priority: 10,
      //   overrideAction: "none",
      //   excludedRules: [],
      // },
      // {
      //   name: "AWSManagedRulesAmazonIpReputationList",
      //   priority: 20,
      //   overrideAction: "none",
      //   excludedRules: [],
      // },
      // {
      //   name: "AWSManagedRulesKnownBadInputsRuleSet",
      //   priority: 30,
      //   overrideAction: "none",
      //   excludedRules: [],
      // },
      // {
      //   name: "AWSManagedRulesAnonymousIpList",
      //   priority: 40,
      //   overrideAction: "none",
      //   excludedRules: [],
      // },
      // {
      //   name: "AWSManagedRulesLinuxRuleSet",
      //   priority: 50,
      //   overrideAction: "none",
      //   excludedRules: [],
      // },
      // {
      //   name: "AWSManagedRulesSQLiRuleSet",
      //   priority: 60,
      //   overrideAction: "none",
      //   excludedRules: [],
      // },
    ];

    // WAF - CloudFront

    const wafAclCloudFront = new CfnWebACL(this, "WafCloudFront", {
      defaultAction: { allow: {} },
      /**
       * The scope of this Web ACL.
       * Valid options: CLOUDFRONT, REGIONAL.
       * For CLOUDFRONT, you must create your WAFv2 resources
       * in the US East (N. Virginia) Region, us-east-1
       */
      scope: "CLOUDFRONT",
      // Defines and enables Amazon CloudWatch metrics and web request sample collection.
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "waf-cloudfront",
        sampledRequestsEnabled: true,
      },
      description: "WAFv2 ACL for CloudFront",
      name: "waf-cloudfront",
      rules: this.makeRules(managedRules),
    }); // wafv2.CfnWebACL

    this.webAclId = wafAclCloudFront.attrArn;
  } // constructor
} // class
