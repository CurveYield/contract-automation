import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditPhase4Capabilities,
  handlePhase4CatalogRequest
} from '../src/phase4-catalog.mjs';
import { PHASE4_PROFILE_IDS } from '../../../packages/audit-tool-profile-contracts/src/index.mjs';
import { PARSER_VERSIONS } from '../../../packages/audit-tool-parsers/src/index.mjs';

function request(path, init = {}) {
  return new Request(`https://api.audit.preflight.curveyield.online${path}`, init);
}
function bearer(key) { return { authorization: `Bearer ${key}` }; }
function env(overrides = {}) {
  return {
    AUDIT_CLIENT_API_KEY: 'audit-client-test-key',
    AUDIT_GPT_API_KEY: 'audit-gpt-test-key',
    AUDIT_READ_API_KEY: 'audit-read-test-key',
    AUDIT_SUBMIT_API_KEY: 'audit-submit-test-key',
    AUDIT_ADMIN_API_KEY: 'audit-admin-test-key',
    AUDIT_EDGE_CONTROL_PLANE_TOKEN: 'edge-control-plane-secret',
    AUDIT_UPLOAD_GRANT_SIGNING_KEY: 'attestation-secret',
    CURVEYIELD_LITE_API_KEY: 'lite-secret',
    CORS_ORIGIN: 'https://audit.preflight.curveyield.online',
    ...overrides
  };
}

const EXPECTED_IDS = [...PHASE4_PROFILE_IDS].sort();

test('approved persistent and legacy read identities may read the catalog', async () => {
  for (const key of [
    'audit-client-test-key', 'audit-gpt-test-key', 'audit-read-test-key',
    'audit-submit-test-key', 'audit-admin-test-key'
  ]) {
    const response = await handlePhase4CatalogRequest(
      request('/audit/v1/tool-profiles', { headers: bearer(key) }), env()
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.profiles.map((profile) => profile.profileId), EXPECTED_IDS);
    for (const profile of body.profiles) {
      assert.equal(profile.parserVersion, PARSER_VERSIONS[profile.profileId]);
    }
  }
});

test('control-plane, attestation, Lite, malformed, absent, and unrelated credentials fail', async () => {
  for (const key of [
    undefined, '', 'edge-control-plane-secret', 'attestation-secret', 'lite-secret', 'unrelated'
  ]) {
    const headers = key === undefined ? {} : bearer(key);
    const response = await handlePhase4CatalogRequest(request('/audit/v1/tool-profiles', { headers }), env());
    assert.equal(response.status, 401);
  }
});

test('catalog write methods are rejected without body parsing', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const stream = new ReadableStream({ start(controller) { controller.error(new Error('body must not be read')); } });
    const response = await handlePhase4CatalogRequest(new Request(
      'https://api.audit.preflight.curveyield.online/audit/v1/tool-profiles',
      { method, headers: bearer('audit-client-test-key'), body: stream, duplex: 'half' }
    ), env());
    assert.equal(response.status, 405);
  }
});

test('capabilities are derived from imported packages and remain non-executing', () => {
  const capabilities = auditPhase4Capabilities({ campaigns: true });
  assert.equal(capabilities.toolProfileCatalog, true);
  assert.equal(capabilities.toolProfileContracts, true);
  assert.equal(capabilities.adapterPlans, true);
  assert.equal(capabilities.outputParsers, true);
  assert.equal(capabilities.resultContracts, false);
  assert.equal(capabilities.executionEnabled, false);
  assert.equal(capabilities.executionState, 'awaiting_executor');
  assert.equal(capabilities.executorState, 'unavailable');
});

test('request data cannot enable capabilities', () => {
  const capabilities = auditPhase4Capabilities({
    outputParsers: false,
    resultContracts: true,
    executionEnabled: true,
    executionState: 'enabled',
    executorState: 'available'
  });
  assert.equal(capabilities.outputParsers, true);
  assert.equal(capabilities.resultContracts, false);
  assert.equal(capabilities.executionEnabled, false);
  assert.equal(capabilities.executionState, 'awaiting_executor');
  assert.equal(capabilities.executorState, 'unavailable');
});
