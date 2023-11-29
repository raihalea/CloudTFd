import { CfnWebACL } from "aws-cdk-lib/aws-wafv2";

interface listOfRules {
  name: string;
  priority?: number;
  overrideAction: string;
  excludedRules: string[];
  scopeDownStatement?: CfnWebACL.StatementProperty;
}

export const managedRules: listOfRules[] = [
  {
    name: "AWSManagedRulesCommonRuleSet",
    // priority: 20,
    overrideAction: "none",
    excludedRules: ["SizeRestrictions_BODY"],
    // scopeDownStatement: not(startsWith("/admin")),
  },
  {
    name: "AWSManagedRulesAmazonIpReputationList",
    // priority: 20,
    overrideAction: "none",
    excludedRules: [],
  },
  {
    name: "AWSManagedRulesKnownBadInputsRuleSet",
    // priority: 30,
    overrideAction: "none",
    excludedRules: [],
  },
  {
    name: "AWSManagedRulesAnonymousIpList",
    // priority: 40,
    overrideAction: "none",
    excludedRules: [],
  },
  {
    name: "AWSManagedRulesLinuxRuleSet",
    // priority: 50,
    overrideAction: "none",
    excludedRules: [],
  },
  {
    name: "AWSManagedRulesSQLiRuleSet",
    // priority: 60,
    overrideAction: "none",
    excludedRules: [],
  },
];

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


export function not(st: CfnWebACL.StatementProperty): CfnWebACL.StatementProperty {
  return {
    notStatement: {
      statement:st
    }
  }
}