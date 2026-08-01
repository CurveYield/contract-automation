import path from 'node:path';

import { CHAINS, validateWorkflow } from '../../protocol/src/index.mjs';

const FORBIDDEN_KEYS = new Set([
  'privateKey',
  'privateKeys',
  'mnemonic',
  'seed',
  'secret',
  'signer',
  'rpcUrl',
  'rpc',
  'rawTransaction',
  'signedTransaction',
  'shell',
  'command',
  'script',
  'npmScript',
  'broadcast'
]);

const TOP_LEVEL_KEYS = new Set([
  'version',
  'id',
  'mode',
  'projectPath',
  'compilerVersion',
  'openZeppelinVersion',
  'chain',
  'block',
  'timeoutMinutes',
  'workflow',
  'optimizer',
  'evmVersion',
  'viaIR'
]);

export class GitHubNativeValidationError extends Error {
  constructor(code, message, field = '$') {
    super(message);
    this.name = 'GitHubNativeValidationError';
    this.code = code;
    this.field = field;
  }
}

function assertPlainObject(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new GitHubNativeValidationError('invalid_type', `${field} must be an object`, field);
  }
}

function scanForbidden(value, field = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbidden(item, `${field}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const childField = `${field}.${key}`;
    if (FORBIDDEN_KEYS.has(key)) {
      throw new GitHubNativeValidationError('forbidden_field', `${key} is forbidden`, childField);
    }
    scanForbidden(child, childField);
  }
}

function rejectUnknownKeys(value, allowed, field = '$') {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new GitHubNativeValidationError('unknown_field', `${key} is not allowed`, `${field}.${key}`);
    }
  }
}

function requireString(value, field, { min = 1, max = 4096 } = {}) {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    throw new GitHubNativeValidationError(
      'invalid_string',
      `${field} must be a string between ${min} and ${max} characters`,
      field
    );
  }
  return value;
}

function exactVersion(value, field, { optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  requireString(value, field, { max: 32 });
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new GitHubNativeValidationError(
      'invalid_version',
      `${field} must be an exact semantic version`,
      field
    );
  }
  return value;
}

function validateId(value) {
  requireString(value, 'id', { max: 80 });
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value)) {
    throw new GitHubNativeValidationError(
      'invalid_id',
      'id must begin with an alphanumeric character and contain only alphanumerics, dot, underscore, or hyphen',
      'id'
    );
  }
  return value;
}

function validateProjectPath(value) {
  requireString(value, 'projectPath', { max: 512 });
  if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) {
    throw new GitHubNativeValidationError('invalid_project_path', 'projectPath must be relative', 'projectPath');
  }
  const normalized = value.replaceAll('\\', '/');
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new GitHubNativeValidationError(
      'invalid_project_path',
      'projectPath must stay inside the job directory and use safe path segments',
      'projectPath'
    );
  }
  return normalized;
}

function validateBlock(value) {
  if (value === undefined || value === 'latest') return 'latest';
  if (Number.isSafeInteger(value) && value >= 0) return value;
  throw new GitHubNativeValidationError(
    'invalid_block',
    'block must be latest or a non-negative safe integer',
    'block'
  );
}

function validateOptimizer(value) {
  const optimizer = value ?? { enabled: true, runs: 200 };
  assertPlainObject(optimizer, 'optimizer');
  rejectUnknownKeys(optimizer, new Set(['enabled', 'runs']), 'optimizer');
  if (typeof optimizer.enabled !== 'boolean') {
    throw new GitHubNativeValidationError('invalid_optimizer', 'optimizer.enabled must be boolean', 'optimizer.enabled');
  }
  if (!Number.isInteger(optimizer.runs) || optimizer.runs < 0 || optimizer.runs > 1_000_000) {
    throw new GitHubNativeValidationError(
      'invalid_optimizer',
      'optimizer.runs must be an integer from 0 to 1000000',
      'optimizer.runs'
    );
  }
  return { enabled: optimizer.enabled, runs: optimizer.runs };
}

export function validateGitHubNativeJob(input) {
  assertPlainObject(input, '$');
  scanForbidden(input);
  rejectUnknownKeys(input, TOP_LEVEL_KEYS);

  const version = requireString(input.version, 'version', { max: 40 });
  if (version !== 'github-native-sim/v1') {
    throw new GitHubNativeValidationError(
      'unsupported_version',
      'version must be github-native-sim/v1',
      'version'
    );
  }

  const id = validateId(input.id);
  const mode = requireString(input.mode, 'mode', { max: 16 });
  if (!['compile', 'simulate'].includes(mode)) {
    throw new GitHubNativeValidationError('invalid_mode', 'mode must be compile or simulate', 'mode');
  }

  let chain;
  if (mode === 'simulate' && input.chain === undefined) {
    throw new GitHubNativeValidationError('missing_chain', 'chain is required for simulation', 'chain');
  }
  if (input.chain !== undefined) {
    chain = requireString(input.chain, 'chain', { max: 32 });
    if (!(chain in CHAINS)) {
      throw new GitHubNativeValidationError('unsupported_chain', `Unsupported chain: ${chain}`, 'chain');
    }
  }

  const timeoutMinutes = input.timeoutMinutes ?? 10;
  if (!Number.isInteger(timeoutMinutes) || timeoutMinutes < 1 || timeoutMinutes > 35) {
    throw new GitHubNativeValidationError(
      'invalid_timeout',
      'timeoutMinutes must be an integer from 1 to 35',
      'timeoutMinutes'
    );
  }

  const viaIR = input.viaIR ?? false;
  if (typeof viaIR !== 'boolean') {
    throw new GitHubNativeValidationError('invalid_via_ir', 'viaIR must be boolean', 'viaIR');
  }

  return {
    version,
    id,
    mode,
    projectPath: validateProjectPath(input.projectPath),
    compilerVersion: exactVersion(input.compilerVersion, 'compilerVersion'),
    openZeppelinVersion: exactVersion(input.openZeppelinVersion, 'openZeppelinVersion', { optional: true }),
    chain,
    block: validateBlock(input.block),
    timeoutMinutes,
    workflow: validateWorkflow(input.workflow ?? { steps: [] }, { allowEmpty: mode === 'compile' }),
    optimizer: validateOptimizer(input.optimizer),
    evmVersion: input.evmVersion === undefined
      ? undefined
      : requireString(input.evmVersion, 'evmVersion', { max: 40 }),
    viaIR
  };
}
