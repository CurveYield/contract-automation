export class Phase6ValidationError extends Error {
  constructor(code, message, path = '$') {
    super(message);
    this.name = 'Phase6ValidationError';
    this.code = code;
    this.path = path;
  }
}

export const PHASE6_OUTCOMES = Object.freeze([
  'proved', 'disproved', 'unknown', 'timeout', 'resource_exhausted', 'cancelled', 'parser_error'
]);

export const PHASE6_BOUNDS = Object.freeze({
  inputBytes: 1_048_576,
  symbolicExpressionChars: 4_096,
  obligations: 256,
  assertions: 1_024,
  traceDepth: 512,
  traces: 64,
  modelEntries: 256,
  models: 64,
  counterexamples: 64,
  diagnostics: 128,
  sourceReferences: 4_096,
  sourceReferencesPerItem: 64,
  parserWarnings: 128,
  identifierChars: 80,
  shortStringChars: 256,
  messageChars: 4_096,
  modelValueChars: 512,
  numericDigits: 256,
  nestedCollectionDepth: 8,
  validationPathChars: 512
});

export const PROFILE_IDS = Object.freeze(['solidity-smt-v1', 'halmos-v1', 'formal-obligations-v1']);

const FORBIDDEN_KEYS = new Set([
  'shell', 'command', 'commands', 'script', 'scripts', 'arbitrarycommand',
  'npmscript', 'packagemanager', 'packagecommand', 'install', 'download',
  'dockerfile', 'container', 'customimage', 'image', 'imageurl', 'binary',
  'executable', 'plugin', 'plugins', 'workflow', 'workflowfile',
  'url', 'uri', 'rpc', 'rpcurl', 'rpcendpoint', 'networkdestination',
  'destination', 'host', 'hostname', 'proxy',
  'privatekey', 'privatekeys', 'mnemonic', 'seedphrase', 'credential',
  'credentials', 'secret', 'secrets', 'token', 'apikey', 'signer', 'wallet',
  'transaction', 'rawtransaction', 'signedtransaction', 'broadcast',
  'privileged', 'privilegedmode', 'capabilities', 'mount', 'mounts',
  'entrypoint', 'workingdirectory', 'aws', 'r2list', 'submittedscript'
]);

const UNSAFE_PATH_TERM = /(private.?key|mnemonic|seed.?phrase|secret|token|authorization|api.?key|access.?key|bearer)/i;
const UNSAFE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const PATH_PATTERN = /^\$(?:(?:\.[A-Za-z0-9_.:-]{1,80})|(?:\[[0-9]{1,10}\]))*$/;

export const SMT_TARGETS = Object.freeze([
  'assert', 'balance', 'constantCondition', 'divByZero', 'outOfBounds', 'overflow', 'popEmptyArray', 'underflow'
]);
export const TRACE_EVENTS = Object.freeze(['LOG', 'SLOAD', 'SSTORE']);

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function clone(value) { return structuredClone(value); }

function normalizedKey(key) { return key.replace(/[^A-Za-z0-9]/g, '').toLowerCase(); }

export function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertPlainObject(value, path) {
  if (!isPlainObject(value)) {
    throw new Phase6ValidationError('invalid_plain_object', `${path} must be an ordinary or null-prototype object`, path);
  }
  return value;
}

export function sanitizeValidationPath(path) {
  if (typeof path !== 'string' || path.length < 1 || path.length > PHASE6_BOUNDS.validationPathChars) return '$.[rejected-field]';
  if (UNSAFE_CONTROL.test(path) || UNSAFE_PATH_TERM.test(path) || !PATH_PATTERN.test(path)) return '$.[rejected-field]';
  return path;
}

export function assertAllowedKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Phase6ValidationError('unknown_field', `${path} contains a rejected field`, '$.[rejected-field]');
    }
  }
}

export function assertRequiredKeys(value, required, path) {
  for (const key of required) {
    if (!(key in value)) throw new Phase6ValidationError('missing_field', `${path}.${key} is required`, `${path}.${key}`);
  }
}

export function assertString(value, path, maxLength = PHASE6_BOUNDS.shortStringChars, minLength = 1) {
  if (typeof value !== 'string') throw new Phase6ValidationError('invalid_type', `${path} must be a string`, path);
  if (value.length < minLength) throw new Phase6ValidationError('string_too_short', `${path} is too short`, path);
  if (value.length > maxLength) throw new Phase6ValidationError('string_too_long', `${path} exceeds ${maxLength} characters`, path);
  return value;
}

export function assertNoUnsafeControl(value, path) {
  if (UNSAFE_CONTROL.test(value)) throw new Phase6ValidationError('unsafe_control_character', `${path} contains an unsafe control character`, path);
  return value;
}

export function assertSemanticString(value, path, maxLength) {
  return assertNoUnsafeControl(assertString(value, path, maxLength), path);
}

export function normalizeMessageText(value, path, maxLength = PHASE6_BOUNDS.messageChars) {
  let text = assertNoUnsafeControl(assertString(value, path, maxLength), path).replace(/[\t\r\n]+/g, ' ');
  text = text.replace(/\b(?:authorization\s*:\s*)?(?:bearer\s+)[^\s,;]+/gi, '[redacted]');
  text = text.replace(/\bauthorization\s*:\s*[^\s,;]+/gi, '[redacted]');
  text = text.replace(/\b(?:api|access)[ _-]?key\s*[:=]\s*[^\s,;]+/gi, '[redacted]');
  text = text.replace(/\b(?:[A-Z0-9_]*(?:KEY|TOKEN|SECRET)[A-Z0-9_]*)\s*=\s*[^\s,;]+/g, '[redacted]');
  text = text.replace(/\b(?:private\s*key|privatekey)\s*[:=]?\s*(?:0x)?[0-9a-f]{64}\b/gi, '[redacted]');
  text = text.replace(/\b(?:0x)?[0-9a-f]{64}\b/gi, '[redacted]');
  text = text.replace(/\b(?:mnemonic|seed\s*phrase)\s*[:=]?\s+(?:[a-z]+\s+){5,23}[a-z]+\b/gi, '[redacted]');
  text = text.replace(/\b[A-Za-z]:\\(?:[^\\\s]+\\)*[^\\\s]*/g, '[path]');
  text = text.replace(/\/(?:[^/\s]+\/)+[^/\s]*/g, '[path]');
  return text;
}

export function normalizeOptionalMessageText(value, path, maxLength = PHASE6_BOUNDS.messageChars) {
  if (value === null || value === undefined) return null;
  return normalizeMessageText(value, path, maxLength);
}

export function assertOptionalString(value, path, maxLength = PHASE6_BOUNDS.shortStringChars) {
  if (value === null || value === undefined) return null;
  return assertString(value, path, maxLength);
}

export function assertBoolean(value, path) {
  if (typeof value !== 'boolean') throw new Phase6ValidationError('invalid_type', `${path} must be a boolean`, path);
  return value;
}

export function assertInteger(value, path, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Phase6ValidationError('invalid_integer', `${path} must be a safe integer from ${min} to ${max}`, path);
  }
  return value;
}

export function assertEnum(value, allowed, path) {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Phase6ValidationError('invalid_enum', `${path} is not an allowed value`, path);
  return value;
}

export function assertIdentifier(value, path) {
  assertString(value, path, PHASE6_BOUNDS.identifierChars);
  if (!/^[A-Za-z][A-Za-z0-9_.:-]*$/.test(value)) throw new Phase6ValidationError('invalid_identifier', `${path} is not a valid identifier`, path);
  return value;
}

export function assertStringArray(value, path, maxItems, maxChars = PHASE6_BOUNDS.shortStringChars, unique = true) {
  if (!Array.isArray(value) || value.length > maxItems) throw new Phase6ValidationError('invalid_collection', `${path} must contain at most ${maxItems} items`, path);
  const seen = new Set();
  return value.map((item, index) => {
    const checked = assertSemanticString(item, `${path}[${index}]`, maxChars);
    if (unique && seen.has(checked)) throw new Phase6ValidationError('duplicate_item', `${path}[${index}] duplicates an earlier item`, `${path}[${index}]`);
    seen.add(checked);
    return checked;
  });
}

export function assertSortedStringArray(value, path, maxItems, maxChars = PHASE6_BOUNDS.shortStringChars) {
  return assertStringArray(value, path, maxItems, maxChars, true).sort((a, b) => a.localeCompare(b));
}

export function assertEnumArray(value, allowed, path, maxItems) {
  const items = assertStringArray(value, path, maxItems, PHASE6_BOUNDS.shortStringChars, true);
  return items.map((item, index) => assertEnum(item, allowed, `${path}[${index}]`));
}

export function scanPhase6ForbiddenFields(value, path = '$', depth = 0) {
  if (depth > PHASE6_BOUNDS.nestedCollectionDepth) throw new Phase6ValidationError('nested_too_deep', `${sanitizeValidationPath(path)} exceeds the nested collection depth`, sanitizeValidationPath(path));
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanPhase6ForbiddenFields(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_KEYS.has(normalizedKey(key))) {
      throw new Phase6ValidationError('forbidden_field', 'A forbidden field was rejected', sanitizeValidationPath(childPath));
    }
    scanPhase6ForbiddenFields(child, childPath, depth + 1);
  }
}
