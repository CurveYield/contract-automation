import {
  PHASE5_PROFILE_IDS, PHASE5_PROFILE_TEMPLATES, getPhase5ProfileTemplate,
  validatePublishedPhase5ProfileContract
} from '../../audit-phase5-profile-contracts/src/index.mjs';
import { PHASE5_PARSER_VERSIONS } from '../../audit-phase5-parsers/src/index.mjs';
import {
  PHASE5_RESULT_SCHEMA_VERSION, PHASE5_EVIDENCE_SCHEMA_VERSION, INVALID_PROFILE_ID,
  UNKNOWN_PARSER_VERSION, PHASE5_RESULT_CONTRACTS, PHASE5_RESULT_PROFILE_IDS,
  PROFILE_RECORD_KEYS, RESULT_TOP_LEVEL_KEYS, RESULT_CLASSIFICATIONS,
  TERMINAL_CLASSIFICATIONS, FAILURE_CLASSIFICATIONS, MAX_RECORDS, MAX_DURATION_MS
} from './contracts.mjs';

export {
  PHASE5_RESULT_SCHEMA_VERSION, PHASE5_EVIDENCE_SCHEMA_VERSION,
  PHASE5_RESULT_CONTRACTS, PHASE5_RESULT_PROFILE_IDS
} from './contracts.mjs';

function fail(code, path, message = code) { const error = new Error(message); error.name = 'Phase5ResultValidationError'; error.code = code; error.path = path; throw error; }
function sanitize(value, path = '$', seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0))) fail('invalid_number', path);
    if (typeof value === 'string' && (value.length > 2_000 || value.includes('\u0000'))) fail('invalid_string', path);
    return value;
  }
  if (seen.has(value)) fail('cyclic_value', path); seen.add(value);
  const proto = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    if (proto !== Array.prototype || value.length > MAX_RECORDS) fail('invalid_array', path);
    const result = value.map((item, index) => sanitize(item, `${path}[${index}]`, seen)); seen.delete(value); return result;
  }
  if (proto !== Object.prototype && proto !== null) fail('invalid_plain_object', path);
  const descriptors = Object.getOwnPropertyDescriptors(value); const result = {};
  for (const key of Reflect.ownKeys(value).sort()) {
    if (typeof key === 'symbol') fail('unsupported_property', path);
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) fail('accessor_property', `${path}.${key}`);
    result[key] = sanitize(descriptor.value, `${path}.${key}`, seen);
  }
  seen.delete(value); return result;
}
function exact(value, keys, path) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail('unknown_field', `${path}.${key}`);
  for (const key of keys) if (!Object.hasOwn(value, key)) fail('missing_field', `${path}.${key}`);
}
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function emptyPayload(result) {
  for (const key of [...PROFILE_RECORD_KEYS,'evidence','artifacts']) if (result[key].length !== 0) fail('lifecycle_mismatch', `$.${key}`);
  if (Object.keys(result.summary).length !== 0) fail('lifecycle_mismatch', '$.summary');
}
function expectedSummary(profileId, records, summary) {
  if (profileId === 'hardhat-test-v1') return { passed: records.filter(x=>x.status==='passed').length, failed: records.filter(x=>x.status==='failed').length, skipped: records.filter(x=>x.status==='skipped').length, total: records.length };
  if (profileId === 'echidna-v1') return { passed: records.filter(x=>x.status==='passed').length, failed: records.filter(x=>x.status==='failed').length, total: records.length, seed: summary.seed };
  if (profileId === 'mutation-v1') { const killed=records.filter(x=>x.status==='killed').length; const survived=records.filter(x=>x.status==='survived').length; const timedOut=records.filter(x=>x.status==='timed_out').length; const invalid=records.filter(x=>x.status==='invalid').length; const d=killed+survived; return { killed,survived,timedOut,invalid,total:records.length,mutationScore:d===0?0:Math.round(killed/d*10000)/100 }; }
  return { critical: records.filter(x=>x.severity==='critical').length, high: records.filter(x=>x.severity==='high').length, moderate: records.filter(x=>x.severity==='moderate').length, low: records.filter(x=>x.severity==='low').length, unknown: records.filter(x=>!['critical','high','moderate','low'].includes(x.severity)).length, total: records.length };
}
export function validatePhase5ToolResult(value) {
  const result = sanitize(value); exact(result, RESULT_TOP_LEVEL_KEYS, '$');
  if (result.schemaVersion !== PHASE5_RESULT_SCHEMA_VERSION) fail('invalid_schema_version', '$.schemaVersion');
  if (!RESULT_CLASSIFICATIONS.includes(result.classification)) fail('invalid_classification', '$.classification');
  if (!Number.isSafeInteger(result.durationMs) || result.durationMs < 0 || result.durationMs > MAX_DURATION_MS) fail('invalid_duration', '$.durationMs');
  if (result.exitCode !== null && (!Number.isSafeInteger(result.exitCode) || result.exitCode < 0 || result.exitCode > 255)) fail('invalid_exit_code', '$.exitCode');
  for (const key of [...PROFILE_RECORD_KEYS,'evidence','artifacts','parserErrors']) if (!Array.isArray(result[key]) || result[key].length > MAX_RECORDS) fail('invalid_array', `$.${key}`);
  if (result.profileId === INVALID_PROFILE_ID) {
    if (result.parserVersion !== UNKNOWN_PARSER_VERSION || result.classification !== 'parser_error') fail('parser_profile_mismatch', '$.parserVersion');
  } else {
    const contract = PHASE5_RESULT_CONTRACTS[result.profileId]; if (!contract) fail('invalid_profile_id', '$.profileId');
    if (result.parserVersion !== contract.parserVersion || result.parserVersion !== PHASE5_PARSER_VERSIONS[result.profileId]) fail('parser_profile_mismatch', '$.parserVersion');
  }
  if (TERMINAL_CLASSIFICATIONS.has(result.classification)) {
    if (result.exitCode !== null || result.parserErrors.length !== 0) fail('lifecycle_mismatch', '$.exitCode'); emptyPayload(result); return freeze(result);
  }
  if (FAILURE_CLASSIFICATIONS.has(result.classification)) {
    if (result.exitCode !== null || result.parserErrors.length !== 1) fail('classification_mismatch', '$.parserErrors'); emptyPayload({ ...result, parserErrors: result.parserErrors }); return freeze(result);
  }
  if (result.exitCode === null || result.parserErrors.length !== 0 || result.artifacts.length !== 0) fail('lifecycle_mismatch', '$.exitCode');
  const contract = PHASE5_RESULT_CONTRACTS[result.profileId];
  for (const key of PROFILE_RECORD_KEYS) if (key !== contract.recordKey && result[key].length !== 0) fail('profile_substitution', `$.${key}`);
  const records = result[contract.recordKey];
  const expected = expectedSummary(result.profileId, records, result.summary);
  if (JSON.stringify(result.summary) !== JSON.stringify(expected)) fail('summary_mismatch', '$.summary');
  if (result.evidence.length !== 1 || result.evidence[0].schemaVersion !== PHASE5_EVIDENCE_SCHEMA_VERSION || result.evidence[0].type !== contract.evidenceType || result.evidence[0].recordCount !== records.length) fail('evidence_mismatch', '$.evidence');
  const findings = result.profileId === 'hardhat-test-v1' ? expected.failed > 0 : result.profileId === 'echidna-v1' ? expected.failed > 0 : result.profileId === 'mutation-v1' ? expected.survived + expected.timedOut + expected.invalid > 0 : expected.total > 0;
  if (result.classification !== (result.exitCode !== 0 || findings ? 'findings' : 'success')) fail('classification_mismatch', '$.classification');
  return freeze(result);
}
export function validatePhase5ResultForProfile(profileContract, result) {
  const profileId = profileContract?.profileId;
  if (!PHASE5_PROFILE_IDS.includes(profileId)) fail('invalid_profile_id', '$.profileContract.profileId');
  const accepted = profileContract.schemaVersion === 'phase5-tool-profile-contract-v1' ? validatePublishedPhase5ProfileContract(profileContract) : getPhase5ProfileTemplate(profileId);
  if (profileContract.schemaVersion === 'phase5-tool-profile-template-v1' && JSON.stringify(profileContract) !== JSON.stringify(accepted)) fail('immutable_profile_mismatch', '$.profileContract');
  if (accepted.executionEnabled !== false || accepted.executorState !== 'unavailable') fail('execution_boundary_violation', '$.profileContract');
  const checked = validatePhase5ToolResult(result);
  if (checked.profileId !== profileId) fail('profile_substitution', '$.profileId');
  if (checked.parserVersion !== accepted.parserVersion) fail('parser_substitution', '$.parserVersion');
  return checked;
}
