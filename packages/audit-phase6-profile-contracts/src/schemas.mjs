import {
  PHASE6_BOUNDS,
  PHASE6_OUTCOMES,
  PROFILE_IDS,
  Phase6ValidationError,
  assertAllowedKeys,
  assertBoolean,
  assertEnum,
  assertIdentifier,
  assertInteger,
  assertOptionalString,
  assertPlainObject,
  assertRequiredKeys,
  assertString,
  assertStringArray,
  clone,
  scanPhase6ForbiddenFields
} from './base.mjs';

function validateSourceReference(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['id', 'sourceId', 'startLine', 'startColumn', 'endLine', 'endColumn']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  assertIdentifier(value.id, `${path}.id`);
  assertString(value.sourceId, `${path}.sourceId`, 512);
  assertInteger(value.startLine, `${path}.startLine`, 1, 10_000_000);
  assertInteger(value.startColumn, `${path}.startColumn`, 0, 1_000_000);
  assertInteger(value.endLine, `${path}.endLine`, value.startLine, 10_000_000);
  assertInteger(value.endColumn, `${path}.endColumn`, 0, 1_000_000);
  return clone(value);
}

function validateAssertion(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['id', 'expression', 'description', 'sourceReferenceIds']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  assertIdentifier(value.id, `${path}.id`);
  assertString(value.expression, `${path}.expression`, PHASE6_BOUNDS.symbolicExpressionChars);
  assertOptionalString(value.description, `${path}.description`, PHASE6_BOUNDS.messageChars);
  assertStringArray(value.sourceReferenceIds, `${path}.sourceReferenceIds`, PHASE6_BOUNDS.sourceReferencesPerItem, PHASE6_BOUNDS.identifierChars, true);
  return clone(value);
}

function validateObligation(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['id', 'kind', 'expression', 'assertionIds', 'sourceReferenceIds']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  assertIdentifier(value.id, `${path}.id`);
  assertEnum(value.kind, ['assertion', 'invariant', 'postcondition', 'precondition', 'reachability', 'equivalence', 'custom'], `${path}.kind`);
  assertString(value.expression, `${path}.expression`, PHASE6_BOUNDS.symbolicExpressionChars);
  assertStringArray(value.assertionIds, `${path}.assertionIds`, PHASE6_BOUNDS.assertions, PHASE6_BOUNDS.identifierChars, true);
  assertStringArray(value.sourceReferenceIds, `${path}.sourceReferenceIds`, PHASE6_BOUNDS.sourceReferencesPerItem, PHASE6_BOUNDS.identifierChars, true);
  return clone(value);
}

function validateModelEntry(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['name', 'type', 'value']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  assertString(value.name, `${path}.name`, 256);
  assertString(value.type, `${path}.type`, 160);
  assertString(value.value, `${path}.value`, PHASE6_BOUNDS.modelValueChars);
  const digitCount = (value.value.match(/[0-9]/g) || []).length;
  if (digitCount > PHASE6_BOUNDS.numericDigits) {
    throw new Phase6ValidationError('numeric_too_large', `${path}.value contains too many digits`, `${path}.value`);
  }
  return clone(value);
}

function validateModel(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['id', 'entries']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  assertIdentifier(value.id, `${path}.id`);
  if (!Array.isArray(value.entries) || value.entries.length > PHASE6_BOUNDS.modelEntries) {
    throw new Phase6ValidationError('invalid_collection', `${path}.entries exceeds its bound`, `${path}.entries`);
  }
  value.entries.forEach((entry, index) => validateModelEntry(entry, `${path}.entries[${index}]`));
  return clone(value);
}

function validateTraceStep(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['index', 'kind', 'operation', 'detail', 'sourceReferenceIds']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  assertInteger(value.index, `${path}.index`, 0, PHASE6_BOUNDS.traceDepth - 1);
  assertEnum(value.kind, ['call', 'return', 'branch', 'storage', 'log', 'assertion', 'solver', 'other'], `${path}.kind`);
  assertString(value.operation, `${path}.operation`, 256);
  assertOptionalString(value.detail, `${path}.detail`, PHASE6_BOUNDS.messageChars);
  assertStringArray(value.sourceReferenceIds, `${path}.sourceReferenceIds`, PHASE6_BOUNDS.sourceReferencesPerItem, PHASE6_BOUNDS.identifierChars, true);
  return clone(value);
}

function validateTrace(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['id', 'steps']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  assertIdentifier(value.id, `${path}.id`);
  if (!Array.isArray(value.steps) || value.steps.length > PHASE6_BOUNDS.traceDepth) {
    throw new Phase6ValidationError('invalid_collection', `${path}.steps exceeds trace depth`, `${path}.steps`);
  }
  value.steps.forEach((step, index) => validateTraceStep(step, `${path}.steps[${index}]`));
  return clone(value);
}

function validateCounterexample(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['id', 'obligationId', 'failingAssertionIds', 'modelIds', 'traceIds', 'summary']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  assertIdentifier(value.id, `${path}.id`);
  assertIdentifier(value.obligationId, `${path}.obligationId`);
  assertStringArray(value.failingAssertionIds, `${path}.failingAssertionIds`, PHASE6_BOUNDS.assertions, PHASE6_BOUNDS.identifierChars, true);
  assertStringArray(value.modelIds, `${path}.modelIds`, PHASE6_BOUNDS.models, PHASE6_BOUNDS.identifierChars, true);
  assertStringArray(value.traceIds, `${path}.traceIds`, PHASE6_BOUNDS.traces, PHASE6_BOUNDS.identifierChars, true);
  assertString(value.summary, `${path}.summary`, PHASE6_BOUNDS.messageChars);
  return clone(value);
}

function validateDiagnostic(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['code', 'severity', 'message', 'sourceReferenceIds']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  assertIdentifier(value.code, `${path}.code`);
  assertEnum(value.severity, ['info', 'warning', 'error'], `${path}.severity`);
  assertString(value.message, `${path}.message`, PHASE6_BOUNDS.messageChars);
  assertStringArray(value.sourceReferenceIds, `${path}.sourceReferenceIds`, PHASE6_BOUNDS.sourceReferencesPerItem, PHASE6_BOUNDS.identifierChars, true);
  return clone(value);
}

export function validateParserWarning(value, path = '$') {
  assertPlainObject(value, path);
  const allowed = new Set(['code', 'message', 'path']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  assertIdentifier(value.code, `${path}.code`);
  assertString(value.message, `${path}.message`, PHASE6_BOUNDS.messageChars);
  assertString(value.path, `${path}.path`, 512);
  return clone(value);
}

function validateBoundedArray(value, path, max, validator) {
  if (!Array.isArray(value) || value.length > max) {
    throw new Phase6ValidationError('invalid_collection', `${path} must contain at most ${max} items`, path);
  }
  value.forEach((item, index) => validator(item, `${path}[${index}]`));
}

export function validateFormalResult(value) {
  assertPlainObject(value, '$');
  scanPhase6ForbiddenFields(value);
  const required = new Set([
    'schemaVersion', 'profileId', 'outcome', 'obligations', 'assertions', 'models',
    'traces', 'counterexamples', 'diagnostics', 'sourceReferences', 'parserWarnings', 'truncated'
  ]);
  assertAllowedKeys(value, required, '$');
  assertRequiredKeys(value, required, '$');
  assertEnum(value.schemaVersion, ['formal-result-v1'], '$.schemaVersion');
  assertEnum(value.profileId, PROFILE_IDS, '$.profileId');
  assertEnum(value.outcome, PHASE6_OUTCOMES, '$.outcome');
  validateBoundedArray(value.obligations, '$.obligations', PHASE6_BOUNDS.obligations, validateObligation);
  validateBoundedArray(value.assertions, '$.assertions', PHASE6_BOUNDS.assertions, validateAssertion);
  validateBoundedArray(value.models, '$.models', PHASE6_BOUNDS.models, validateModel);
  validateBoundedArray(value.traces, '$.traces', PHASE6_BOUNDS.traces, validateTrace);
  validateBoundedArray(value.counterexamples, '$.counterexamples', PHASE6_BOUNDS.counterexamples, validateCounterexample);
  validateBoundedArray(value.diagnostics, '$.diagnostics', PHASE6_BOUNDS.diagnostics, validateDiagnostic);
  validateBoundedArray(value.sourceReferences, '$.sourceReferences', PHASE6_BOUNDS.sourceReferences, validateSourceReference);
  validateBoundedArray(value.parserWarnings, '$.parserWarnings', PHASE6_BOUNDS.parserWarnings, validateParserWarning);
  assertBoolean(value.truncated, '$.truncated');
  return clone(value);
}


export function validateFormalSourceReference(value) {
  return validateSourceReference(value, '$');
}

export function validateFormalAssertion(value) {
  return validateAssertion(value, '$');
}

export function validateProofObligation(value) {
  return validateObligation(value, '$');
}

export function validateFormalModel(value) {
  return validateModel(value, '$');
}

export function validateFormalTrace(value) {
  return validateTrace(value, '$');
}

export function validateFormalCounterexample(value) {
  return validateCounterexample(value, '$');
}

export function validateProofOutcome(value) {
  return validateFormalResult(value);
}
