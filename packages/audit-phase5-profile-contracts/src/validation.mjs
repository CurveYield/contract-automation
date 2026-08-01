import { ValidationError } from '../../audit-protocol/src/index.mjs';
import {
  MAX_UINT32,
  TEST_MODES,
  MUTATION_OPERATORS,
  SEVERITIES,
  LOCKFILE_NAMES
} from './templates.mjs';
import {
  knownProfile,
  plainObject,
  scanPhase5ForbiddenFields,
  exactKeys,
  uniqueArray,
  safeRelativePath,
  boundedString,
  boolean,
  integer,
  enumeration
} from './helpers.mjs';

export function getPhase5ProfileTemplate(profileId) {
  return knownProfile(profileId);
}

export function validatePhase5ProfileConfiguration(profileId, configuration) {
  const profile = knownProfile(profileId);
  plainObject(configuration, '$.configuration');
  scanPhase5ForbiddenFields(configuration, '$.configuration');
  exactKeys(configuration, new Set(profile.configurationFields), '$.configuration');

  let result;
  switch (profileId) {
    case 'hardhat-test-v1':
      result = {
        testFiles: uniqueArray(configuration.testFiles, '$.configuration.testFiles', (item, path) => safeRelativePath(item, path, ['.js', '.cjs', '.mjs', '.ts', '.mts', '.cts']), 32),
        grep: boundedString(configuration.grep, '$.configuration.grep', 160),
        bail: boolean(configuration.bail, '$.configuration.bail'),
        parallel: boolean(configuration.parallel, '$.configuration.parallel'),
        concurrency: integer(configuration.concurrency, '$.configuration.concurrency', 1, 8)
      };
      if (!result.parallel && result.concurrency !== 1) {
        throw new ValidationError('invalid_concurrency', '$.configuration.concurrency must equal 1 when parallel is false', '$.configuration.concurrency');
      }
      break;
    case 'echidna-v1':
      result = {
        testMode: enumeration(configuration.testMode, '$.configuration.testMode', TEST_MODES),
        testLimit: integer(configuration.testLimit, '$.configuration.testLimit', 1, 1_000_000),
        sequenceLength: integer(configuration.sequenceLength, '$.configuration.sequenceLength', 1, 1_000),
        shrinkLimit: integer(configuration.shrinkLimit, '$.configuration.shrinkLimit', 0, 100_000),
        seed: integer(configuration.seed, '$.configuration.seed', 0, MAX_UINT32),
        workers: integer(configuration.workers, '$.configuration.workers', 1, 8)
      };
      break;
    case 'mutation-v1':
      result = {
        sourceFiles: uniqueArray(configuration.sourceFiles, '$.configuration.sourceFiles', (item, path) => safeRelativePath(item, path, ['.sol']), 64),
        mutationOperators: uniqueArray(configuration.mutationOperators, '$.configuration.mutationOperators', (item, path) => enumeration(item, path, MUTATION_OPERATORS), MUTATION_OPERATORS.size),
        maxMutants: integer(configuration.maxMutants, '$.configuration.maxMutants', 1, 10_000),
        seed: integer(configuration.seed, '$.configuration.seed', 0, MAX_UINT32),
        validateMutants: boolean(configuration.validateMutants, '$.configuration.validateMutants')
      };
      break;
    case 'dependency-scan-v1':
      result = {
        lockfiles: uniqueArray(configuration.lockfiles, '$.configuration.lockfiles', (item, path) => {
          const checked = safeRelativePath(item, path, [...LOCKFILE_NAMES]);
          const name = checked.split('/').at(-1);
          if (!LOCKFILE_NAMES.has(name)) throw new ValidationError('invalid_lockfile', `${path} is not an allowlisted lockfile`, path);
          return checked;
        }, 64),
        includeDevDependencies: boolean(configuration.includeDevDependencies, '$.configuration.includeDevDependencies'),
        minimumSeverity: enumeration(configuration.minimumSeverity, '$.configuration.minimumSeverity', SEVERITIES),
        failOnFindings: boolean(configuration.failOnFindings, '$.configuration.failOnFindings')
      };
      break;
    default:
      throw new ValidationError('unknown_profile_id', `Unsupported Phase 5 profileId: ${profileId}`, '$.profileId');
  }
  return structuredClone(result);
}

