import { Construct } from "constructs";
import {
  Function,
  FunctionCode,
  FunctionAssociation,
  FunctionEventType,
} from "aws-cdk-lib/aws-cloudfront";
import { basicAuthConfig } from "../config/config";

export interface BasicAuthProps {}

export class BasicAuth extends Construct {
  readonly functionAssociation: FunctionAssociation;

  constructor(scope: Construct, id: string, props?: BasicAuthProps) {
    super(scope, id);

    const authCredentials = `${basicAuthConfig.USER}:${basicAuthConfig.PASS}`;
    const authString =
      "Basic " + Buffer.from(authCredentials).toString("base64");

    const basicAuthFunctionCode = `function handler(event) {
  var request = event.request;
  var headers = request.headers;

  var authString = "${authString}";

  if (
    typeof headers.authorization === "undefined" ||
    headers.authorization.value !== authString
  ) {
    return {
      statusCode: 401,
      statusDescription: "Unauthorized",
      headers: { "www-authenticate": { value: "Basic realm='Please Enter Your Password'"} }
    };
  }

  return request;
}`;

    const cfFunction = new Function(this, "Function", {
      code: FunctionCode.fromInline(basicAuthFunctionCode),
    });

    this.functionAssociation = {
      function: cfFunction,
      eventType: FunctionEventType.VIEWER_REQUEST,
    };
  }
}
