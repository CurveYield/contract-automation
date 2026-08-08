export const TIER3_CONTROLLER_ADAPTER_VERSION_V2 = 'tier3-controller-adapter-v2';

const CONTROLLER = Object.freeze({
  repository: 'CurveYield/audit-controller',
  compatibilityCommit: '48b031f06c7d7ed3573b42e371e123299722b451',
  releaseIdentity: 'audit-controller@48b031f06c7d7ed3573b42e371e123299722b451',
  processId: 'deep-assurance-v6',
  instructionReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.14.0',
});

const AUTOMATION = Object.freeze({
  repository: 'CurveYield/contract-automation',
  compatibilityCommit: 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8',
  releaseIdentity: 'contract-automation@ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8',
});

const NETWORK_SCOPE = Object.freeze({
  chains: Object.freeze(['ethereum', 'base']),
  defaultChain: 'base',
});

export const TIER3_CONTROLLER_COMPATIBILITY_V2 = Object.freeze({
  controller: CONTROLLER,
  automation: AUTOMATION,
  networkScope: NETWORK_SCOPE,
});

function same(actual, expected, field) {
  if (actual !== expected) throw new TypeError(`${field} is incompatible with this Tier 3 release`);
}

export function assertControllerCompatibilityV2(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Tier 3 compatibility payload must be an object');
  }
  same(value.adapterVersion, TIER3_CONTROLLER_ADAPTER_VERSION_V2, 'adapterVersion');

  const controller = value.controller;
  if (!controller || typeof controller !== 'object' || Array.isArray(controller)) {
    throw new TypeError('controller compatibility is required');
  }
  for (const [field, expected] of Object.entries(CONTROLLER)) {
    same(controller[field], expected, `controller.${field}`);
  }

  const automation = value.automation;
  if (!automation || typeof automation !== 'object' || Array.isArray(automation)) {
    throw new TypeError('automation compatibility is required');
  }
  for (const [field, expected] of Object.entries(AUTOMATION)) {
    same(automation[field], expected, `automation.${field}`);
  }

  const networkScope = value.networkScope;
  if (!networkScope || typeof networkScope !== 'object' || Array.isArray(networkScope)) {
    throw new TypeError('networkScope is required');
  }
  if (!Array.isArray(networkScope.chains)
      || networkScope.chains.length !== 2
      || networkScope.chains[0] !== 'ethereum'
      || networkScope.chains[1] !== 'base') {
    throw new TypeError('networkScope.chains must equal exactly ethereum,base');
  }
  same(networkScope.defaultChain, 'base', 'networkScope.defaultChain');
  return value;
}
