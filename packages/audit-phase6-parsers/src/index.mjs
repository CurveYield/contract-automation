import {
  PHASE6_BOUNDS,
  Phase6ValidationError,
  validateFormalResult
} from '../../audit-phase6-profile-contracts/src/index.mjs';

const CAPTURE_SCHEMAS = Object.freeze({
  'solidity-smt-v1': 'solidity-smt-capture-v1',
  'halmos-v1': 'halmos-capture-v1',
  'formal-obligations-v1': 'formal-obligations-capture-v1'
});

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
  'schemaVersion', 'fixtureOwner', 'profileId', 'toolVersion', 'outcome',
  'obligations', 'assertions', 'models', 'traces', 'counterexamples',
  'diagnostics', 'sourceReferences', 'parserWarnings', 'truncated'
]);

function emptyResult(profileId, outcome = 'parser_error') {
  return {
    schemaVersion: 'formal-result-v1',
    profileId,
    outcome,
    obligations: [],
    assertions: [],
    models: [],
    traces: [],
    counterexamples: [],
    diagnostics: [],
    sourceReferences: [],
    parserWarnings: [],
    truncated: false
  };
}

function parserError(profileId, code, path = '$') {
  const result = emptyResult(profileId);
  result.diagnostics.push({
    code,
    severity: 'error',
    message: `Inert capture parsing failed with ${code}`,
    sourceReferenceIds: []
  });
  result.parserWarnings.push({ code: 'capture_rejected', message: `Capture rejected at ${path}`, path });
  return validateFormalResult(result);
}

function assertBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('parser input must be an explicitly supplied Uint8Array of inert bytes');
  }
}

function compareId(a, b) {
  return String(a.id ?? '').localeCompare(String(b.id ?? ''));
}

function canonicalize(result) {
  result.obligations.sort(compareId);
  result.assertions.sort(compareId);
  result.models.sort(compareId);
  for (const model of result.models) model.entries?.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
  result.traces.sort(compareId);
  for (const trace of result.traces) trace.steps?.sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));
  result.counterexamples.sort(compareId);
  result.sourceReferences.sort(compareId);
  result.diagnostics.sort((a, b) => `${a.code}\u0000${a.message}`.localeCompare(`${b.code}\u0000${b.message}`));
  result.parserWarnings.sort((a, b) => `${a.code}\u0000${a.path}`.localeCompare(`${b.code}\u0000${b.path}`));
  return result;
}

function truncateNested(result, warnings) {
  for (const model of result.models) {
    if (Array.isArray(model.entries) && model.entries.length > PHASE6_BOUNDS.modelEntries) {
      model.entries = model.entries.slice(0, PHASE6_BOUNDS.modelEntries);
      warnings.push({ code: 'collection_truncated', message: 'Model entries were truncated to the profile bound', path: `$.models.${model.id}.entries` });
    }
  }
  for (const trace of result.traces) {
    if (Array.isArray(trace.steps) && trace.steps.length > PHASE6_BOUNDS.traceDepth) {
      trace.steps = trace.steps.slice(0, PHASE6_BOUNDS.traceDepth);
      warnings.push({ code: 'collection_truncated', message: 'Trace steps were truncated to the profile bound', path: `$.traces.${trace.id}.steps` });
    }
  }
}

function boundedCaptureToResult(capture, profileId) {
  if (capture === null || typeof capture !== 'object' || Array.isArray(capture)) {
    throw new Phase6ValidationError('invalid_capture', 'capture must be an object', '$');
  }
  for (const key of Object.keys(capture)) {
    if (!CAPTURE_KEYS.has(key)) throw new Phase6ValidationError('unknown_field', `$.${key} is not allowed`, `$.${key}`);
  }
  if (capture.schemaVersion !== CAPTURE_SCHEMAS[profileId]) {
    throw new Phase6ValidationError('invalid_capture_schema', 'capture schema does not match parser', '$.schemaVersion');
  }
  if (capture.profileId !== profileId) {
    throw new Phase6ValidationError('invalid_profile_id', 'capture profile does not match parser', '$.profileId');
  }
  if (capture.fixtureOwner !== 'CurveYield') {
    throw new Phase6ValidationError('invalid_fixture_owner', 'capture is not a CurveYield-owned inert fixture', '$.fixtureOwner');
  }
  if (typeof capture.toolVersion !== 'string' || capture.toolVersion.length < 1 || capture.toolVersion.length > 80) {
    throw new Phase6ValidationError('invalid_tool_version', 'capture toolVersion is invalid', '$.toolVersion');
  }

  const result = emptyResult(profileId, capture.outcome);
  const warnings = [];
  for (const [key, limit] of Object.entries(RESULT_ARRAY_LIMITS)) {
    const source = capture[key] ?? [];
    if (!Array.isArray(source)) throw new Phase6ValidationError('invalid_collection', `$.${key} must be an array`, `$.${key}`);
    result[key] = structuredClone(source.slice(0, limit));
    if (source.length > limit) {
      warnings.push({ code: 'collection_truncated', message: `${key} was truncated to the profile bound`, path: `$.${key}` });
    }
  }
  result.truncated = Boolean(capture.truncated || warnings.length);
  truncateNested(result, warnings);
  result.parserWarnings = [...result.parserWarnings, ...warnings].slice(0, PHASE6_BOUNDS.parserWarnings);
  if (warnings.length) result.truncated = true;
  return canonicalize(result);
}

function parseBytes(bytes, profileId) {
  assertBytes(bytes);
  if (bytes.byteLength > PHASE6_BOUNDS.inputBytes) return parserError(profileId, 'input_too_large');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return parserError(profileId, 'invalid_utf8');
  }
  let capture;
  try {
    capture = JSON.parse(text);
  } catch {
    return parserError(profileId, 'invalid_json');
  }
  try {
    return validateFormalResult(boundedCaptureToResult(capture, profileId));
  } catch (error) {
    if (error instanceof Phase6ValidationError) return parserError(profileId, error.code, error.path);
    return parserError(profileId, 'unexpected_parser_error');
  }
}

export function parseSoliditySmtBytes(bytes) {
  return parseBytes(bytes, 'solidity-smt-v1');
}

export function parseHalmosBytes(bytes) {
  return parseBytes(bytes, 'halmos-v1');
}

export function parseFormalObligationsBytes(bytes) {
  return parseBytes(bytes, 'formal-obligations-v1');
}
