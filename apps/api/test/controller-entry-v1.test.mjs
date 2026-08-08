import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { setupReadiness } from '../src/entry.mjs';

function env(overrides = {}) {
  return {
    JOBS: {},
    CLIENT_API_KEY: 'client-secret',
    GPT_API_KEY: 'gpt-secret',
    GITHUB_BRIDGE_API_KEY: 'bridge-secret',
    RUNNER_API_KEY: 'runner-secret',
    GITHUB_TOKEN: 'automation-github-secret',
    AUDIT_CONTROLLER_GITHUB_TOKEN: 'controller-github-secret',
    AUDIT_CONTROLLER_INTAKE_ISSUE: '64',
    R2_ACCOUNT_ID: 'account',
    R2_ACCESS_KEY_ID: 'access',
    R2_SECRET_ACCESS_KEY: 'secret',
    ENABLED_CHAINS: 'ethereum,base',
    CORS_ORIGIN: 'https://preflight.curveyield.online',
    ...overrides,
  };
}

function request(path, token = 'client-secret', init = {}) {
  return new Request(`https://api.preflight.curveyield.online${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
}

test('production setup readiness includes the complete Tier 3 controller gate', () => {
  const ready = setupReadiness(env());
  assert.equal(ready.status, 'ready');
  assert.equal(ready.features.tier3Controller, true);

  for (const overrides of [
    { AUDIT_CONTROLLER_GITHUB_TOKEN: undefined },
    { AUDIT_CONTROLLER_INTAKE_ISSUE: undefined },
    { AUDIT_CONTROLLER_INTAKE_ISSUE: '999' },
  ]) {
    const missingController = setupReadiness(env(overrides));
    assert.equal(missingController.status, 'configuration_required');
    assert.equal(missingController.features.tier3Controller, false);
  }
});

test('production entry routes controller compatibility before the Lite job API', async () => {
  const response = await worker.fetch(
    request('/api/v1/controller/compatibility'),
    env(),
    {},
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.adapterVersion, 'tier3-controller-adapter-v1');
  assert.deepEqual(body.networkScope, { chains: ['ethereum', 'base'], defaultChain: 'base' });
});

test('production entry routes structured controller commands before the Lite job API', async () => {
  let calls = 0;
  const tombstone = {
    schemaVersion: 'deep-assurance-active-pointer-tombstone-v1',
    projectSlug: 'vlsdt',
    status: 'NO_ACTIVE_CAMPAIGN',
    reason: 'FULL_RESTART_REQUESTED',
    launchAuthorized: false,
    allPriorGenerationsAdmissible: false,
    scrubCommit: 'e'.repeat(40),
  };
  const fakeFetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({
        encoding: 'base64',
        content: Buffer.from(JSON.stringify(tombstone)).toString('base64'),
        sha: 'a'.repeat(40),
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ id: 999 }), { status: 201, headers: { 'content-type': 'application/json' } });
  };
  const response = await worker.fetch(
    request('/api/v1/controller/commands', 'client-secret', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectSlug: 'vlsdt',
        command: {
          schemaVersion: 1,
          commandId: 'create-1',
          type: 'campaign.create',
          actor: { type: 'controller', id: 'orchestrator' },
          payload: { title: 'Campaign' },
        },
      }),
    }),
    env({ AUDIT_CONTROLLER_FETCH: fakeFetch }),
    {},
  );
  assert.equal(response.status, 202);
  assert.equal((await response.json()).target, 'controller-intake');
});

test('production entry preserves browser-only identity separation for controller routes', async () => {
  for (const token of [null, 'gpt-secret', 'bridge-secret', 'runner-secret']) {
    const response = await worker.fetch(
      request('/api/v1/controller/compatibility', token),
      env(),
      {},
    );
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'unauthorized');
  }
});
