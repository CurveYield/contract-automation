import { ValidationError } from '../../audit-protocol/src/index.mjs';
import { validateInvocationPlan } from '../../audit-executor-adapters/src/index.mjs';
import { PHASE4_PROFILE_IDS, PHASE4_PROFILE_TEMPLATES } from '../../audit-tool-profile-contracts/src/index.mjs';
import { PARSER_VERSIONS, TOOL_RESULT_SCHEMA_VERSION } from '../../audit-tool-parsers/src/index.mjs';
import { PHASE4_TOOL_RESULT_CONTRACT_VERSION, validatePhase4ToolResult } from './result-contract-v1.mjs';

export const PHASE4_COMPATIBILITY_CONTRACT_VERSION = 'phase4-package-compatibility-v1';

export const PHASE4_FIXTURE_INVENTORY = Object.freeze([
  'cancellation-v1.json',
  'compiler-findings-v1.json',
  'compiler-malformed-v1.json',
  'compiler-success-v1.json',
  'coverage-success-v1.json',
  'foundry-fuzz-counterexample-v1.json',
  'foundry-invariant-failure-v1.json',
  'foundry-test-failure-v1.json',
  'foundry-test-success-v1.json',
  'resource-exhaustion-v1.json',
  'slither-findings-v1.json',
  'timeout-v1.json',
  'trace-truncation-v1.json',
  'unsafe-path-v1.json'
]);

function fail(code, path, message = code) { throw new ValidationError(code, message, path); }
function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function plainObject(value, path) { if (!isPlainObject(value)) fail('invalid_plain_object', path); }
function ordinaryArray(value, path) { if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail('invalid_array', path); }
function cloneValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(cloneValue);
  const result = {};
  for (const [key, child] of Object.entries(value)) Object.defineProperty(result, key, { value: cloneValue(child), enumerable: true, writable: true, configurable: true });
  return result;
}
function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); } return value; }
function sortedUnique(values, path) {
  ordinaryArray(values, path);
  const result = [...values];
  for (const [index, value] of result.entries()) if (typeof value !== 'string') fail('invalid_string', `${path}[${index}]`);
  result.sort();
  if (new Set(result).size !== result.length) fail('duplicate_profile_id', path);
  return result;
}
function sameStrings(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }

const RESULT_EXECUTION_STATE_KEYS = new Set([
  'executionenabled', 'executionstate', 'executorstate', 'runnable', 'publicationstate'
]);
function scanResultExecutionStateFields(value, path = '$.result') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanResultExecutionStateFields(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    if (RESULT_EXECUTION_STATE_KEYS.has(normalized)) fail('execution_state_field', `${path}.${key}`);
    scanResultExecutionStateFields(child, `${path}.${key}`);
  }
}

function validateTemplateState(template, path, parserVersions) {
  plainObject(template, path);
  if (typeof template.profileId !== 'string') fail('invalid_profile_id', `${path}.profileId`);
  if (template.parserVersion !== parserVersions[template.profileId]) fail('profile_parser_mismatch', `${path}.parserVersion`);
  if (
    template.publicationState !== 'unpublished' || template.runnable !== false || template.executionEnabled !== false ||
    template.executorState !== 'unavailable' || template.digestRequired !== true
  ) fail('unsafe_template_state', path);
  if (!Number.isSafeInteger(template.profileVersion) || template.profileVersion < 1) fail('invalid_profile_version', `${path}.profileVersion`);
  if (typeof template.artifactManifestVersion !== 'string' || typeof template.evidenceSchemaVersion !== 'string') fail('invalid_template_contract', path);
}
function validatePlanCompatibility(plan, templatesById, path) {
  let checked;
  try { checked = validateInvocationPlan(plan); }
  catch { fail('invalid_invocation_plan', path); }
  const template = templatesById.get(checked.profileIdentity.profileId);
  if (!template) fail('unknown_profile_id', `${path}.profileIdentity.profileId`);
  if (checked.profileIdentity.profileVersion !== template.profileVersion) fail('invalid_profile_version', `${path}.profileIdentity.profileVersion`);
  if (checked.parserVersion !== template.parserVersion) fail('profile_parser_mismatch', `${path}.parserVersion`);
  if (checked.immutableDigestIdentity.registryRepository !== template.registryRepository || !/^sha256:[0-9a-f]{64}$/.test(checked.immutableDigestIdentity.digest)) fail('invalid_digest_identity', `${path}.immutableDigestIdentity`);
  if (checked.artifactContract.schemaVersion !== template.artifactManifestVersion) fail('artifact_contract_mismatch', `${path}.artifactContract.schemaVersion`);
  if (checked.evidenceContract.schemaVersion !== template.evidenceSchemaVersion) fail('evidence_contract_mismatch', `${path}.evidenceContract.schemaVersion`);
  if (checked.executionEnabled !== false || checked.executorState !== 'unavailable') fail('unsafe_plan_state', path);
  return checked;
}

export function assertPhase4FixtureInventory(fileNames) {
  ordinaryArray(fileNames, '$.fixtureNames');
  const normalized = [...fileNames];
  for (const [index, name] of normalized.entries()) {
    if (typeof name !== 'string' || !/^[a-z0-9-]+-v1\.json$/.test(name)) fail('invalid_fixture_name', `$.fixtureNames[${index}]`);
  }
  normalized.sort();
  const expected = [...PHASE4_FIXTURE_INVENTORY];
  if (!sameStrings(normalized, expected)) fail('fixture_inventory_mismatch', '$.fixtureNames');
  return deepFreeze({
    contractVersion: PHASE4_COMPATIBILITY_CONTRACT_VERSION,
    fixtureNames: expected
  });
}

export function assertPhase4PackageCompatibility(overrides = {}) {
  plainObject(overrides, '$.overrides');
  for (const key of Object.keys(overrides)) if (!['profileIds', 'templates', 'parserVersions', 'invocationPlans'].includes(key)) fail('unknown_field', `$.overrides.${key}`);
  const profileIds = overrides.profileIds ?? PHASE4_PROFILE_IDS;
  const templates = overrides.templates ?? PHASE4_PROFILE_TEMPLATES;
  const parserVersions = overrides.parserVersions ?? PARSER_VERSIONS;
  const invocationPlans = overrides.invocationPlans ?? [];
  ordinaryArray(templates, '$.templates'); ordinaryArray(invocationPlans, '$.invocationPlans'); plainObject(parserVersions, '$.parserVersions');

  const expectedIds = sortedUnique(PHASE4_PROFILE_IDS, '$.acceptedProfileIds');
  const suppliedIds = sortedUnique(profileIds, '$.profileIds');
  const parserIds = Object.keys(parserVersions).sort();
  const templateIds = templates.map((template, index) => { plainObject(template, `$.templates[${index}]`); return template.profileId; }).sort();
  if (!sameStrings(suppliedIds, expectedIds) || !sameStrings(parserIds, expectedIds) || !sameStrings(templateIds, expectedIds)) fail('profile_set_mismatch', '$');

  const templatesById = new Map();
  templates.forEach((template, index) => { validateTemplateState(template, `$.templates[${index}]`, parserVersions); templatesById.set(template.profileId, template); });
  const checkedPlans = invocationPlans.map((plan, index) => validatePlanCompatibility(plan, templatesById, `$.invocationPlans[${index}]`));
  return deepFreeze({
    contractVersion: PHASE4_COMPATIBILITY_CONTRACT_VERSION,
    resultContractVersion: PHASE4_TOOL_RESULT_CONTRACT_VERSION,
    compatible: true,
    profileIds: [...PHASE4_PROFILE_IDS],
    checkedTemplates: templates.length,
    checkedInvocationPlans: checkedPlans.length
  });
}

export function validatePhase4ResultForPlan(plan, result) {
  let checkedPlan;
  try { checkedPlan = validateInvocationPlan(plan); }
  catch { fail('invalid_invocation_plan', '$.plan'); }
  const checkedResult = validatePhase4ToolResult(result);
  scanResultExecutionStateFields(checkedResult);
  if (checkedResult.schemaVersion !== TOOL_RESULT_SCHEMA_VERSION) fail('invalid_schema_version', '$.result.schemaVersion');
  if (checkedPlan.profileIdentity.profileId !== checkedResult.profileId) fail('plan_result_profile_mismatch', '$.result.profileId');
  if (checkedPlan.parserVersion !== checkedResult.parserVersion) fail('plan_result_parser_mismatch', '$.result.parserVersion');
  return deepFreeze({
    contractVersion: PHASE4_COMPATIBILITY_CONTRACT_VERSION,
    plan: cloneValue(checkedPlan),
    result: cloneValue(checkedResult)
  });
}
