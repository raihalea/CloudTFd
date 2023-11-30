import { CfnRuleGroup, CfnWebACL, CfnIPSet } from "aws-cdk-lib/aws-wafv2";


export function block(
  name: string,
  priority: number,
  statement: CfnWebACL.StatementProperty
): CfnRuleGroup.RuleProperty {
  return ruleAction(name, priority, statement, { block: {} });
}

export function allow(
  name: string,
  priority: number,
  statement: CfnWebACL.StatementProperty
): CfnRuleGroup.RuleProperty {
  return ruleAction(name, priority, statement, { allow: {} });
}

export function ruleAction(
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

interface listOfRules {
  name: string;
  priority?: number;
  overrideAction: string;
  excludedRules: string[];
  scopeDownStatement?: CfnWebACL.StatementProperty;
}

export function managedRuleGroup(
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

export function not(
  statement: CfnWebACL.StatementProperty
): CfnWebACL.StatementProperty {
  return {
    notStatement: {
      statement: statement,
    },
  };
}

export function oversizedRequestBody(
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

export function rateBasedByIp(limit: number): CfnWebACL.StatementProperty {
  return {
    rateBasedStatement: {
      limit: limit,
      aggregateKeyType: "IP",
    },
  };
}

export function matchCountryCodes(
  countryCodes: string[]
): CfnWebACL.StatementProperty {
  return {
    geoMatchStatement: {
      // block connection if source not in the below country list
      countryCodes: countryCodes,
    },
  };
}

export function startsWith(path: string): CfnWebACL.StatementProperty {
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

export function ipv4v6Match(
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
