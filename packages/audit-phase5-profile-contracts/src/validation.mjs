import { ValidationError } from '../../audit-protocol/src/index.mjs';
import {
  LOCKFILE_NAMES, MAX_UINT32, MUTATION_OPERATORS, PHASE5_PROFILE_IDS,
  SEVERITIES, TEMPLATE_BY_ID, TEST_MODES
} from './templates.mjs';

function plain(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new ValidationError('invalid_plain_object', `${path} must be an ordinary object`, path);
  }
  return value;
}
function exact(value, keys, path) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new ValidationError('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`);
  for (const key of keys) if (!Object.hasOwn(value, key)) throw new ValidationError('missing_field', `${path}.${key} is required`, `${path}.${key}`);
}
function integer(value, path, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new ValidationError('invalid_integer', `${path} is outside the configured range`, path);
  return value;
}
function boolean(value, path) {
  if (typeof value !== 'boolean') throw new ValidationError('invalid_boolean', `${path} must be boolean`, path);
  return value;
}
function strings(value, path, allowed = null, max = 64) {
  if (!Array.isArray(value) || value.length > max) throw new ValidationError('invalid_array', `${path} is invalid`, path);
  const seen = new Set();
  return value.map((item, index) => {
    if (typeof item !== 'string' || item.length < 1 || item.length > 256 || (allowed && !allowed.has(item))) throw new ValidationError('invalid_array_item', `${path}[${index}] is invalid`, `${path}[${index}]`);
    if (seen.has(item)) throw new ValidationError('duplicate_array_item', `${path}[${index}] is duplicated`, `${path}[${index}]`);
    seen.add(item); return item;
  });
}
export function getPhase5ProfileTemplate(profileId) {
  if (!PHASE5_PROFILE_IDS.includes(profileId)) throw new ValidationError('unknown_profile_id', 'Unsupported Phase 5 profile', '$.profileId');
  return TEMPLATE_BY_ID.get(profileId);
}
export function validatePhase5ProfileConfiguration(profileId, value) {
  const template = getPhase5ProfileTemplate(profileId);
  plain(value, '$.configuration'); exact(value, template.configurationFields, '$.configuration');
  if (profileId === 'hardhat-test-v1') return {
    testFiles: strings(value.testFiles, '$.configuration.testFiles'),
    grep: value.grep === null ? null : String(value.grep),
    bail: boolean(value.bail, '$.configuration.bail'),
    parallel: boolean(value.parallel, '$.configuration.parallel'),
    concurrency: integer(value.concurrency, '$.configuration.concurrency', 1, 64)
  };
  if (profileId === 'echidna-v1') return {
    testMode: TEST_MODES.has(value.testMode) ? value.testMode : (() => { throw new ValidationError('invalid_enum', 'invalid testMode', '$.configuration.testMode'); })(),
    testLimit: integer(value.testLimit, '$.configuration.testLimit', 1, 10_000_000),
    sequenceLength: integer(value.sequenceLength, '$.configuration.sequenceLength', 1, 10_000),
    shrinkLimit: integer(value.shrinkLimit, '$.configuration.shrinkLimit', 0, 100_000),
    seed: integer(value.seed, '$.configuration.seed', 0, MAX_UINT32),
    workers: integer(value.workers, '$.configuration.workers', 1, 64)
  };
  if (profileId === 'mutation-v1') return {
    sourceFiles: strings(value.sourceFiles, '$.configuration.sourceFiles'),
    mutationOperators: strings(value.mutationOperators, '$.configuration.mutationOperators', MUTATION_OPERATORS),
    maxMutants: integer(value.maxMutants, '$.configuration.maxMutants', 1, 100_000),
    seed: integer(value.seed, '$.configuration.seed', 0, MAX_UINT32),
    validateMutants: boolean(value.validateMutants, '$.configuration.validateMutants')
  };
  return {
    lockfiles: strings(value.lockfiles, '$.configuration.lockfiles', LOCKFILE_NAMES),
    includeDevDependencies: boolean(value.includeDevDependencies, '$.configuration.includeDevDependencies'),
    minimumSeverity: SEVERITIES.has(value.minimumSeverity) ? value.minimumSeverity : (() => { throw new ValidationError('invalid_enum', 'invalid severity', '$.configuration.minimumSeverity'); })(),
    failOnFindings: boolean(value.failOnFindings, '$.configuration.failOnFindings')
  };
}
