import test from 'node:test';
import assert from 'node:assert/strict';
import * as phase4Api from '../src/phase4-catalog.mjs';

const EXPECTED_IDS = [
  'coverage-forge-v1',
  'foundry-fuzz-v1',
  'foundry-invariant-v1',
  'foundry-test-v1',
  'slither-v1',
  'solidity-compile-v1'
];

function request(path, init = {}) {
  return new Request(`https://api.audit.preflight.curveyield.online${path}`, init);
}
function bearer(key) { return { authorization: `Bearer ${key}` }; }
function env(overrides = {}) {
  return {
    AUDIT_READ_API_KEY: 'audit-read-test-key',
    AUDIT_SUBMIT_API_KEY: 'audit-submit-test-key',
    AUDIT_ADMIN_API_KEY: 'audit-admin-test-key',
    CORS_ORIGIN: 'https://audit.preflight.curveyield.online',
    ...overrides
  };
}

const {
  auditPhase4Capabilities,
  auditPhase4Health,
  handlePhase4CatalogRequest
} = phase4Api;

test('catalog CORS preflight is read-only and requires no credential', async () => {
  const response = await handlePhase4CatalogRequest(request('/audit/v1/tool-profiles', {
    method: 'OPTIONS',
    headers: { origin: 'https://audit.preflight.curveyield.online' }
  }), env());
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
  assert.equal(await response.text(), '');
});

test('read-only profile list requires Audit read scope and rejects unrelated credentials', async () => {
  assert.equal((await handlePhase4CatalogRequest(request('/audit/v1/tool-profiles'), env())).status, 401);
  assert.equal((await handlePhase4CatalogRequest(request('/audit/v1/tool-profiles', { headers: bearer('lite-client-key') }), env())).status, 401);

  for (const key of ['audit-read-test-key', 'audit-submit-test-key', 'audit-admin-test-key']) {
    const response = await handlePhase4CatalogRequest(request('/audit/v1/tool-profiles', { headers: bearer(key) }), env());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.schemaVersion, 'phase4-tool-profile-list-v1');
    assert.deepEqual(body.profiles.map((profile) => profile.profileId), EXPECTED_IDS);
    assert.ok(body.profiles.every((profile) => profile.executionEnabled === false && profile.executorState === 'unavailable'));
  }
});

test('exact profile route returns truthful state and stable validation/not-found errors', async () => {
  const found = await handlePhase4CatalogRequest(
    request('/audit/v1/tool-profiles/foundry-fuzz-v1', { headers: bearer('audit-read-test-key') }),
    env()
  );
  assert.equal(found.status, 200);
  const profile = await found.json();
  assert.equal(profile.profileId, 'foundry-fuzz-v1');
  assert.equal(profile.tool.version, '1.7.1');
  assert.equal(profile.publicationState, 'unpublished');
  assert.equal(profile.runnable, false);
  assert.equal(profile.executionEnabled, false);
  assert.equal(profile.executorState, 'unavailable');
  assert.equal(profile.digestRequired, true);
  assert.equal('registryArtifact' in profile, false);

  const missing = await handlePhase4CatalogRequest(
    request('/audit/v1/tool-profiles/unknown-v1', { headers: bearer('audit-read-test-key') }),
    env()
  );
  assert.equal(missing.status, 404);
  assert.deepEqual((await missing.json()).error, {
    code: 'not_found', message: 'Phase 4 profile not found', details: { path: '$.profileId' }
  });

  const invalid = await handlePhase4CatalogRequest(
    request('/audit/v1/tool-profiles/%2E%2E%2Fescape', { headers: bearer('audit-read-test-key') }),
    env()
  );
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, 'invalid_profile_id');
});

test('catalog routes reject every write method without reading a request body', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await handlePhase4CatalogRequest(request('/audit/v1/tool-profiles', {
      method,
      headers: { ...bearer('audit-admin-test-key'), 'content-type': 'application/json' },
      body: JSON.stringify({ image: 'ghcr.io/example:latest', rpcUrl: 'https://rpc.invalid', privateKey: 'secret' })
    }), env());
    assert.equal(response.status, 405);
    assert.equal((await response.json()).error.code, 'method_not_allowed');
  }
});

test('unmatched paths return null for the existing API composition', async () => {
  assert.equal(await handlePhase4CatalogRequest(request('/audit/v1/campaigns'), env()), null);
});

test('Phase 4 health, capabilities, and readiness-facing state remain execution-disabled', () => {
  assert.deepEqual(auditPhase4Health(), {
    status: 'ok', service: 'curveyield-audit-api', version: '0.4.0', phase: 4
  });
  const capabilities = auditPhase4Capabilities({
    service: 'curveyield-audit', apiVersion: 'audit-v1', phase: 3,
    campaigns: true, jobs: true, executionEnabled: false,
    storage: 'r2-standard', executionState: 'awaiting_executor'
  });
  assert.equal(capabilities.phase, 4);
  assert.equal(capabilities.toolProfileCatalog, true);
  assert.equal(capabilities.toolProfileContracts, true);
  assert.equal(capabilities.adapterPlans, true);
  assert.equal(capabilities.outputParsers, false);
  assert.equal(capabilities.executionEnabled, false);
  assert.equal(capabilities.executionState, 'awaiting_executor');
  assert.equal(capabilities.executorState, 'unavailable');
});

test('API public exports contain no execution-like operation', () => {
  const prohibited = /(?:^|_)(submit|execute|run|spawn|install|fetch|network|broadcast)(?:_|$)/i;
  for (const name of Object.keys(phase4Api)) assert.doesNotMatch(name, prohibited);
});
