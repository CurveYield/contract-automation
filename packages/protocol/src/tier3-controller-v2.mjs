export const TIER3_CONTROLLER_ADAPTER_VERSION_V1 = 'tier3-controller-adapter-v1';

const CONTROLLER = Object.freeze({
  repository: 'CurveYield/audit-controller',
  compatibilityCommit: 'd4851886ece3e8793dcc2a99f97f6d34da10e1cd',
  releaseIdentity: 'audit-controller@hosted-tier3-v1',
  processId: 'deep-assurance-v6',
  instructionReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.13.0',
});

const AUTOMATION = Object.freeze({
  repository: 'CurveYield/contract-automation',
  releaseIdentity: 'contract-automation@round5-tier3-v1',
});

const CHAINS = Object.freeze(['ethereum', 'base']);
const NETWORK_SCOPE = Object.freeze({ chains: CHAINS, defaultChain: 'base' });

export const TIER3_CONTROLLER_COMPATIBILITY_V1 = Object.freeze({
  controller: CONTROLLER,
  automation: AUTOMATION,
  networkScope: NETWORK_SCOPE,
});

function same(left, right, path) {
  if (left !== right) throw new TypeError(`${path} is incompatible with this Tier 3 release`);
}

export function assertControllerCompatibilityV1(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Tier 3 compatibility payload must be an object');
  }

  same(value.adapterVersion, TIER3_CONTROLLER_ADAPTER_VERSION_V1, 'adapterVersion');

  const controller = value.controller;
  if (!controller || typeof controller !== 'object' || Array.isArray(controller)) {
    throw new TypeError('controller compatibility is required');
  }
  for (const field of Object.keys(CONTROLLER)) same(controller[field], CONTROLLER[field], `controller.${field}`);

  const automation = value.automation;
  if (!automation || typeof automation !== 'object' || Array.isArray(automation)) {
    throw new TypeError('automation compatibility is required');
  }
  for (const field of Object.keys(AUTOMATION)) same(automation[field], AUTOMATION[field], `automation.${field}`);

  const networkScope = value.networkScope;
  if (!networkScope || typeof networkScope !== 'object' || Array.isArray(networkScope)) {
    throw new TypeError('networkScope is required');
  }
  if (!Array.isArray(networkScope.chains)
      || networkScope.chains.length !== CHAINS.length
      || networkScope.chains.some((chain, index) => chain !== CHAINS[index])) {
    throw new TypeError('networkScope.chains must equal exactly ethereum,base');
  }
  same(networkScope.defaultChain, NETWORK_SCOPE.defaultChain, 'networkScope.defaultChain');
  return value;
}
