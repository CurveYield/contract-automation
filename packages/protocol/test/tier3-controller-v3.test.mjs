import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeControllerProjectionV3 } from '../src/tier3-controller-v3.mjs';

const SHA = '2222222222222222222222222222222222222222';
const value = {
  adapterVersion: 'tier3-controller-adapter-v3',
  controllerRelease: 'ai-auditor-deep-assurance-v6@16.13.0',
  controllerProtocolSha: SHA,
  automationRelease: '4444444444444444444444444444444444444444',
  networkScope: { active: ['ethereum', 'base'], default: 'base' },
  campaign: { id: 'cmp_1', status: 'ACTIVE', completionStatus: null, securityVerdict: null },
  phases: [], lanes: [], workers: [], assignments: [], instructionProofs: [], findings: [], remediation: [], evidence: [],
  provenance: { eventCount: 0, eventHead: null, recentEvents: [] },
  report: { complete: false, exactRelease: null }
};

test('accepts complete v3 read model', () => {
  const out = normalizeControllerProjectionV3(value);
  assert.deepEqual(out.workers, []);
  assert.deepEqual(out.assignments, []);
  assert.equal(out.provenance.eventCount, 0);
});

test('requires bounded provenance object', () => {
  assert.throws(() => normalizeControllerProjectionV3({ ...value, provenance: null }), /provenance/);
});

test('rejects verdict on incomplete campaign', () => {
  assert.throws(() => normalizeControllerProjectionV3({ ...value, campaign: { ...value.campaign, securityVerdict: 'PASS' } }), /security verdict/i);
});
