import {
  PHASE6_BOUNDS,
  Phase6ValidationError,
  sanitizeValidationPath,
  validateFormalResult
} from '../../audit-phase6-profile-contracts/src/index.mjs';

const CAPTURE_SCHEMAS = Object.freeze({
  'solidity-smt-v1': 'solidity-smt-capture-v1',
  'halmos-v1': 'halmos-capture-v1',
  'formal-obligations-v1': 'formal-obligations-capture-v1'
});
const TOOL_VERSIONS = Object.freeze({
  'solidity-smt-v1': '0.8.30',
  'halmos-v1': '0.3.3',
  'formal-obligations-v1': '1.0.0'
});
export const PHASE6_TRUSTED_PRODUCER = 'curveyield-formal-capture-producer-v1';
const RESULT_ARRAY_LIMITS = Object.freeze({
  obligations: PHASE6_BOUNDS.obligations,
  assertions: PHASE6_BOUNDS.assertions,
  models: PHASE6_BOUNDS.models,
  traces: PHASE6_BOUNDS.traces,
  counterexamples: PHASE6_BOUNDS.counterexamples,
  diagnostics: PHASE6_BOUNDS.diagnostics,
  sourceReferences: PHASE6_BOUNDS.sourceReferences,
  parserWarnings: PHASE6_BOUNDS.parserWarnings
});
const CAPTURE_KEYS = new Set([
  'schemaVersion', 'trustedProducer', 'profileId', 'toolVersion', 'outcome',
  'obligations', 'assertions', 'models', 'traces', 'counterexamples',
  'diagnostics', 'sourceReferences', 'parserWarnings', 'truncated'
]);
function emptyResult(profileId, outcome = 'parser_error') {
  return { schemaVersion: 'formal-result-v1', profileId, outcome, obligations: [], assertions: [], models: [], traces: [], counterexamples: [], diagnostics: [], sourceReferences: [], parserWarnings: [], truncated: false };
}
function parserError(profileId, code, path = '$') {
  const safeCode = typeof code === 'string' && /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(code) ? code : 'unexpected_parser_error';
  const safePath = sanitizeValidationPath(path);
  const result = emptyResult(profileId);
  result.diagnostics.push({ code: safeCode, severity: 'error', message: `Inert capture parsing failed with ${safeCode}`, sourceReferenceIds: [] });
  result.parserWarnings.push({ code: 'capture_rejected', message: 'Capture rejected at a bounded validation path', path: safePath });
  try { return validateFormalResult(result); }
  catch {
    return { ...emptyResult(profileId), diagnostics: [{ code: 'unexpected_parser_error', severity: 'error', message: 'Inert capture parsing failed with unexpected_parser_error', sourceReferenceIds: [] }], parserWarnings: [{ code: 'capture_rejected', message: 'Capture rejected at a bounded validation path', path: '$' }] };
  }
}
function assertBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('parser input must be an explicitly supplied Uint8Array of inert bytes');
}
function stableRaw(value) {
  if (Array.isArray(value)) return `[${value.map(stableRaw).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableRaw(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function rawIdentity(key, item) {
  if (key === 'diagnostics') return `${item?.code ?? ''}\u0000${item?.severity ?? ''}\u0000${stableRaw(item?.sourceReferenceIds ?? [])}`;
  if (key === 'parserWarnings') return `${item?.code ?? ''}\u0000${item?.path ?? ''}`;
  return String(item?.id ?? '');
}
function deduplicateRawByIdentity(source, identityOf, path) {
  const byIdentity = new Map();
  for (const item of source) {
    const identity = String(identityOf(item));
    const encoded = stableRaw(item);
    const previous = byIdentity.get(identity);
    if (previous) {
      if (previous.encoded !== encoded) throw new Phase6ValidationError('conflicting_duplicate', `${path} contains conflicting duplicate identities`, path);
      continue;
    }
    byIdentity.set(identity, { item, identity, encoded });
  }
  return [...byIdentity.values()];
}
function canonicalBoundedArray(source, key, limit, path) {
  const records = deduplicateRawByIdentity(source, (item) => rawIdentity(key, item), path).sort((a, b) => a.identity.localeCompare(b.identity) || a.encoded.localeCompare(b.encoded));
  return { items: records.slice(0, limit).map(({ item }) => structuredClone(item)), truncated: records.length > limit };
}
function canonicalBoundedNestedArray(source, identityOf, limit, path) {
  const records = deduplicateRawByIdentity(source, identityOf, path).sort((a, b) => a.identity.localeCompare(b.identity) || a.encoded.localeCompare(b.encoded));
  return { items: records.slice(0, limit).map(({ item }) => structuredClone(item)), truncated: records.length > limit };
}
function truncateNested(result, warnings) {
  for (const model of result.models) {
    if (!Array.isArray(model.entries)) continue;
    const normalized = canonicalBoundedNestedArray(model.entries, (entry) => entry?.name ?? '', PHASE6_BOUNDS.modelEntries, '$.models.entries');
    model.entries = normalized.items;
    if (normalized.truncated) warnings.push({ code: 'collection_truncated', message: 'Model entries were truncated to the profile bound', path: '$.models.entries' });
  }
  for (const trace of result.traces) {
    if (!Array.isArray(trace.steps)) continue;
    const normalized = canonicalBoundedNestedArray(trace.steps, (step) => String(step?.index ?? ''), PHASE6_BOUNDS.traceDepth, '$.traces.steps');
    trace.steps = normalized.items;
    if (normalized.truncated) warnings.push({ code: 'collection_truncated', message: 'Trace steps were truncated to the profile bound', path: '$.traces.steps' });
  }
}
function boundedCaptureToResult(capture, profileId) {
  if (capture === null || typeof capture !== 'object' || Array.isArray(capture) || ![Object.prototype, null].includes(Object.getPrototypeOf(capture))) throw new Phase6ValidationError('invalid_plain_object', 'capture must be an ordinary or null-prototype object', '$');
  for (const key of Object.keys(capture)) if (!CAPTURE_KEYS.has(key)) throw new Phase6ValidationError('unknown_field', 'capture contains a rejected field', '$.[rejected-field]');
  for (const key of CAPTURE_KEYS) if (!(key in capture)) throw new Phase6ValidationError('missing_field', `capture is missing ${key}`, `$.${key}`);
  if (capture.schemaVersion !== CAPTURE_SCHEMAS[profileId]) throw new Phase6ValidationError('invalid_capture_schema', 'capture schema does not match parser', '$.schemaVersion');
  if (capture.profileId !== profileId) throw new Phase6ValidationError('invalid_profile_id', 'capture profile does not match parser', '$.profileId');
  if (capture.trustedProducer !== PHASE6_TRUSTED_PRODUCER) throw new Phase6ValidationError('invalid_trusted_producer', 'capture producer is not allowlisted', '$.trustedProducer');
  if (capture.toolVersion !== TOOL_VERSIONS[profileId]) throw new Phase6ValidationError('invalid_tool_version', 'capture toolVersion does not match the exact profile version', '$.toolVersion');
  const result = emptyResult(profileId, capture.outcome);
  const warnings = [];
  for (const [key, limit] of Object.entries(RESULT_ARRAY_LIMITS)) {
    const source = capture[key];
    if (!Array.isArray(source)) throw new Phase6ValidationError('invalid_collection', `$.${key} must be an array`, `$.${key}`);
    const normalized = canonicalBoundedArray(source, key, limit, `$.${key}`);
    result[key] = normalized.items;
    if (normalized.truncated) warnings.push({ code: 'collection_truncated', message: `${key} was truncated to the profile bound`, path: `$.${key}` });
  }
  if (typeof capture.truncated !== 'boolean') throw new Phase6ValidationError('invalid_type', '$.truncated must be a boolean', '$.truncated');
  result.truncated = capture.truncated || warnings.length > 0;
  truncateNested(result, warnings);
  result.parserWarnings = [...result.parserWarnings, ...warnings].slice(0, PHASE6_BOUNDS.parserWarnings);
  if (warnings.length) result.truncated = true;
  return result;
}
function parseBytes(bytes, profileId) {
  assertBytes(bytes);
  try {
    if (bytes.byteLength > PHASE6_BOUNDS.inputBytes) return parserError(profileId, 'input_too_large');
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return parserError(profileId, 'invalid_utf8'); }
    let capture;
    try { capture = JSON.parse(text); } catch { return parserError(profileId, 'invalid_json'); }
    try { return validateFormalResult(boundedCaptureToResult(capture, profileId)); }
    catch (error) {
      if (error instanceof Phase6ValidationError) return parserError(profileId, error.code, error.path);
      return parserError(profileId, 'unexpected_parser_error');
    }
  } catch { return parserError(profileId, 'unexpected_parser_error'); }
}
export function parseSoliditySmtBytes(bytes) { return parseBytes(bytes, 'solidity-smt-v1'); }
export function parseHalmosBytes(bytes) { return parseBytes(bytes, 'halmos-v1'); }
export function parseFormalObligationsBytes(bytes) { return parseBytes(bytes, 'formal-obligations-v1'); }
