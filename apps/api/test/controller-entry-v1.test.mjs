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
    R2_ACCOUNT_ID: 'account',
    R2_ACCESS_KEY_ID: 'access',
    R2_SECRET_ACCESS_KEY: 'secret',
    ENABLED_CHAINS: 'ethereum,base',
    CORS_ORIGIN: 'https://preflight.curveyield.online',
    ...overrides,
  };
}

function request(path, token = 'client-secret') {
  return new Request(`https://api.preflight.curveyield.online${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

test('production setup readiness includes the Tier 3 controller gate', () => {
  const ready = setupReadiness(env());
  assert.equal(ready.status, 'ready');
  assert.equal(ready.features.tier3Controller, true);

  const missingController = setupReadiness(env({ AUDIT_CONTROLLER_GITHUB_TOKEN: undefined }));
  assert.equal(missingController.status, 'configuration_required');
  assert.equal(missingController.features.tier3Controller, false);
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
