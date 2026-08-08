import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIER3_CONTROLLER_ADAPTER_VERSION_V1,
  TIER3_CONTROLLER_COMPATIBILITY_V1,
  assertControllerCompatibilityV1,
} from '../src/tier3-controller-v1.mjs';

function compatible(overrides = {}) {
  return {
    adapterVersion: TIER3_CONTROLLER_ADAPTER_VERSION_V1,
    controller: { ...TIER3_CONTROLLER_COMPATIBILITY_V1.controller },
    automation: { ...TIER3_CONTROLLER_COMPATIBILITY_V1.automation },
    networkScope: {
      chains: [...TIER3_CONTROLLER_COMPATIBILITY_V1.networkScope.chains],
      defaultChain: TIER3_CONTROLLER_COMPATIBILITY_V1.networkScope.defaultChain,
    },
    ...overrides,
  };
}

test('exports the exact hosted Tier 3 v1 compatibility identities', () => {
  assert.equal(TIER3_CONTROLLER_ADAPTER_VERSION_V1, 'tier3-controller-adapter-v1');
  assert.deepEqual(TIER3_CONTROLLER_COMPATIBILITY_V1, {
    controller: {
      repository: 'CurveYield/audit-controller',
      compatibilityCommit: 'd4851886ece3e8793dcc2a99f97f6d34da10e1cd',
      releaseIdentity: 'audit-controller@hosted-tier3-v1',
      processId: 'deep-assurance-v6',
      instructionReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.13.0',
    },
    automation: {
      repository: 'CurveYield/contract-automation',
      releaseIdentity: 'contract-automation@round5-tier3-v1',
    },
    networkScope: {
      chains: ['ethereum', 'base'],
      defaultChain: 'base',
    },
  });
});

test('accepts only the exact canonical hosted controller release and active network scope', () => {
  assert.equal(assertControllerCompatibilityV1(compatible()).adapterVersion, 'tier3-controller-adapter-v1');

  const mutations = [
    (value) => { value.adapterVersion = 'tier3-controller-adapter-v2'; },
    (value) => { value.controller.compatibilityCommit = '1'.repeat(40); },
    (value) => { value.controller.releaseIdentity = 'audit-controller@other'; },
    (value) => { value.controller.instructionReleaseIdentity = 'ai-auditor-deep-assurance-v6@16.12.0'; },
    (value) => { value.automation.releaseIdentity = 'contract-automation@other'; },
    (value) => { value.networkScope.chains = ['base', 'ethereum']; },
    (value) => { value.networkScope.chains = ['ethereum', 'base', 'polygon']; },
    (value) => { value.networkScope.defaultChain = 'ethereum'; },
  ];

  for (const mutate of mutations) {
    const value = compatible();
    mutate(value);
    assert.throws(() => assertControllerCompatibilityV1(value));
  }
});

test('compatibility constants are frozen to prevent accidental mutation', () => {
  assert.equal(Object.isFrozen(TIER3_CONTROLLER_COMPATIBILITY_V1), true);
  assert.equal(Object.isFrozen(TIER3_CONTROLLER_COMPATIBILITY_V1.controller), true);
  assert.equal(Object.isFrozen(TIER3_CONTROLLER_COMPATIBILITY_V1.automation), true);
  assert.equal(Object.isFrozen(TIER3_CONTROLLER_COMPATIBILITY_V1.networkScope), true);
  assert.equal(Object.isFrozen(TIER3_CONTROLLER_COMPATIBILITY_V1.networkScope.chains), true);
});
