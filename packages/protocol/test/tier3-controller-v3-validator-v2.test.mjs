import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeControllerProjectionV3 } from '../src/tier3-controller-v3-validator-v2.mjs';

const value = {
  adapterVersion: 'tier3-controller-adapter-v3',
  controllerRelease: 'ai-auditor-deep-assurance-v6@16.13.0',
  controllerProtocolSha: '2'.repeat(40),
  automationRelease: '4'.repeat(40),
  networkScope: { active: ['ethereum', 'base'], default: 'base' },
  campaign: { id: 'cmp_1', status: 'ACTIVE', completionStatus: null, securityVerdict: null },
  phases: [], lanes: [], workers: [], assignments: [], instructionProofs: [], findings: [], remediation: [], evidence: [],
  provenance: { eventCount: 1, eventHead: 'a'.repeat(64), recentEvents: [{ hash: 'a'.repeat(64), previousHash: null, commandId: 'c1', type: 'campaign.created', actor: { type: 'controller', id: 'o1' }, timestamp: '2026-08-08T01:00:00.000Z' }] },
  report: { complete: false, exactRelease: null }
};

test('accepts 64-hex controller event-chain head while keeping release SHAs 40-hex', () => {
  const out = normalizeControllerProjectionV3(value);
  assert.equal(out.provenance.eventHead.length, 64);
  assert.equal(out.controllerProtocolSha.length, 40);
});

test('rejects non-SHA-256 event head', () => {
  assert.throws(() => normalizeControllerProjectionV3({ ...value, provenance: { ...value.provenance, eventHead: 'b'.repeat(40) } }), /eventHead/);
});
