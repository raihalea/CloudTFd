import { CfnRuleGroup, CfnWebACL, CfnIPSet } from "aws-cdk-lib/aws-wafv2";

interface listOfRules {
  name: string;
  priority?: number;
  overrideAction: string;
  excludedRules: string[];
  scopeDownStatement?: CfnWebACL.StatementProperty;
}
export class WafStatements {
  static block(
    name: string,
    priority: number,
    statement: CfnWebACL.StatementProperty
  ): CfnRuleGroup.RuleProperty {
    return this.ruleAction(name, priority, statement, { block: {} });
  }

  static allow(
    name: string,
    priority: number,
    statement: CfnWebACL.StatementProperty
  ): CfnRuleGroup.RuleProperty {
    return this.ruleAction(name, priority, statement, { allow: {} });
  }

  static ruleAction(
    name: string,
    priority: number,
    statement: CfnWebACL.StatementProperty,
    action?: CfnRuleGroup.RuleActionProperty
  ): CfnRuleGroup.RuleProperty {
    return {
      name: name,
      priority: priority,
      statement: statement,
      action: action,
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: name,
      },
    };
  }

  static managedRuleGroup(
    r: listOfRules,
    startPriorityNumber: number,
    index: number,
  ): CfnRuleGroup.RuleProperty {
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
    return rule
  }

  static not(
    statement: CfnWebACL.StatementProperty
  ): CfnWebACL.StatementProperty {
    return {
      notStatement: {
        statement: statement,
      },
    };
  }

  static oversizedRequestBody(
    size: number
  ): CfnWebACL.StatementProperty {
    return {
      sizeConstraintStatement: {
        fieldToMatch: {
          body: {},
        },
        comparisonOperator: "GT",
        size: size,
        textTransformations: [
          {
            priority: 0,
            type: "NONE",
          },
        ],
      },
    };
  }

  static rateBasedByIp(limit: number): CfnWebACL.StatementProperty {
    return {
      rateBasedStatement: {
        limit: limit,
        aggregateKeyType: "IP",
      },
    };
  }

  static matchCountryCodes(
    countryCodes: string[]
  ): CfnWebACL.StatementProperty {
    return {
      geoMatchStatement: {
        // block connection if source not in the below country list
        countryCodes: countryCodes,
      },
    };
  }

  static startsWith(path: string): CfnWebACL.StatementProperty {
    return {
      byteMatchStatement: {
        fieldToMatch: {
          uriPath: {},
        },
        positionalConstraint: "STARTS_WITH",
        searchString: path,
        textTransformations: [
          {
            priority: 0,
            type: "NONE",
          },
        ],
      },
    };
  }

  static ipv4v6Match(
    ipv4List: CfnIPSet,
    ipv6List: CfnIPSet
  ): CfnWebACL.StatementProperty {
    return {
      orStatement: {
        statements: [
          {
            ipSetReferenceStatement: {
              arn: ipv4List.attrArn,
            },
          },
          {
            ipSetReferenceStatement: {
              arn: ipv6List.attrArn,
            },
          },
        ],
      },
    };
  }
}