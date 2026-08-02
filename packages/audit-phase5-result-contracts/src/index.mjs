import {
  PHASE5_PROFILE_IDS, PHASE5_PROFILE_TEMPLATES, getPhase5ProfileTemplate,
  validatePublishedPhase5ProfileContract
} from '../../audit-phase5-profile-contracts/src/index.mjs';
import { PHASE5_PARSER_VERSIONS } from '../../audit-phase5-parsers/src/index.mjs';
import { fail } from './errors.mjs';
import {
  PHASE5_RESULT_SCHEMA_VERSION, PHASE5_EVIDENCE_SCHEMA_VERSION, INVALID_PROFILE_ID,
  UNKNOWN_PARSER_VERSION, PHASE5_RESULT_CONTRACTS, PHASE5_RESULT_PROFILE_IDS,
  PROFILE_RECORD_KEYS, RESULT_TOP_LEVEL_KEYS, RESULT_CLASSIFICATIONS,
  TERMINAL_CLASSIFICATIONS, FAILURE_CLASSIFICATIONS, MAX_RECORDS, MAX_DURATION_MS
} from './contracts.mjs';
import {
  plainObject, ordinaryArray, exactKeys, ownValue, boundedString, integer,
  finiteNumber, emptyObject, deepFrozenClone, assertOrdinaryTree
} from './boundary.mjs';
import {
  validateHardhatRecords, validateEchidnaRecords, validateMutationRecords,
  validateDependencyRecords, validateMutationScore
} from './records.mjs';

export {
  PHASE5_RESULT_SCHEMA_VERSION, PHASE5_EVIDENCE_SCHEMA_VERSION,
  PHASE5_RESULT_CONTRACTS, PHASE5_RESULT_PROFILE_IDS
} from './contracts.mjs';

const CLASSIFICATION_SET = new Set(RESULT_CLASSIFICATIONS);
const PROFILE_ID_SET = new Set(PHASE5_RESULT_PROFILE_IDS);

function arrayValue(result, key) {
  const value = ownValue(result, key, `$.${key}`);
  ordinaryArray(value, `$.${key}`, MAX_RECORDS);
  return value;
}

function requireEmptyArray(value, path, code = 'lifecycle_mismatch') {
  ordinaryArray(value, path, MAX_RECORDS);
  if (value.length !== 0) fail(code, path, `${path} must be empty`);
}

function validateParserErrors(value) {
  ordinaryArray(value, '$.parserErrors', MAX_RECORDS);
  value.forEach((item, index) => {
    const path = `$.parserErrors[${index}]`;
    plainObject(item, path);
    exactKeys(item, ['code', 'message'], path);
    boundedString(ownValue(item, 'code', `${path}.code`), `${path}.code`, 80, false);
    boundedString(ownValue(item, 'message', `${path}.message`), `${path}.message`);
  });
  return value;
}

function validateResultIdentity(result) {
  const schemaVersion = ownValue(result, 'schemaVersion', '$.schemaVersion');
  if (schemaVersion !== PHASE5_RESULT_SCHEMA_VERSION) fail('invalid_schema_version', '$.schemaVersion', '$.schemaVersion is invalid');
  const profileId = boundedString(ownValue(result, 'profileId', '$.profileId'), '$.profileId', 80, false);
  const parserVersion = boundedString(ownValue(result, 'parserVersion', '$.parserVersion'), '$.parserVersion', 80, false);
  const classification = boundedString(ownValue(result, 'classification', '$.classification'), '$.classification', 32, false);
  if (!CLASSIFICATION_SET.has(classification)) fail('invalid_classification', '$.classification', '$.classification is invalid');
  if (profileId === INVALID_PROFILE_ID) {
    if (parserVersion !== UNKNOWN_PARSER_VERSION) fail('parser_profile_mismatch', '$.parserVersion', '$.parserVersion is invalid for the sentinel');
    if (classification !== 'parser_error') fail('classification_mismatch', '$.classification', 'sentinel results must be parser_error');
  } else {
    if (!PROFILE_ID_SET.has(profileId)) fail('invalid_profile_id', '$.profileId', '$.profileId is invalid');
    if (parserVersion !== PHASE5_RESULT_CONTRACTS[profileId].parserVersion || parserVersion !== PHASE5_PARSER_VERSIONS[profileId]) {
      fail('parser_profile_mismatch', '$.parserVersion', '$.parserVersion does not match the profile');
    }
  }
  return { profileId, parserVersion, classification };
}

function validateCommonScalars(result) {
  integer(ownValue(result, 'durationMs', '$.durationMs'), '$.durationMs', 0, MAX_DURATION_MS);
  const exitCode = ownValue(result, 'exitCode', '$.exitCode');
  if (exitCode !== null) integer(exitCode, '$.exitCode', 0, 255);
  return exitCode;
}

function validateEmptyPayload(result, includeErrors) {
  for (const key of PROFILE_RECORD_KEYS) requireEmptyArray(arrayValue(result, key), `$.${key}`);
  requireEmptyArray(arrayValue(result, 'evidence'), '$.evidence');
  requireEmptyArray(arrayValue(result, 'artifacts'), '$.artifacts');
  const errors = validateParserErrors(ownValue(result, 'parserErrors', '$.parserErrors'));
  if (!includeErrors && errors.length !== 0) fail('lifecycle_mismatch', '$.parserErrors', '$.parserErrors must be empty');
  emptyObject(ownValue(result, 'summary', '$.summary'), '$.summary');
  return errors;
}

function validateTerminal(result, classification, exitCode) {
  if (exitCode !== null) fail('lifecycle_mismatch', '$.exitCode', `lifecycle mismatch: ${classification} requires null exitCode`);
  validateEmptyPayload(result, false);
}

function validateFailure(result, classification) {
  const errors = validateEmptyPayload(result, true);
  if (errors.length !== 1) fail('classification_mismatch', '$.parserErrors', `${classification} requires one parser error`);
}

function validateEvidence(result, contract, recordCount) {
  const evidence = arrayValue(result, 'evidence');
  if (evidence.length !== 1) fail('evidence_mismatch', '$.evidence', '$.evidence must contain one summary');
  const item = evidence[0];
  plainObject(item, '$.evidence[0]');
  exactKeys(item, ['schemaVersion', 'type', 'recordCount'], '$.evidence[0]');
  if (ownValue(item, 'schemaVersion', '$.evidence[0].schemaVersion') !== PHASE5_EVIDENCE_SCHEMA_VERSION) {
    fail('evidence_mismatch', '$.evidence[0].schemaVersion', 'evidence schema does not match');
  }
  if (ownValue(item, 'type', '$.evidence[0].type') !== contract.evidenceType) {
    fail('evidence_mismatch', '$.evidence[0].type', 'evidence type does not match');
  }
  const count = ownValue(item, 'recordCount', '$.evidence[0].recordCount');
  integer(count, '$.evidence[0].recordCount', 0, MAX_RECORDS);
  if (count !== recordCount) fail('evidence_mismatch', '$.evidence[0].recordCount', 'evidence count does not match');
}

function exactSummary(result, keys) {
  const summary = ownValue(result, 'summary', '$.summary');
  plainObject(summary, '$.summary');
  exactKeys(summary, keys, '$.summary');
  return summary;
}

function checkIntegerSummary(summary, expected, keys) {
  for (const key of keys) {
    const value = ownValue(summary, key, `$.summary.${key}`);
    integer(value, `$.summary.${key}`, 0, MAX_RECORDS);
    if (value !== expected[key]) fail('summary_mismatch', `$.summary.${key}`, `${key} does not match records`);
  }
}

function validateProfilePayload(result, profileId, exitCode, classification) {
  const contract = PHASE5_RESULT_CONTRACTS[profileId];
  for (const key of PROFILE_RECORD_KEYS) {
    const records = arrayValue(result, key);
    if (key !== contract.recordKey && records.length !== 0) fail('profile_substitution', `$.${key}`, `${key} is not valid for ${profileId}`);
  }
  const records = arrayValue(result, contract.recordKey);
  let expected;
  if (profileId === 'hardhat-test-v1') {
    expected = validateHardhatRecords(records);
    const summary = exactSummary(result, contract.summaryKeys);
    checkIntegerSummary(summary, expected, contract.summaryKeys);
  } else if (profileId === 'echidna-v1') {
    expected = validateEchidnaRecords(records);
    const summary = exactSummary(result, contract.summaryKeys);
    checkIntegerSummary(summary, expected, ['passed', 'failed', 'total']);
    integer(ownValue(summary, 'seed', '$.summary.seed'), '$.summary.seed', 0, 4_294_967_295);
  } else if (profileId === 'mutation-v1') {
    expected = validateMutationRecords(records);
    const summary = exactSummary(result, contract.summaryKeys);
    checkIntegerSummary(summary, expected, ['killed', 'survived', 'timedOut', 'invalid', 'total']);
    const score = ownValue(summary, 'mutationScore', '$.summary.mutationScore');
    validateMutationScore(score, '$.summary.mutationScore');
    if (score !== expected.mutationScore) fail('summary_mismatch', '$.summary.mutationScore', 'mutationScore does not match records');
  } else {
    expected = validateDependencyRecords(records);
    const summary = exactSummary(result, contract.summaryKeys);
    checkIntegerSummary(summary, expected, contract.summaryKeys);
  }
  validateEvidence(result, contract, records.length);
  const expectedFindings = profileId === 'hardhat-test-v1'
    ? exitCode !== 0 || expected.failed > 0
    : profileId === 'echidna-v1'
      ? exitCode !== 0 || expected.failed > 0
      : profileId === 'mutation-v1'
        ? exitCode !== 0 || expected.survived > 0 || expected.timedOut > 0 || expected.invalid > 0
        : exitCode !== 0 || expected.total > 0;
  const wanted = expectedFindings ? 'findings' : 'success';
  if (classification !== wanted) fail('classification_mismatch', '$.classification', `classification must be ${wanted}`);
}

export function validatePhase5ToolResult(value) {
  const result = plainObject(value, '$');
  exactKeys(result, RESULT_TOP_LEVEL_KEYS, '$');
  const { profileId, classification } = validateResultIdentity(result);
  const exitCode = validateCommonScalars(result);
  for (const key of [...PROFILE_RECORD_KEYS, 'evidence', 'artifacts', 'parserErrors']) arrayValue(result, key);
  plainObject(ownValue(result, 'summary', '$.summary'), '$.summary');

  if (TERMINAL_CLASSIFICATIONS.has(classification)) {
    if (profileId === INVALID_PROFILE_ID) fail('invalid_profile_id', '$.profileId', 'terminal sentinel is invalid');
    validateTerminal(result, classification, exitCode);
    return deepFrozenClone(result);
  }
  if (FAILURE_CLASSIFICATIONS.has(classification)) {
    validateFailure(result, classification);
    return deepFrozenClone(result);
  }
  if (profileId === INVALID_PROFILE_ID) fail('classification_mismatch', '$.classification', 'sentinel result must be parser_error');
  if (exitCode === null) fail('lifecycle_mismatch', '$.exitCode', 'completed results require exitCode');
  const errors = validateParserErrors(ownValue(result, 'parserErrors', '$.parserErrors'));
  if (errors.length !== 0) fail('classification_mismatch', '$.parserErrors', 'completed results cannot contain parser errors');
  requireEmptyArray(arrayValue(result, 'artifacts'), '$.artifacts', 'artifact_mismatch');
  validateProfilePayload(result, profileId, exitCode, classification);
  return deepFrozenClone(result);
}

function sameJson(actual, expected, path, code) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(code, path, `${path} does not match the accepted profile`);
}

export function validatePhase5ResultForProfile(profileContract, result) {
  plainObject(profileContract, '$.profileContract');
  assertOrdinaryTree(profileContract, '$.profileContract');
  const profileId = ownValue(profileContract, 'profileId', '$.profileContract.profileId');
  boundedString(profileId, '$.profileContract.profileId', 80, false);
  if (!PROFILE_ID_SET.has(profileId)) fail('invalid_profile_id', '$.profileContract.profileId', 'profile is not Phase 5');
  const schemaVersion = ownValue(profileContract, 'schemaVersion', '$.profileContract.schemaVersion');
  let accepted;
  if (schemaVersion === 'phase5-tool-profile-contract-v1') {
    try { accepted = validatePublishedPhase5ProfileContract(profileContract); }
    catch (error) { fail(error?.code ?? 'invalid_profile_contract', `$.profileContract${error?.path?.slice(1) ?? ''}`, error?.message); }
  } else if (schemaVersion === 'phase5-tool-profile-template-v1') {
    const template = getPhase5ProfileTemplate(profileId);
    sameJson(profileContract, template, '$.profileContract', 'immutable_profile_mismatch');
    accepted = template;
  } else {
    fail('invalid_schema_version', '$.profileContract.schemaVersion', 'profile contract schema is invalid');
  }
  if (accepted.executionEnabled !== false) fail('execution_boundary_violation', '$.profileContract.executionEnabled', 'execution must remain disabled');
  if (accepted.executorState !== 'unavailable') fail('execution_boundary_violation', '$.profileContract.executorState', 'executor must remain unavailable');
  const normalized = validatePhase5ToolResult(result);
  if (normalized.profileId !== profileId) fail('profile_substitution', '$.profileId', 'result profile does not match plan');
  if (normalized.parserVersion !== accepted.parserVersion) fail('parser_substitution', '$.parserVersion', 'result parser does not match plan');
  return normalized;
}
