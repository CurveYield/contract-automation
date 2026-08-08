export const TIER3_CONTROLLER_ADAPTER_VERSION_V1 = 'tier3-controller-adapter-v1';

export const TIER3_CONTROLLER_COMPATIBILITY_V1 = Object.freeze({
  controller: Object.freeze({
    repository: 'CurveYield/audit-controller',
    compatibilityCommit: 'd4851886ece3e8793dcc2a99f97f6d34da10e1cd',
    releaseIdentity: 'audit-controller@hosted-tier3-v1',
    processId: 'deep-assurance-v6',
    instructionReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.13.0',
  }),
  automation: Object.freeze({
    repository: 'CurveYield/contract-automation',
    releaseIdentity: 'contract-automation@round5-tier3-v1',
  }),
  networkScope: Object.freeze({
    chains: Object.freeze(['ethereum', 'base']),
    defaultChain: 'base',
  }),
});

function fail(field, expected) {
  throw new TypeError(`${field} must equal ${expected}`);
}

export function assertControllerCompatibilityV1(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('controller compatibility must be an object');
  }
  if (value.adapterVersion !== TIER3_CONTROLLER_ADAPTER_VERSION_V1) {
    fail('adapterVersion', TIER3_CONTROLLER_ADAPTER_VERSION_V1);
  }

  const expected = TIER3_CONTROLLER_COMPATIBILITY_V1;
  const controller = value.controller;
  if (!controller || typeof controller !== 'object' || Array.isArray(controller)) {
    throw new TypeError('controller compatibility is required');
  }
  for (const key of [
    'repository',
    'compatibilityCommit',
    'releaseIdentity',
    'processId',
    'instructionReleaseIdentity',
  ]) {
    if (controller[key] !== expected.controller[key]) fail(`controller.${key}`, expected.controller[key]);
  }

  const automation = value.automation;
  if (!automation || typeof automation !== 'object' || Array.isArray(automation)) {
    throw new TypeError('automation compatibility is required');
  }
  for (const key of ['repository', 'releaseIdentity']) {
    if (automation[key] !== expected.automation[key]) fail(`automation.${key}`, expected.automation[key]);
  }

  const scope = value.networkScope;
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new TypeError('networkScope is required');
  }
  if (!Array.isArray(scope.chains)
      || scope.chains.length !== 2
      || scope.chains[0] !== 'ethereum'
      || scope.chains[1] !== 'base') {
    fail('networkScope.chains', '[ethereum,base]');
  }
  if (scope.defaultChain !== 'base') fail('networkScope.defaultChain', 'base');

  return value;
}
