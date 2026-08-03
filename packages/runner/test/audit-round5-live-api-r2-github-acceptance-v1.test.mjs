import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import apiEntry from '../../../apps/api/src/entry.mjs';

const WORKFLOW_PATH = '.github/workflows/live-api-r2-github-acceptance-v1.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/LIVE_API_R2_GITHUB_ACCEPTANCE_REQUEST_v1.json';
const LIFECYCLE_PATH = 'infra/r2-lifecycle.json';
const ENTRY_PATH = 'apps/api/src/entry.mjs';
const EXPECTED_PARENT = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const REQUEST_ID = 'round5-live-api-r2-github-acceptance-20260803T1115Z-v1';
const CORRELATION_ID = 'corr_round5_acceptance_1115';

class MemoryBucket {
  constructor() {
    this.objects = new Map();
  }

  async put(key, value) {
    this.objects.set(key, String(value));
  }

  async get(key) {
    const value = this.objects.get(key);
    if (value === undefined) return null;
    return {
      body: value,
      async json() { return JSON.parse(value); },
    };
  }

  async head(key) {
    const value = this.objects.get(key);
    return value === undefined ? null : { size: Buffer.byteLength(value) };
  }
}

function apiEnvironment(bucket) {
  return {
    JOBS: bucket,
    CLIENT_API_KEY: 'client-key',
    GPT_API_KEY: 'gpt-key',
    GITHUB_BRIDGE_API_KEY: 'bridge-key',
    RUNNER_API_KEY: 'runner-key',
    GITHUB_TOKEN: 'github-token',
    GITHUB_OWNER: 'CurveYield',
    GITHUB_REPO: 'contract-automation',
    GITHUB_REF: 'orchestrator/round4-ci-base-v1',
    GITHUB_WORKFLOW: 'simulate.yml',
    CORS_ORIGIN: 'https://preflight.curveyield.online',
    ENABLED_CHAINS: 'ethereum,base',
    FETCH: async () => new Response(null, { status: 204 }),
  };
}

const compileRequest = {
  mode: 'compile',
  project: {
    type: 'inline',
    files: {
      'Acceptance.sol': '// SPDX-License-Identifier: UNLICENSED\npragma solidity 0.8.30; contract Acceptance { function ok() external pure returns (bool) { return true; } }',
    },
  },
  compilerVersion: '0.8.30',
  workflow: { steps: [] },
};

test('production API echoes one bounded correlation ID across setup, job creation, and status responses', async () => {
  const bucket = new MemoryBucket();
  const env = apiEnvironment(bucket);

  const setup = await apiEntry.fetch(new Request('https://api.preflight.curveyield.online/api/v1/setup', {
    headers: { 'x-correlation-id': CORRELATION_ID },
  }), env, {});
  assert.equal(setup.status, 200);
  assert.equal(setup.headers.get('x-correlation-id'), CORRELATION_ID);

  const generated = await apiEntry.fetch(new Request('https://api.preflight.curveyield.online/api/v1/setup', {
    headers: { 'x-correlation-id': 'unsafe correlation value' },
  }), env, {});
  assert.match(generated.headers.get('x-correlation-id') ?? '', /^corr_[a-f0-9]{32}$/);

  const created = await apiEntry.fetch(new Request('https://api.preflight.curveyield.online/api/v1/jobs', {
    method: 'POST',
    headers: {
      authorization: 'Bearer client-key',
      'content-type': 'application/json',
      'x-correlation-id': CORRELATION_ID,
    },
    body: JSON.stringify(compileRequest),
  }), env, {});
  assert.equal(created.status, 202);
  assert.equal(created.headers.get('x-correlation-id'), CORRELATION_ID);
  const createdBody = await created.json();
  assert.match(createdBody.jobId, /^job_[a-f0-9]{32}$/);

  const status = await apiEntry.fetch(new Request(`https://api.preflight.curveyield.online/api/v1/jobs/${createdBody.jobId}`, {
    headers: {
      authorization: 'Bearer gpt-key',
      'x-correlation-id': CORRELATION_ID,
    },
  }), env, {});
  assert.equal(status.status, 200);
  assert.equal(status.headers.get('x-correlation-id'), CORRELATION_ID);
});

test('live API, R2, and GitHub acceptance is exact-parent, bounded, correlated, and cleans up test data', () => {
  const lifecycle = JSON.parse(readFileSync(LIFECYCLE_PATH, 'utf8'));
  assert.equal(lifecycle.rules.length, 1);
  assert.equal(lifecycle.rules[0].id, 'delete-preflight-artifacts-after-7-days');
  assert.deepEqual(lifecycle.rules[0].deleteObjectsTransition, {
    condition: { type: 'Age', maxAge: 604800 },
  });
  assert.deepEqual(lifecycle.rules[0].abortMultipartUploadsTransition, {
    condition: { type: 'Age', maxAge: 86400 },
  });

  const entry = readFileSync(ENTRY_PATH, 'utf8');
  assert.match(entry, /x-correlation-id/);
  assert.match(entry, /normalizeCorrelationId/);
  assert.match(entry, /CORRELATION_ID_PATTERN/);

  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);
  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /LIVE_API_R2_GITHUB_ACCEPTANCE_REQUEST_v1\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /PREFLIGHTSIM_CLIENT_API_KEY/);
  assert.match(workflow, /PREFLIGHTSIM_GPT_API_KEY/);
  assert.match(workflow, /PREFLIGHTSIM_GITHUB_BRIDGE_API_KEY/);
  assert.match(workflow, /PREFLIGHTSIM_RUNNER_API_KEY/);
  assert.match(workflow, /x-correlation-id/);
  assert.match(workflow, /\/api\/v1\/uploads/);
  assert.match(workflow, /\/api\/v1\/jobs/);
  assert.match(workflow, /mode.*compile/);
  assert.match(workflow, /simulate\.yml/);
  assert.match(workflow, /r2 bucket lifecycle set/);
  assert.match(workflow, /r2 object delete/);
  assert.match(workflow, /access-control-allow-origin/);
  assert.match(workflow, /wrangler deploy --config apps\/api\/wrangler\.toml/);
  assert.match(workflow, /wrangler pages deploy dist\/web/);
  assert.match(workflow, /Live API, R2, and GitHub acceptance result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /RPC_ETHEREUM|RPC_BASE|RPC_ARBITRUM|RPC_FRAXTAL|RPC_KATANA|RPC_OPTIMISM|RPC_POLYGON/);
  assert.doesNotMatch(workflow, /eth_send|eth_sign|personal_|wallet_|rawTransaction|signedTransaction/);
  assert.doesNotMatch(workflow, /set -x|echo .*API_KEY|echo .*TOKEN|cat .*response/);

  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));
  assert.equal(request.schemaVersion, 'round5-live-api-r2-github-acceptance-request-v1');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.baselineDeployedSourceSha, EXPECTED_PARENT);
  assert.equal(request.baselineDeploymentRun, 30808377849);
  assert.equal(request.baselineDeploymentJob, 91668946456);
  assert.deepEqual(request.activeNetworks, ['ethereum', 'base']);
  assert.equal(request.deployCorrelationGateway, true);
  assert.equal(request.applySevenDayLifecycle, true);
  assert.equal(request.readOnlyBlockchain, true);
  assert.equal(request.compileOnlyJob, true);
  assert.equal(request.boundedDisposableR2Object, true);
  assert.equal(request.cleanupRequired, true);
  assert.equal(request.secretValuesIncluded, false);
  assert.equal(request.walletSigningAllowed, false);
  assert.equal(request.publicTransactionBroadcastAllowed, false);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);
});
