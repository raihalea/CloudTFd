#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CloudTFdStack } from "../lib/cloudtfd-stack";
import { awsConfig } from "../lib/config/settings";

const app = new cdk.App();
new CloudTFdStack(app, "CloudTFdStack", {
  env: awsConfig,
});
