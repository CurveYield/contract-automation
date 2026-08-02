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
  assertPlainObject,
  assertRequiredKeys,
  assertSemanticString,
  assertSortedStringArray,
  clone,
  normalizeMessageText,
  normalizeOptionalMessageText,
  sanitizeValidationPath,
  scanPhase6ForbiddenFields
} from './base.mjs';

function stableJson(value) { return JSON.stringify(value); }

function deduplicateByIdentity(items, path, identity, compare = (a, b) => String(identity(a)).localeCompare(String(identity(b)))) {
  const byIdentity = new Map();
  for (const item of items) {
    const key = String(identity(item));
    const encoded = stableJson(item);
    const previous = byIdentity.get(key);
    if (previous && previous.encoded !== encoded) {
      throw new Phase6ValidationError('conflicting_duplicate', `${path} contains conflicting records with the same identity`, path);
    }
    if (!previous) byIdentity.set(key, { item, encoded });
  }
  return [...byIdentity.values()].map(({ item }) => item).sort(compare);
}

function validateSourceReference(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['id', 'sourceId', 'startLine', 'startColumn', 'endLine', 'endColumn']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  return {
    id: assertIdentifier(value.id, `${path}.id`),
    sourceId: normalizeMessageText(value.sourceId, `${path}.sourceId`, 512),
    startLine: assertInteger(value.startLine, `${path}.startLine`, 1, 10_000_000),
    startColumn: assertInteger(value.startColumn, `${path}.startColumn`, 0, 1_000_000),
    endLine: assertInteger(value.endLine, `${path}.endLine`, value.startLine, 10_000_000),
    endColumn: assertInteger(value.endColumn, `${path}.endColumn`, 0, 1_000_000)
  };
}

function validateAssertion(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['id', 'expression', 'description', 'sourceReferenceIds']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  return {
    id: assertIdentifier(value.id, `${path}.id`),
    expression: assertSemanticString(value.expression, `${path}.expression`, PHASE6_BOUNDS.symbolicExpressionChars),
    description: normalizeOptionalMessageText(value.description, `${path}.description`, PHASE6_BOUNDS.messageChars),
    sourceReferenceIds: assertSortedStringArray(value.sourceReferenceIds, `${path}.sourceReferenceIds`, PHASE6_BOUNDS.sourceReferencesPerItem, PHASE6_BOUNDS.identifierChars)
  };
}

function validateObligation(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['id', 'kind', 'expression', 'assertionIds', 'sourceReferenceIds']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  return {
    id: assertIdentifier(value.id, `${path}.id`),
    kind: assertEnum(value.kind, ['assertion', 'invariant', 'postcondition', 'precondition', 'reachability', 'equivalence', 'custom'], `${path}.kind`),
    expression: assertSemanticString(value.expression, `${path}.expression`, PHASE6_BOUNDS.symbolicExpressionChars),
    assertionIds: assertSortedStringArray(value.assertionIds, `${path}.assertionIds`, PHASE6_BOUNDS.assertions, PHASE6_BOUNDS.identifierChars),
    sourceReferenceIds: assertSortedStringArray(value.sourceReferenceIds, `${path}.sourceReferenceIds`, PHASE6_BOUNDS.sourceReferencesPerItem, PHASE6_BOUNDS.identifierChars)
  };
}

function validateModelEntry(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['name', 'type', 'value']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  const normalized = {
    name: assertSemanticString(value.name, `${path}.name`, 256),
    type: assertSemanticString(value.type, `${path}.type`, 160),
    value: assertSemanticString(value.value, `${path}.value`, PHASE6_BOUNDS.modelValueChars)
  };
  const digitCount = (normalized.value.match(/[0-9]/g) || []).length;
  if (digitCount > PHASE6_BOUNDS.numericDigits) throw new Phase6ValidationError('numeric_too_large', `${path}.value contains too many digits`, `${path}.value`);
  return normalized;
}

function validateModel(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['id', 'entries']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  if (!Array.isArray(value.entries) || value.entries.length > PHASE6_BOUNDS.modelEntries) {
    throw new Phase6ValidationError('invalid_collection', `${path}.entries exceeds its bound`, `${path}.entries`);
  }
  const entries = value.entries.map((entry, index) => validateModelEntry(entry, `${path}.entries[${index}]`));
  return {
    id: assertIdentifier(value.id, `${path}.id`),
    entries: deduplicateByIdentity(entries, `${path}.entries`, (entry) => entry.name)
  };
}

function validateTraceStep(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['index', 'kind', 'operation', 'detail', 'sourceReferenceIds']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  return {
    index: assertInteger(value.index, `${path}.index`, 0, PHASE6_BOUNDS.traceDepth - 1),
    kind: assertEnum(value.kind, ['call', 'return', 'branch', 'storage', 'log', 'assertion', 'solver', 'other'], `${path}.kind`),
    operation: assertSemanticString(value.operation, `${path}.operation`, 256),
    detail: normalizeOptionalMessageText(value.detail, `${path}.detail`, PHASE6_BOUNDS.messageChars),
    sourceReferenceIds: assertSortedStringArray(value.sourceReferenceIds, `${path}.sourceReferenceIds`, PHASE6_BOUNDS.sourceReferencesPerItem, PHASE6_BOUNDS.identifierChars)
  };
}

function validateTrace(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['id', 'steps']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  if (!Array.isArray(value.steps) || value.steps.length > PHASE6_BOUNDS.traceDepth) {
    throw new Phase6ValidationError('invalid_collection', `${path}.steps exceeds trace depth`, `${path}.steps`);
  }
  const steps = value.steps.map((step, index) => validateTraceStep(step, `${path}.steps[${index}]`));
  return {
    id: assertIdentifier(value.id, `${path}.id`),
    steps: deduplicateByIdentity(steps, `${path}.steps`, (step) => step.index, (a, b) => a.index - b.index)
  };
}

function validateCounterexample(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['id', 'obligationId', 'failingAssertionIds', 'modelIds', 'traceIds', 'summary']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  return {
    id: assertIdentifier(value.id, `${path}.id`),
    obligationId: assertIdentifier(value.obligationId, `${path}.obligationId`),
    failingAssertionIds: assertSortedStringArray(value.failingAssertionIds, `${path}.failingAssertionIds`, PHASE6_BOUNDS.assertions, PHASE6_BOUNDS.identifierChars),
    modelIds: assertSortedStringArray(value.modelIds, `${path}.modelIds`, PHASE6_BOUNDS.models, PHASE6_BOUNDS.identifierChars),
    traceIds: assertSortedStringArray(value.traceIds, `${path}.traceIds`, PHASE6_BOUNDS.traces, PHASE6_BOUNDS.identifierChars),
    summary: normalizeMessageText(value.summary, `${path}.summary`, PHASE6_BOUNDS.messageChars)
  };
}

function validateDiagnostic(value, path) {
  assertPlainObject(value, path);
  const allowed = new Set(['code', 'severity', 'message', 'sourceReferenceIds']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  return {
    code: assertIdentifier(value.code, `${path}.code`),
    severity: assertEnum(value.severity, ['info', 'warning', 'error'], `${path}.severity`),
    message: normalizeMessageText(value.message, `${path}.message`, PHASE6_BOUNDS.messageChars),
    sourceReferenceIds: assertSortedStringArray(value.sourceReferenceIds, `${path}.sourceReferenceIds`, PHASE6_BOUNDS.sourceReferencesPerItem, PHASE6_BOUNDS.identifierChars)
  };
}

export function validateParserWarning(value, path = '$') {
  assertPlainObject(value, path);
  const allowed = new Set(['code', 'message', 'path']);
  assertAllowedKeys(value, allowed, path);
  assertRequiredKeys(value, allowed, path);
  return {
    code: assertIdentifier(value.code, `${path}.code`),
    message: normalizeMessageText(value.message, `${path}.message`, PHASE6_BOUNDS.messageChars),
    path: sanitizeValidationPath(assertSemanticString(value.path, `${path}.path`, PHASE6_BOUNDS.validationPathChars))
  };
}

function normalizeCollection(value, path, max, validator, identity, compare) {
  if (!Array.isArray(value) || value.length > max) throw new Phase6ValidationError('invalid_collection', `${path} must contain at most ${max} items`, path);
  const normalized = value.map((item, index) => validator(item, `${path}[${index}]`));
  return deduplicateByIdentity(normalized, path, identity, compare);
}

function diagnosticIdentity(item) { return `${item.code}\u0000${item.severity}\u0000${item.sourceReferenceIds.join('\u0000')}`; }
function warningIdentity(item) { return `${item.code}\u0000${item.path}`; }

function requireReference(set, id, path) {
  if (!set.has(id)) throw new Phase6ValidationError('dangling_reference', `${path} contains a dangling reference`, path);
}

function validateReferentialIntegrity(result) {
  const assertionIds = new Set(result.assertions.map(({ id }) => id));
  const obligationIds = new Set(result.obligations.map(({ id }) => id));
  const modelIds = new Set(result.models.map(({ id }) => id));
  const traceIds = new Set(result.traces.map(({ id }) => id));
  const sourceIds = new Set(result.sourceReferences.map(({ id }) => id));

  for (const obligation of result.obligations) {
    for (const id of obligation.assertionIds) requireReference(assertionIds, id, '$.obligations.assertionIds');
    for (const id of obligation.sourceReferenceIds) requireReference(sourceIds, id, '$.obligations.sourceReferenceIds');
  }
  for (const assertion of result.assertions) {
    for (const id of assertion.sourceReferenceIds) requireReference(sourceIds, id, '$.assertions.sourceReferenceIds');
  }
  for (const trace of result.traces) {
    for (const step of trace.steps) for (const id of step.sourceReferenceIds) requireReference(sourceIds, id, '$.traces.steps.sourceReferenceIds');
  }
  for (const diagnostic of result.diagnostics) {
    for (const id of diagnostic.sourceReferenceIds) requireReference(sourceIds, id, '$.diagnostics.sourceReferenceIds');
  }
  for (const counterexample of result.counterexamples) {
    requireReference(obligationIds, counterexample.obligationId, '$.counterexamples.obligationId');
    for (const id of counterexample.failingAssertionIds) requireReference(assertionIds, id, '$.counterexamples.failingAssertionIds');
    for (const id of counterexample.modelIds) requireReference(modelIds, id, '$.counterexamples.modelIds');
    for (const id of counterexample.traceIds) requireReference(traceIds, id, '$.counterexamples.traceIds');
  }
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
  const normalized = {
    schemaVersion: assertEnum(value.schemaVersion, ['formal-result-v1'], '$.schemaVersion'),
    profileId: assertEnum(value.profileId, PROFILE_IDS, '$.profileId'),
    outcome: assertEnum(value.outcome, PHASE6_OUTCOMES, '$.outcome'),
    obligations: normalizeCollection(value.obligations, '$.obligations', PHASE6_BOUNDS.obligations, validateObligation, (item) => item.id),
    assertions: normalizeCollection(value.assertions, '$.assertions', PHASE6_BOUNDS.assertions, validateAssertion, (item) => item.id),
    models: normalizeCollection(value.models, '$.models', PHASE6_BOUNDS.models, validateModel, (item) => item.id),
    traces: normalizeCollection(value.traces, '$.traces', PHASE6_BOUNDS.traces, validateTrace, (item) => item.id),
    counterexamples: normalizeCollection(value.counterexamples, '$.counterexamples', PHASE6_BOUNDS.counterexamples, validateCounterexample, (item) => item.id),
    diagnostics: normalizeCollection(value.diagnostics, '$.diagnostics', PHASE6_BOUNDS.diagnostics, validateDiagnostic, diagnosticIdentity),
    sourceReferences: normalizeCollection(value.sourceReferences, '$.sourceReferences', PHASE6_BOUNDS.sourceReferences, validateSourceReference, (item) => item.id),
    parserWarnings: normalizeCollection(value.parserWarnings, '$.parserWarnings', PHASE6_BOUNDS.parserWarnings, validateParserWarning, warningIdentity),
    truncated: assertBoolean(value.truncated, '$.truncated')
  };
  validateReferentialIntegrity(normalized);
  return clone(normalized);
}

export function validateFormalSourceReference(value) { return validateSourceReference(value, '$'); }
export function validateFormalAssertion(value) { return validateAssertion(value, '$'); }
export function validateProofObligation(value) { return validateObligation(value, '$'); }
export function validateFormalModel(value) { return validateModel(value, '$'); }
export function validateFormalTrace(value) { return validateTrace(value, '$'); }
export function validateFormalCounterexample(value) { return validateCounterexample(value, '$'); }
export function validateProofOutcome(value) { return validateFormalResult(value); }
