#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CloudTFdStack } from '../lib/cloudtfd-stack';

const app = new cdk.App();
new CloudTFdStack(app, 'CloudTFdStack', {
  // env: { account: '123456789012', region: 'us-east-1' },
});