const FORBIDDEN_KEYS = new Set([
  'privateKey', 'privateKeys', 'mnemonic', 'seed', 'secret', 'signer',
  'rpcUrl', 'rawTransaction', 'signedTransaction', 'shell', 'command',
  'script', 'npmScript', 'broadcast'
]);

const ENGINE_MODES = new Set(['hardhat-edr', 'ganache', 'auto', 'differential']);
const ENGINE_NAMES = new Set(['hardhat-edr', 'ganache']);
const START_MODES = new Set(['explicit', 'latest-at-start', 'tag', 'legacy-block']);
const TAGS = new Set(['latest', 'safe', 'finalized']);
const PROGRESSION_MODES = new Set([
  'none', 'manual', 'follow-latest', 'follow-safe', 'follow-finalized',
  'advance-by-block-count', 'advance-by-time', 'scripted-sequence'
]);
const STATE_STRATEGIES = new Set([
  'discard', 'replay-workflow', 'replay-from-checkpoint',
  'replay-selected-steps', 'transaction-journal', 'state-overlay', 'custom-handler'
]);
const DISTRIBUTION_STRATEGIES = new Set([
  'round-robin', 'weighted-round-robin', 'least-used', 'random',
  'sticky-session', 'sticky-method', 'sticky-block', 'failover-only', 'custom-weighted'
]);
const ROUTES = new Set(['primary', 'primary-only', 'secondary', 'secondary-only', 'any']);
const CONSISTENCY_POLICIES = new Set([
  'fail', 'majority', 'quarantine-minority', 'prefer-primary',
  'prefer-secondary', 'record-only', 'custom'
]);

function validationError(code, message, path) {
  const error = new Error(message);
  error.name = 'SimulationConfigValidationError';
  error.code = code;
  error.path = path;
  return error;
}

function plainObject(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('invalid_type', `${path} must be an object`, path);
  }
  return value;
}

function scanForbidden(value, path = '$.simulation') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbidden(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_KEYS.has(key)) {
      throw validationError('forbidden_field', `${childPath} is forbidden`, childPath);
    }
    scanForbidden(child, childPath);
  }
}

function rejectUnknown(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw validationError('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`);
    }
  }
}

function enumValue(value, allowed, fallback, path) {
  const normalized = value ?? fallback;
  if (typeof normalized !== 'string' || !allowed.has(normalized)) {
    throw validationError('invalid_value', `${path} is invalid`, path);
  }
  return normalized;
}

function booleanValue(value, fallback, path) {
  const normalized = value ?? fallback;
  if (typeof normalized !== 'boolean') {
    throw validationError('invalid_type', `${path} must be boolean`, path);
  }
  return normalized;
}

function positiveInteger(value, fallback, path, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const normalized = value ?? fallback;
  if (!Number.isSafeInteger(normalized) || normalized < min || normalized > max) {
    throw validationError('invalid_integer', `${path} must be an integer from ${min} to ${max}`, path);
  }
  return normalized;
}

function stringArray(value, fallback, path, allowed) {
  const normalized = value ?? fallback;
  if (!Array.isArray(normalized) || normalized.some((item) => typeof item !== 'string' || (allowed && !allowed.has(item)))) {
    throw validationError('invalid_array', `${path} must be an allowed string array`, path);
  }
  return [...normalized];
}

function validateStart(value, legacyBlock) {
  const input = value ?? (legacyBlock === 'latest'
    ? { mode: 'latest-at-start' }
    : { mode: 'explicit', blockNumber: legacyBlock });
  plainObject(input, '$.simulation.fork.start');
  rejectUnknown(input, new Set(['mode', 'blockNumber', 'tag']), '$.simulation.fork.start');
  const mode = enumValue(input.mode, START_MODES, 'latest-at-start', '$.simulation.fork.start.mode');
  if (mode === 'explicit') {
    return {
      mode,
      blockNumber: positiveInteger(input.blockNumber, undefined, '$.simulation.fork.start.blockNumber', { min: 0 })
    };
  }
  if (mode === 'tag') {
    return {
      mode,
      tag: enumValue(input.tag, TAGS, 'safe', '$.simulation.fork.start.tag')
    };
  }
  if (input.blockNumber !== undefined || input.tag !== undefined) {
    throw validationError('invalid_combination', 'blockNumber and tag are not valid for this start mode', '$.simulation.fork.start');
  }
  return { mode };
}

function validateEngine(value) {
  const input = value ?? {};
  plainObject(input, '$.simulation.engine');
  rejectUnknown(input, new Set(['mode', 'preference', 'fallbackOn', 'engines', 'comparison', 'options']), '$.simulation.engine');
  const mode = enumValue(input.mode, ENGINE_MODES, 'hardhat-edr', '$.simulation.engine.mode');
  const preference = stringArray(input.preference, ['hardhat-edr', 'ganache'], '$.simulation.engine.preference', ENGINE_NAMES);
  const engines = stringArray(input.engines, mode === 'differential' ? ['hardhat-edr', 'ganache'] : [], '$.simulation.engine.engines', ENGINE_NAMES);
  const fallbackOn = stringArray(input.fallbackOn, [], '$.simulation.engine.fallbackOn');
  const comparison = input.comparison ?? {};
  plainObject(comparison, '$.simulation.engine.comparison');
  const options = input.options ?? {};
  plainObject(options, '$.simulation.engine.options');
  scanForbidden(options, '$.simulation.engine.options');
  return { mode, preference, fallbackOn, engines, comparison: { ...comparison }, options: { ...options } };
}

function validateFork(value, legacyBlock) {
  const input = value ?? {};
  plainObject(input, '$.simulation.fork');
  rejectUnknown(input, new Set(['start', 'upstreamProgression']), '$.simulation.fork');
  const progression = input.upstreamProgression ?? {};
  plainObject(progression, '$.simulation.fork.upstreamProgression');
  rejectUnknown(
    progression,
    new Set(['mode', 'stateStrategy', 'pollEverySeconds', 'maximumReforks', 'blockCount', 'seconds', 'sequence']),
    '$.simulation.fork.upstreamProgression'
  );
  return {
    start: validateStart(input.start, legacyBlock),
    upstreamProgression: {
      mode: enumValue(progression.mode, PROGRESSION_MODES, 'none', '$.simulation.fork.upstreamProgression.mode'),
      stateStrategy: enumValue(progression.stateStrategy, STATE_STRATEGIES, 'discard', '$.simulation.fork.upstreamProgression.stateStrategy'),
      pollEverySeconds: positiveInteger(progression.pollEverySeconds, 30, '$.simulation.fork.upstreamProgression.pollEverySeconds'),
      maximumReforks: positiveInteger(progression.maximumReforks, 0, '$.simulation.fork.upstreamProgression.maximumReforks', { min: 0 }),
      blockCount: progression.blockCount,
      seconds: progression.seconds,
      sequence: progression.sequence
    }
  };
}

function validateRpc(value) {
  const input = value ?? {};
  plainObject(input, '$.simulation.rpc');
  rejectUnknown(
    input,
    new Set([
      'allowLegacyRpcFallback', 'distribution', 'methodRoutes', 'health',
      'consistency', 'allowPrimaryForSecondaryFailure', 'allowSecondaryForPrimaryFailure',
      'unknownMethodPool', 'retryDelaysMs', 'requestTimeoutMs'
    ]),
    '$.simulation.rpc'
  );
  const distribution = input.distribution ?? {};
  plainObject(distribution, '$.simulation.rpc.distribution');
  rejectUnknown(
    distribution,
    new Set(['strategy', 'primaryWeights', 'secondaryWeights', 'rotateEveryRequests']),
    '$.simulation.rpc.distribution'
  );
  const methodRoutes = input.methodRoutes ?? {};
  plainObject(methodRoutes, '$.simulation.rpc.methodRoutes');
  for (const [method, route] of Object.entries(methodRoutes)) {
    if (!/^[A-Za-z][A-Za-z0-9_*]*$/.test(method) || !ROUTES.has(route)) {
      throw validationError('invalid_method_route', `Invalid route for ${method}`, `$.simulation.rpc.methodRoutes.${method}`);
    }
  }
  const health = input.health ?? {};
  plainObject(health, '$.simulation.rpc.health');
  rejectUnknown(
    health,
    new Set([
      'sessionFailureThreshold', 'crossSessionFailureThreshold', 'sessionAction',
      'crossSessionAction', 'countingMode', 'resetCountAfterSuccess',
      'successResetsConsecutiveSessions'
    ]),
    '$.simulation.rpc.health'
  );
  const consistency = input.consistency ?? {};
  plainObject(consistency, '$.simulation.rpc.consistency');
  rejectUnknown(
    consistency,
    new Set([
      'requireChainIdMatch', 'requireForkBlockHashMatch', 'crossCheckProviders',
      'onDisagreement', 'proofVerification'
    ]),
    '$.simulation.rpc.consistency'
  );
  const retryDelaysMs = input.retryDelaysMs ?? [0, 250, 1_000, 2_500];
  if (!Array.isArray(retryDelaysMs) || retryDelaysMs.length === 0 || retryDelaysMs.some((item) => !Number.isSafeInteger(item) || item < 0 || item > 60_000)) {
    throw validationError('invalid_retry_delays', '$.simulation.rpc.retryDelaysMs is invalid', '$.simulation.rpc.retryDelaysMs');
  }
  return {
    allowLegacyRpcFallback: booleanValue(input.allowLegacyRpcFallback, true, '$.simulation.rpc.allowLegacyRpcFallback'),
    distribution: {
      strategy: enumValue(distribution.strategy, DISTRIBUTION_STRATEGIES, 'round-robin', '$.simulation.rpc.distribution.strategy'),
      primaryWeights: distribution.primaryWeights ?? [],
      secondaryWeights: distribution.secondaryWeights ?? [],
      rotateEveryRequests: positiveInteger(distribution.rotateEveryRequests, 1, '$.simulation.rpc.distribution.rotateEveryRequests')
    },
    methodRoutes: { ...methodRoutes },
    health: {
      sessionFailureThreshold: positiveInteger(health.sessionFailureThreshold, 3, '$.simulation.rpc.health.sessionFailureThreshold'),
      crossSessionFailureThreshold: positiveInteger(health.crossSessionFailureThreshold, 4, '$.simulation.rpc.health.crossSessionFailureThreshold'),
      sessionAction: health.sessionAction ?? 'quarantine',
      crossSessionAction: health.crossSessionAction ?? 'disable-until-admin',
      countingMode: health.countingMode ?? 'consecutive',
      resetCountAfterSuccess: booleanValue(health.resetCountAfterSuccess, true, '$.simulation.rpc.health.resetCountAfterSuccess'),
      successResetsConsecutiveSessions: booleanValue(
        health.successResetsConsecutiveSessions,
        true,
        '$.simulation.rpc.health.successResetsConsecutiveSessions'
      )
    },
    consistency: {
      requireChainIdMatch: booleanValue(consistency.requireChainIdMatch, true, '$.simulation.rpc.consistency.requireChainIdMatch'),
      requireForkBlockHashMatch: booleanValue(consistency.requireForkBlockHashMatch, true, '$.simulation.rpc.consistency.requireForkBlockHashMatch'),
      crossCheckProviders: positiveInteger(consistency.crossCheckProviders, 1, '$.simulation.rpc.consistency.crossCheckProviders'),
      onDisagreement: enumValue(consistency.onDisagreement, CONSISTENCY_POLICIES, 'fail', '$.simulation.rpc.consistency.onDisagreement'),
      proofVerification: consistency.proofVerification ?? 'off'
    },
    allowPrimaryForSecondaryFailure: booleanValue(
      input.allowPrimaryForSecondaryFailure,
      true,
      '$.simulation.rpc.allowPrimaryForSecondaryFailure'
    ),
    allowSecondaryForPrimaryFailure: booleanValue(
      input.allowSecondaryForPrimaryFailure,
      false,
      '$.simulation.rpc.allowSecondaryForPrimaryFailure'
    ),
    unknownMethodPool: input.unknownMethodPool ?? 'primary',
    retryDelaysMs: [...retryDelaysMs],
    requestTimeoutMs: positiveInteger(input.requestTimeoutMs, 30_000, '$.simulation.rpc.requestTimeoutMs')
  };
}

export function validateSimulationConfig(value = {}, { legacyBlock = 'latest' } = {}) {
  plainObject(value, '$.simulation');
  scanForbidden(value);
  rejectUnknown(value, new Set(['engine', 'fork', 'rpc', 'reporting']), '$.simulation');
  const reporting = value.reporting ?? {};
  plainObject(reporting, '$.simulation.reporting');
  return {
    engine: validateEngine(value.engine),
    fork: validateFork(value.fork, legacyBlock),
    rpc: validateRpc(value.rpc),
    reporting: { ...reporting }
  };
}

export const LIVE_FORK_ENUMS = Object.freeze({
  ENGINE_MODES,
  ENGINE_NAMES,
  START_MODES,
  TAGS,
  PROGRESSION_MODES,
  STATE_STRATEGIES,
  DISTRIBUTION_STRATEGIES,
  ROUTES,
  CONSISTENCY_POLICIES
});
