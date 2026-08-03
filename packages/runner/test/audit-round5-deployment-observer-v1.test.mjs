import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/observe-deployment.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/DEPLOY_OBSERVE_REQUEST_v1.json';
const TARGET_SHA = '81b7d3b2f4cf4636f204ae778617103804c30012';

test('secretless observer reports the exact push-triggered deployment run without mutation authority', () => {
  assert.ok(existsSync(WORKFLOW_PATH), `missing observer workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing observer request: ${REQUEST_PATH}`);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /paths:\s*\n\s*- \.agent-control\/v1\/orchestrator\/DEPLOY_OBSERVE_REQUEST_v1\.json/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /issues: write/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(workflow, /environment: production/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /rerun|re-run/i);
  assert.match(workflow, new RegExp(TARGET_SHA));
  assert.match(workflow, /actions\/workflows\/deploy\.yml\/runs/);
  assert.match(workflow, /issue comment 125/);
  assert.match(workflow, /seq 1 60/);

  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));
  assert.equal(request.schemaVersion, 'round5-deployment-observer-request-v1');
  assert.equal(request.requestId, 'round5-observe-deployment-20260803T0920Z-v1');
  assert.equal(request.repository, 'CurveYield/contract-automation');
  assert.equal(request.releaseBranch, 'orchestrator/round4-ci-base-v1');
  assert.equal(request.expectedBeforeSha, TARGET_SHA);
  assert.equal(request.targetDeploymentSha, TARGET_SHA);
  assert.equal(request.permissions.secretAccessAllowed, false);
  assert.equal(request.permissions.workflowMutationAllowed, false);
  assert.equal(request.permissions.cloudflareMutationAllowed, false);
});
