import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIER3_CONTROLLER_ADAPTER_VERSION_V2,
  TIER3_CONTROLLER_COMPATIBILITY_V2,
  assertControllerCompatibilityV2,
} from '../src/tier3-controller-v3.mjs';

test('Tier 3 v2 adapter pins the current Deep Assurance 16.14 release tuple', () => {
  assert.equal(TIER3_CONTROLLER_ADAPTER_VERSION_V2, 'tier3-controller-adapter-v2');
  assert.deepEqual(TIER3_CONTROLLER_COMPATIBILITY_V2, {
    controller: {
      repository: 'CurveYield/audit-controller',
      compatibilityCommit: '48b031f06c7d7ed3573b42e371e123299722b451',
      releaseIdentity: 'audit-controller@48b031f06c7d7ed3573b42e371e123299722b451',
      processId: 'deep-assurance-v6',
      instructionReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.14.0',
    },
    automation: {
      repository: 'CurveYield/contract-automation',
      compatibilityCommit: 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8',
      releaseIdentity: 'contract-automation@ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8',
    },
    networkScope: { chains: ['ethereum', 'base'], defaultChain: 'base' },
  });
});

test('compatibility validator rejects stale 16.13 hosted release', () => {
  const stale = {
    adapterVersion: 'tier3-controller-adapter-v1',
    controller: {
      repository: 'CurveYield/audit-controller',
      compatibilityCommit: 'd4851886ece3e8793dcc2a99f97f6d34da10e1cd',
      releaseIdentity: 'audit-controller@hosted-tier3-v1',
      processId: 'deep-assurance-v6',
      instructionReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.13.0',
    },
    automation: { repository: 'CurveYield/contract-automation', releaseIdentity: 'contract-automation@round5-tier3-v1' },
    networkScope: { chains: ['ethereum', 'base'], defaultChain: 'base' },
  };
  assert.throws(() => assertControllerCompatibilityV2(stale), /incompatible/i);
});
