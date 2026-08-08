import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIER3_CONTROLLER_ADAPTER_VERSION_V1,
  assertControllerCompatibilityV1,
  normalizeControllerProjectionV1
} from '../src/tier3-controller-v1.mjs';

const valid = {
  adapterVersion: 'tier3-controller-adapter-v1',
  controllerRelease: 'ai-auditor-deep-assurance-v6@16.13.0',
  automationRelease: 'contract-automation@round5-tier3-v1',
  networkScope: { active: ['ethereum', 'base'], default: 'base' },
  campaign: { id: 'cmp_1', status: 'ACTIVE', completionStatus: null, securityVerdict: null },
  phases: [{ id: 'scope-and-provenance', status: 'PASS' }],
  lanes: [{ id: 'scope-specification-auditor', status: 'ACCEPTED' }],
  instructionProofs: [{ actorId: 'a1', sessionId: 's1', roleId: 'scope-specification-auditor', phaseId: 'scope-and-provenance', status: 'accepted' }],
  findings: [{ id: 'F-1', severity: 'LOW', status: 'OPEN' }],
  remediation: [],
  evidence: [],
  report: { complete: false, exactRelease: null }
};

test('exports exact adapter version', () => {
  assert.equal(TIER3_CONTROLLER_ADAPTER_VERSION_V1, 'tier3-controller-adapter-v1');
});

test('normalizes valid projection without conflating completion and verdict', () => {
  const out = normalizeControllerProjectionV1(valid);
  assert.equal(out.campaign.completionStatus, null);
  assert.equal(out.campaign.securityVerdict, null);
  assert.deepEqual(out.networkScope, { active: ['ethereum', 'base'], default: 'base' });
});

test('rejects unsupported network scope', () => {
  assert.throws(() => normalizeControllerProjectionV1({ ...valid, networkScope: { active: ['ethereum', 'base', 'arbitrum'], default: 'base' } }), /network scope/i);
});

test('rejects missing controller release identity', () => {
  const { controllerRelease, ...rest } = valid;
  assert.throws(() => assertControllerCompatibilityV1(rest), /controllerRelease/);
});

test('rejects security verdict on incomplete campaign', () => {
  assert.throws(() => normalizeControllerProjectionV1({ ...valid, campaign: { ...valid.campaign, securityVerdict: 'PASS' } }), /security verdict/i);
});
