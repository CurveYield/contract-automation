import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIER3_CONTROLLER_ADAPTER_VERSION_V2,
  normalizeControllerProjectionV2
} from '../src/tier3-controller-v2.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const valid = {
  adapterVersion: 'tier3-controller-adapter-v2',
  controllerRelease: 'ai-auditor-deep-assurance-v6@16.13.0',
  controllerProtocolSha: SHA,
  automationRelease: '1111111111111111111111111111111111111111',
  networkScope: { active: ['ethereum', 'base'], default: 'base' },
  campaign: { id: 'cmp_1', status: 'ACTIVE', completionStatus: null, securityVerdict: null },
  phases: [], lanes: [], instructionProofs: [], findings: [], remediation: [], evidence: [],
  report: { complete: false, exactRelease: null }
};

test('exports v2 adapter identity', () => {
  assert.equal(TIER3_CONTROLLER_ADAPTER_VERSION_V2, 'tier3-controller-adapter-v2');
});

test('requires exact immutable protocol sha', () => {
  assert.throws(() => normalizeControllerProjectionV2({ ...valid, controllerProtocolSha: 'main' }), /controllerProtocolSha/);
});

test('keeps completion and verdict separate', () => {
  assert.throws(() => normalizeControllerProjectionV2({
    ...valid,
    campaign: { ...valid.campaign, securityVerdict: 'PASS' }
  }), /security verdict/i);
});

test('requires exact Ethereum and Base scope with Base default', () => {
  assert.throws(() => normalizeControllerProjectionV2({
    ...valid,
    networkScope: { active: ['ethereum', 'base', 'arbitrum'], default: 'base' }
  }), /network scope/i);
});
