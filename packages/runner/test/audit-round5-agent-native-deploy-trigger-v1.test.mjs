import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/deploy.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/DEPLOY_REQUEST_v1.json';
const REQUEST_ID = 'round5-production-deploy-20260803T0904Z-v1';

const ACTIVE_NETWORKS = Object.freeze([
  { network: 'ethereum', chainId: 1, secretName: 'RPC_ETHEREUM' },
  { network: 'base', chainId: 8453, secretName: 'RPC_BASE' }
]);

const DEFERRED_NETWORKS = Object.freeze([
  'arbitrum',
  'fraxtal',
  'katana',
  'optimism',
  'polygon'
]);

test('trusted deployment supports one-time agent-native push dispatch without weakening existing guards', () => {
  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /paths:\s*\n\s*- \.agent-control\/v1\/orchestrator\/DEPLOY_REQUEST_v1\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /DEPLOY_REQUEST_ID: round5-production-deploy-20260803T0904Z-v1/);
  assert.match(workflow, /Verify one-time agent-native deployment request/);
  assert.match(workflow, /github\.event_name == 'push'/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);

  assert.ok(existsSync(REQUEST_PATH), `missing deployment request: ${REQUEST_PATH}`);
  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));

  assert.equal(request.schemaVersion, 'round5-trusted-deployment-request-v1');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.repository, 'CurveYield/contract-automation');
  assert.equal(request.releaseBranch, 'orchestrator/round4-ci-base-v1');
  assert.equal(request.accountOwnerAuthorization.deploymentAuthorized, true);
  assert.equal(request.accountOwnerAuthorization.liveProductionTestingAuthorized, true);
  assert.deepEqual(request.activeReadOnlyRpcNetworks, ACTIVE_NETWORKS);
  assert.deepEqual(request.deferredReadOnlyRpcNetworks, DEFERRED_NETWORKS);
  assert.equal(request.safety.secretValuesIncluded, false);
  assert.equal(request.safety.walletSigningAllowed, false);
  assert.equal(request.safety.publicTransactionBroadcastAllowed, false);
  assert.equal(request.safety.failedOrHistoricalWorkflowRerunAllowed, false);
});
