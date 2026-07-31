import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_CAPABILITIES,
  AUDIT_JOB_STATES,
  AUDIT_SCOPES,
  ValidationError,
  assertAuditId,
  assertScopes,
  createOperationBudget,
  validateAuditJobRequest
} from '../src/index.mjs';

const validRequest = {
  workspaceId: 'ws_0123456789abcdef0123456789abcdef',
  campaignId: 'cmp_0123456789abcdef0123456789abcdef',
  profileId: 'prf_0123456789abcdef0123456789abcdef',
  tool: 'foundry-test',
  configuration: { matchPath: 'test/**/*.t.sol' },
  resourceClass: 'standard-test',
  timeoutSeconds: 1800,
  retentionPolicy: 'free-development',
  expectedEvidence: ['tests', 'raw-output'],
  idempotencyKey: 'idem-phase1-001'
};

test('Phase 1 capabilities are execution disabled', () => {
  assert.equal(AUDIT_CAPABILITIES.executionEnabled, false);
  assert.equal(AUDIT_CAPABILITIES.phase, 1);
  assert.equal(Object.isFrozen(AUDIT_CAPABILITIES), true);
});

test('exposes the four non-Lite Audit scopes', () => {
  assert.deepEqual([...AUDIT_SCOPES], ['audit:read', 'audit:submit', 'audit:admin', 'audit:internal']);
});

test('publishes the explicit audit lifecycle', () => {
  assert.deepEqual([...AUDIT_JOB_STATES], [
    'submitted', 'validating', 'admitted', 'queued', 'awaiting_executor',
    'provisioning', 'running', 'collecting_evidence', 'completed', 'failed',
    'cancelled', 'timed_out', 'policy_rejected'
  ]);
});

test('validates typed audit IDs', () => {
  assert.equal(assertAuditId(validRequest.workspaceId, 'workspace'), validRequest.workspaceId);
  assert.throws(
    () => assertAuditId('job_bad', 'job'),
    (error) => error instanceof ValidationError && error.code === 'invalid_id'
  );
});

test('accepts a structured allowlisted job request', () => {
  assert.deepEqual(validateAuditJobRequest(validRequest), validRequest);
});

test('rejects unknown top-level fields', () => {
  assert.throws(
    () => validateAuditJobRequest({ ...validRequest, surprise: true }),
    (error) => error instanceof ValidationError && error.code === 'unknown_field' && error.path === '$.surprise'
  );
});

test('recursively rejects every prohibited execution and signing concept', () => {
  const forbidden = [
    ['shell', 'bash'], ['command', 'forge test'], ['script', './run.sh'],
    ['Dockerfile', 'FROM ubuntu'], ['image', 'custom:latest'], ['binary', '/tmp/tool'],
    ['plugin', './plugin.js'], ['packageManagerCommand', 'npm install'],
    ['url', 'https://example.invalid'], ['rpcUrl', 'https://rpc.invalid'],
    ['privateKey', '0xabc'], ['mnemonic', 'word word'], ['signer', 'owner'],
    ['rawTransaction', '0x01'], ['signedTransaction', '0x02'],
    ['walletMethod', 'eth_sign'], ['privileged', true], ['broadcast', true]
  ];
  for (const [key, value] of forbidden) {
    assert.throws(
      () => validateAuditJobRequest({
        ...validRequest,
        configuration: { safe: { nested: { [key]: value } } }
      }),
      (error) => error instanceof ValidationError && error.code === 'forbidden_field',
      key
    );
  }
});

test('checks scope membership without accepting Lite scope names', () => {
  assert.deepEqual(assertScopes(['audit:read', 'audit:submit'], ['audit:submit']), ['audit:submit']);
  assert.throws(
    () => assertScopes(['preflightsim:client'], ['audit:read']),
    (error) => error instanceof ValidationError && error.code === 'invalid_scope'
  );
  assert.throws(
    () => assertScopes(['audit:read'], ['audit:admin']),
    (error) => error instanceof ValidationError && error.code === 'insufficient_scope'
  );
});

test('creates a bounded nonnegative R2 operation budget', () => {
  assert.deepEqual(createOperationBudget({ classA: 5, classB: 3, storageBytes: 1024 }), {
    classA: 5,
    classB: 3,
    storageBytes: 1024
  });
  assert.throws(
    () => createOperationBudget({ classA: -1, classB: 0, storageBytes: 0 }),
    (error) => error instanceof ValidationError && error.code === 'invalid_budget'
  );
});
