import { validateFormalResult } from '../../audit-phase6-profile-contracts/src/index.mjs';
import { PHASE6_PROFILE_RESULT_IDENTITIES, PHASE6_RESULT_CONTRACT_VERSION, PHASE6_RESULT_ENVELOPE_SCHEMA_VERSION } from './identities.mjs';
import { canonicalJson, deepFreeze, exactKeys, fail, remapError, sanitizePhase6ExternalValue } from './primitives.mjs';

const topKeys = ['schemaVersion','profileId','parserId','parserPackage','parserPackageVersion','captureSchemaVersion','resultSchemaVersion','toolVersion','trustedProducer','outcome','result','summary'];
const summaryKeys = ['obligations','assertions','models','traces','counterexamples','diagnostics','sourceReferences','parserWarnings','truncated'];
function summaryFor(result) { return { obligations: result.obligations.length, assertions: result.assertions.length, models: result.models.length, traces: result.traces.length, counterexamples: result.counterexamples.length, diagnostics: result.diagnostics.length, sourceReferences: result.sourceReferences.length, parserWarnings: result.parserWarnings.length, truncated: result.truncated }; }
function assertIdentity(value, identity) { for (const field of ['parserId','parserPackage','parserPackageVersion','captureSchemaVersion','resultSchemaVersion','toolVersion','trustedProducer']) if (value[field] !== identity[field]) fail('identity_mismatch', `$.${field}`); }
function assertSummary(value, result) { exactKeys(value, summaryKeys, '$.summary'); const expected = summaryFor(result); for (const key of summaryKeys) { if (typeof expected[key] === 'number' && (!Number.isSafeInteger(value[key]) || value[key] < 0)) fail('invalid_number', `$.summary.${key}`); if (value[key] !== expected[key]) fail('summary_mismatch', `$.summary.${key}`); } }
function assertTerminalEmpty(result) { for (const key of ['obligations','assertions','models','traces','counterexamples','sourceReferences']) if (result[key].length) fail('terminal_evidence_present', `$.result.${key}`); }
function assertOutcome(result) {
  const errors = result.diagnostics.filter((item) => item.severity === 'error').length;
  const truncationWarnings = result.parserWarnings.filter((item) => item.code === 'collection_truncated').length;
  if (truncationWarnings && result.truncated !== true) fail('truncation_mismatch', '$.result.truncated');
  if (result.outcome === 'proved') {
    if (result.counterexamples.length) fail('outcome_evidence_mismatch', '$.result.counterexamples');
    if (errors) fail('outcome_evidence_mismatch', '$.result.diagnostics');
  } else if (result.outcome === 'disproved') {
    if (result.counterexamples.length === 0) fail('outcome_evidence_mismatch', '$.result.counterexamples');
  } else if (result.outcome === 'parser_error') {
    assertTerminalEmpty(result);
    if (result.diagnostics.length !== 1 || errors !== 1) fail('outcome_evidence_mismatch', '$.result.diagnostics');
    if (result.parserWarnings.length < 1 || result.truncated !== false) fail('outcome_evidence_mismatch', '$.result.parserWarnings');
  } else if (['timeout','cancelled','resource_exhausted'].includes(result.outcome)) {
    assertTerminalEmpty(result);
    if (result.counterexamples.length || errors) fail('outcome_evidence_mismatch', '$.result.diagnostics');
  } else if (result.outcome === 'unknown' && result.counterexamples.length) {
    fail('outcome_evidence_mismatch', '$.result.counterexamples');
  }
}
export function validatePhase6ToolResult(value) {
  const safe = sanitizePhase6ExternalValue(value);
  exactKeys(safe, topKeys);
  if (safe.schemaVersion !== PHASE6_RESULT_ENVELOPE_SCHEMA_VERSION) fail('invalid_schema_version', '$.schemaVersion');
  const identity = PHASE6_PROFILE_RESULT_IDENTITIES[safe.profileId];
  if (!identity) fail('invalid_profile_id', '$.profileId');
  if (safe.result?.profileId !== safe.profileId) fail('identity_mismatch', '$.profileId');
  assertIdentity(safe, identity);
  let normalized;
  try { normalized = validateFormalResult(safe.result); } catch (error) { remapError(error, '$.result'); }
  if (canonicalJson(normalized) !== canonicalJson(safe.result)) fail('noncanonical_result', '$.result');
  if (normalized.schemaVersion !== identity.resultSchemaVersion) fail('identity_mismatch', '$.result.schemaVersion');
  if (normalized.profileId !== safe.profileId) fail('identity_mismatch', '$.result.profileId');
  if (safe.outcome !== normalized.outcome) fail('outcome_mismatch', '$.outcome');
  assertOutcome(normalized);
  assertSummary(safe.summary, normalized);
  return deepFreeze({ ...safe, result: normalized, summary: summaryFor(normalized) });
}
export function createPhase6ToolResultEnvelope(profileId, result) {
  const identity = PHASE6_PROFILE_RESULT_IDENTITIES[profileId];
  if (!identity) fail('invalid_profile_id', '$.profileId');
  const safeResult = sanitizePhase6ExternalValue(result, '$.result');
  const envelope = { schemaVersion: PHASE6_RESULT_ENVELOPE_SCHEMA_VERSION, profileId, ...identity, outcome: safeResult.outcome, result: safeResult, summary: summaryFor(safeResult) };
  return validatePhase6ToolResult(envelope);
}
export { PHASE6_RESULT_CONTRACT_VERSION, PHASE6_RESULT_ENVELOPE_SCHEMA_VERSION };
