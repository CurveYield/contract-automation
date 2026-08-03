import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../../../apps/api/src/entry.mjs';

const RELEASE_BRANCH = 'orchestrator/round4-ci-base-v1';
const FULL_SHA_ACTION = /uses:\s+[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]+@[0-9a-f]{40}\b/g;
const ANY_ACTION = /uses:\s+[^\s]+/g;

function request(path, { method = 'GET', body } = {}) {
  return new Request(`https://api.preflight.curveyield.online${path}`, {
    method,
    headers: {
      authorization: 'Bearer client-secret',
      'content-type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

const deferredPolygonJob = {
  project: {
    type: 'inline',
    files: { 'Counter.sol': 'pragma solidity 0.8.30; contract Counter {}' }
  },
  compilerVersion: '0.8.30',
  chain: 'polygon',
  block: 'latest',
  workflow: {
    steps: [{ action: 'deploy', alias: 'counter', contract: 'Counter', args: [] }]
  }
};

test('trusted deployment workflow is branch-bound, protected, pinned, and validates the active configuration', () => {
  const deployment = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const actions = deployment.match(ANY_ACTION) ?? [];
  const pinned = deployment.match(FULL_SHA_ACTION) ?? [];

  assert.match(deployment, /workflow_dispatch:/);
  assert.match(deployment, new RegExp(`github\\.ref == 'refs/heads/${RELEASE_BRANCH.replaceAll('/', '\\/')}'`));
  assert.match(deployment, /environment:\s*production/);
  assert.match(deployment, /cancel-in-progress:\s*false/);
  assert.equal(actions.length, pinned.length, 'every deployment action must use a full 40-character commit SHA');

  for (const name of [
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'PREFLIGHTSIM_CLIENT_API_KEY',
    'PREFLIGHTSIM_GPT_API_KEY',
    'PREFLIGHTSIM_GITHUB_BRIDGE_API_KEY',
    'PREFLIGHTSIM_RUNNER_API_KEY',
    'PREFLIGHTSIM_GITHUB_TOKEN',
    'PREFLIGHTSIM_R2_ACCESS_KEY_ID',
    'PREFLIGHTSIM_R2_SECRET_ACCESS_KEY',
    'RPC_ETHEREUM',
    'RPC_BASE',
    'PREFLIGHTSIM_API_URL',
    'PAGES_PROJECT_NAME',
    'PREFLIGHTSIM_ALLOWED_GITHUB_USERS'
  ]) {
    assert.match(deployment, new RegExp(`\\b${name}\\b`), `deployment preflight must bind ${name}`);
  }

  for (const label of ['preflightsim-campaign', 'preflightsim-job', 'preflightsim-report']) {
    assert.match(deployment, new RegExp(`gh label create ${label}\\b`));
  }
});

test('production workflow and Worker configuration expose only Ethereum and Base', () => {
  const simulation = readFileSync('.github/workflows/simulate.yml', 'utf8');
  const wrangler = readFileSync('apps/api/wrangler.toml', 'utf8');

  assert.match(simulation, new RegExp(`github\\.ref == 'refs/heads/${RELEASE_BRANCH.replaceAll('/', '\\/')}'`));
  assert.match(simulation, /environment:\s*production/);
  assert.match(simulation, /RPC_ETHEREUM:\s*\$\{\{ secrets\.RPC_ETHEREUM \}\}/);
  assert.match(simulation, /RPC_BASE:\s*\$\{\{ secrets\.RPC_BASE \}\}/);
  for (const deferred of ['KATANA', 'FRAXTAL', 'ARBITRUM', 'POLYGON', 'OPTIMISM']) {
    assert.doesNotMatch(simulation, new RegExp(`RPC_${deferred}|SIM_ARCHIVE_(?:PRIMARY|SECONDARY)_${deferred}`));
  }

  assert.match(wrangler, /ENABLED_CHAINS\s*=\s*"ethereum,base"/);
  assert.match(wrangler, new RegExp(`GITHUB_REF\\s*=\\s*"${RELEASE_BRANCH.replaceAll('/', '\\/')}"`));
  assert.match(wrangler, /pattern\s*=\s*"api\.preflight\.curveyield\.online"/);
  assert.doesNotMatch(wrangler, /pattern\s*=\s*"preflight\.curveyield\.online"/);
});

test('production API advertises active networks and rejects a deferred network before dispatch', async () => {
  let dispatched = false;
  const env = {
    CLIENT_API_KEY: 'client-secret',
    ENABLED_CHAINS: 'ethereum,base',
    FETCH: async () => {
      dispatched = true;
      return new Response(null, { status: 204 });
    }
  };

  const chainResponse = await worker.fetch(request('/api/v1/chains'), env);
  assert.equal(chainResponse.status, 200);
  const { chains } = await chainResponse.json();
  assert.deepEqual(Object.keys(chains).sort(), ['base', 'ethereum']);
  assert.equal(chains.ethereum.chainId, 1);
  assert.equal(chains.base.chainId, 8453);

  const rejected = await worker.fetch(request('/api/v1/jobs', {
    method: 'POST',
    body: deferredPolygonJob
  }), env);
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).error.code, 'chain_not_enabled');
  assert.equal(dispatched, false);
});
