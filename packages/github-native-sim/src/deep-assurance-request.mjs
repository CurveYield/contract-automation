import { createHash } from 'node:crypto';
import path from 'node:path';

export const DEEP_ASSURANCE_REQUEST_SCHEMA_VERSION = 'deep-assurance-github-request-v1';
export const DEEP_ASSURANCE_RUNNER_RELEASE_VERSION = 'deep-assurance-github-bridge-v1';
export const DEEP_ASSURANCE_BASE_RELEASE = Object.freeze({
  repository: 'CurveYield/contract-automation',
  branch: 'orchestrator/round4-ci-base-v1',
  commit: 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8',
  contractVersion: 'contract-automation-finalized-v1'
});

const REQUEST_ID_PATTERN = /^dar-[0-9a-f]{32}$/;
const REQUEST_PATH_PATTERN = /^github-native-sim\/requests\/(dar-[0-9a-f]{32})\/request\.json$/;
const PROFILE_IDS = new Set(['github-native-compile-v1', 'github-native-simulate-v1']);
const CHAINS = new Set(['ethereum', 'base']);
const TOP_LEVEL_KEYS = new Set([
  'schemaVersion', 'processId', 'contractAutomationRelease', 'runnerRelease',
  'campaignId', 'assignmentId', 'phaseId', 'gateId', 'profileId',
  'source', 'configuration', 'requestId', 'requestDigest'
]);
const IDENTITY_KEYS = new Set([...TOP_LEVEL_KEYS].filter((key) => key !== 'requestId' && key !== 'requestDigest'));
const RELEASE_KEYS = new Set(['repository', 'branch', 'commit', 'contractVersion']);
const RUNNER_RELEASE_KEYS = new Set(['version', 'manifestSha256']);
const SOURCE_KEYS = new Set(['repository', 'commit', 'projectPath']);
const COMPILE_CONFIGURATION_KEYS = new Set([
  'compilerVersion', 'openZeppelinVersion', 'optimizer', 'evmVersion', 'viaIR', 'timeoutMinutes'
]);
const SIMULATION_CONFIGURATION_KEYS = new Set([
  ...COMPILE_CONFIGURATION_KEYS, 'chain', 'block', 'simulation', 'workflow'
]);
const FORBIDDEN_KEYS = new Set([
  'command', 'commands', 'shell', 'script', 'scripts', 'exec', 'spawn', 'executable',
  'binary', 'image', 'containerimage', 'rpc', 'rpcurl', 'rpcendpoint', 'endpoint', 'url',
  'privatekey', 'mnemonic', 'secret', 'secrets', 'credential', 'credentials', 'wallet',
  'signer', 'signature', 'signedtransaction', 'rawtransaction', 'transaction', 'broadcast',
  'calldata', 'privileged', 'hostmount', 'socket', 'device', 'packageinstall', 'installcommand'
]);

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function plainObject(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${field} must be a plain object`);
  }
  return value;
}

function exactKeys(value, allowed, field) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${field}.${key} is not allowed`);
  }
  for (const key of allowed) {
    if (!(key in value)) throw new TypeError(`${field}.${key} is required`);
  }
}

function nonEmptyString(value, field, maximum = 512) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function lowercaseDigest(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new TypeError(`${field} must be a lowercase SHA-256 digest`);
  }
  return value;
}

function lowercaseCommit(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    throw new TypeError(`${field} must be an exact lowercase 40-character Git commit`);
  }
  return value;
}

function semanticVersion(value, field, { optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  nonEmptyString(value, field, 40);
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new TypeError(`${field} must be an exact semantic version`);
  }
  return value;
}

function normalizedKey(value) {
  return value.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function scanForbidden(value, field = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbidden(item, `${field}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  plainObject(value, field);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(normalizedKey(key))) throw new TypeError(`${field}.${key} is a forbidden field`);
    scanForbidden(child, `${field}.${key}`);
  }
}

function safeRepository(value, field) {
  nonEmptyString(value, field, 200);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) throw new TypeError(`${field} is invalid`);
  return value;
}

function safeProjectPath(value, field) {
  nonEmptyString(value, field, 512);
  if (value === '.') return value;
  if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value) || value.includes('\\')) {
    throw new TypeError(`${field} must be a safe relative projectPath`);
  }
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new TypeError(`${field} must be a safe relative projectPath`);
  }
  return value;
}

function optimizer(value) {
  plainObject(value, '$.configuration.optimizer');
  exactKeys(value, new Set(['enabled', 'runs']), '$.configuration.optimizer');
  if (typeof value.enabled !== 'boolean') throw new TypeError('$.configuration.optimizer.enabled must be boolean');
  if (!Number.isInteger(value.runs) || value.runs < 0 || value.runs > 1_000_000) {
    throw new TypeError('$.configuration.optimizer.runs must be an integer from 0 to 1000000');
  }
  return { enabled: value.enabled, runs: value.runs };
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function identityFrom(value) {
  plainObject(value, '$');
  const identity = {};
  for (const key of IDENTITY_KEYS) {
    if (!(key in value)) throw new TypeError(`$.${key} is required`);
    identity[key] = structuredClone(value[key]);
  }
  return identity;
}

export function calculateDeepAssuranceRequestDigest(value) {
  return createHash('sha256').update(canonicalize(identityFrom(value))).digest('hex');
}

function validateRelease(value) {
  plainObject(value, '$.contractAutomationRelease');
  exactKeys(value, RELEASE_KEYS, '$.contractAutomationRelease');
  for (const key of RELEASE_KEYS) {
    if (value[key] !== DEEP_ASSURANCE_BASE_RELEASE[key]) {
      throw new TypeError(`$.contractAutomationRelease.${key} does not match the finalized base release`);
    }
  }
  return structuredClone(DEEP_ASSURANCE_BASE_RELEASE);
}

function validateRunnerRelease(value, expectedRunnerManifestSha256) {
  plainObject(value, '$.runnerRelease');
  exactKeys(value, RUNNER_RELEASE_KEYS, '$.runnerRelease');
  if (value.version !== DEEP_ASSURANCE_RUNNER_RELEASE_VERSION) throw new TypeError('$.runnerRelease.version is invalid');
  lowercaseDigest(value.manifestSha256, '$.runnerRelease.manifestSha256');
  if (value.manifestSha256 !== expectedRunnerManifestSha256) {
    throw new TypeError('$.runnerRelease does not match the trusted runner release manifest');
  }
  return structuredClone(value);
}

function validateSource(value) {
  plainObject(value, '$.source');
  exactKeys(value, SOURCE_KEYS, '$.source');
  return {
    repository: safeRepository(value.repository, '$.source.repository'),
    commit: lowercaseCommit(value.commit, '$.source.commit'),
    projectPath: safeProjectPath(value.projectPath, '$.source.projectPath')
  };
}

function validateConfiguration(profileId, value) {
  plainObject(value, '$.configuration');
  scanForbidden(value, '$.configuration');
  const allowed = profileId === 'github-native-compile-v1'
    ? COMPILE_CONFIGURATION_KEYS
    : SIMULATION_CONFIGURATION_KEYS;
  exactKeys(value, allowed, '$.configuration');
  const result = {
    compilerVersion: semanticVersion(value.compilerVersion, '$.configuration.compilerVersion'),
    openZeppelinVersion: semanticVersion(value.openZeppelinVersion, '$.configuration.openZeppelinVersion', { optional: true }),
    optimizer: optimizer(value.optimizer),
    evmVersion: nonEmptyString(value.evmVersion, '$.configuration.evmVersion', 40),
    viaIR: value.viaIR,
    timeoutMinutes: value.timeoutMinutes
  };
  if (typeof result.viaIR !== 'boolean') throw new TypeError('$.configuration.viaIR must be boolean');
  if (!Number.isInteger(result.timeoutMinutes) || result.timeoutMinutes < 1 || result.timeoutMinutes > 35) {
    throw new TypeError('$.configuration.timeoutMinutes must be an integer from 1 to 35');
  }
  if (result.openZeppelinVersion === undefined) delete result.openZeppelinVersion;

  if (profileId === 'github-native-simulate-v1') {
    if (!CHAINS.has(value.chain)) throw new TypeError('$.configuration.chain must be ethereum or base');
    if (!Number.isSafeInteger(value.block) || value.block < 0) {
      throw new TypeError('$.configuration.block must be a pinned block number');
    }
    plainObject(value.simulation, '$.configuration.simulation');
    plainObject(value.workflow, '$.configuration.workflow');
    result.chain = value.chain;
    result.block = value.block;
    result.simulation = structuredClone(value.simulation);
    result.workflow = structuredClone(value.workflow);
  }
  return result;
}

export function validateDeepAssuranceRequest(value, { expectedRunnerManifestSha256 } = {}) {
  plainObject(value, '$');
  exactKeys(value, TOP_LEVEL_KEYS, '$');
  scanForbidden(value, '$');
  if (value.schemaVersion !== DEEP_ASSURANCE_REQUEST_SCHEMA_VERSION) throw new TypeError('$.schemaVersion is invalid');
  if (value.processId !== 'deep-assurance-v6') throw new TypeError('$.processId must be deep-assurance-v6');
  lowercaseDigest(expectedRunnerManifestSha256, 'expectedRunnerManifestSha256');
  validateRelease(value.contractAutomationRelease);
  validateRunnerRelease(value.runnerRelease, expectedRunnerManifestSha256);
  for (const field of ['campaignId', 'assignmentId', 'phaseId', 'gateId']) nonEmptyString(value[field], `$.${field}`, 200);
  if (!PROFILE_IDS.has(value.profileId)) throw new TypeError('$.profileId is not supported');
  const source = validateSource(value.source);
  const configuration = validateConfiguration(value.profileId, value.configuration);
  if (!REQUEST_ID_PATTERN.test(value.requestId)) throw new TypeError('$.requestId is invalid');
  lowercaseDigest(value.requestDigest, '$.requestDigest');
  const expectedDigest = calculateDeepAssuranceRequestDigest(value);
  const expectedRequestId = `dar-${expectedDigest.slice(0, 32)}`;
  if (value.requestDigest !== expectedDigest) throw new TypeError('$.requestDigest does not match canonical request identity');
  if (value.requestId !== expectedRequestId) throw new TypeError('$.requestId does not match canonical request identity');
  return deepFreeze({
    schemaVersion: value.schemaVersion,
    processId: value.processId,
    contractAutomationRelease: structuredClone(value.contractAutomationRelease),
    runnerRelease: structuredClone(value.runnerRelease),
    campaignId: value.campaignId,
    assignmentId: value.assignmentId,
    phaseId: value.phaseId,
    gateId: value.gateId,
    profileId: value.profileId,
    source,
    configuration,
    requestId: value.requestId,
    requestDigest: value.requestDigest
  });
}

export function selectDeepAssuranceRequestFromChangedPaths(changedPaths) {
  if (!Array.isArray(changedPaths) || changedPaths.length !== 1) {
    throw new TypeError('Exactly one Deep Assurance request file must change');
  }
  const normalized = String(changedPaths[0]).trim().replace(/^\.\//, '');
  const match = normalized.match(REQUEST_PATH_PATTERN);
  if (!match) throw new TypeError('Changed path must be one Deep Assurance request.json file');
  return deepFreeze({
    requestId: match[1],
    requestPath: normalized,
    requestRoot: normalized.slice(0, -'/request.json'.length)
  });
}

export function buildGitHubNativeJobFromDeepAssuranceRequest(request) {
  const config = request.configuration;
  const simulate = request.profileId === 'github-native-simulate-v1';
  const job = {
    version: 'github-native-sim/v1',
    id: request.requestId,
    mode: simulate ? 'simulate' : 'compile',
    projectPath: 'project',
    compilerVersion: config.compilerVersion,
    optimizer: structuredClone(config.optimizer),
    evmVersion: config.evmVersion,
    viaIR: config.viaIR,
    timeoutMinutes: config.timeoutMinutes,
    workflow: simulate ? structuredClone(config.workflow) : { steps: [] }
  };
  if (config.openZeppelinVersion !== undefined) job.openZeppelinVersion = config.openZeppelinVersion;
  if (simulate) {
    job.chain = config.chain;
    job.block = config.block;
    job.simulation = structuredClone(config.simulation);
  }
  return deepFreeze(job);
}
