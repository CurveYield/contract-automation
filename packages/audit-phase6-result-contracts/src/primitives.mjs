import { Phase6ValidationError } from '../../audit-phase6-profile-contracts/src/index.mjs';

export class Phase6ResultContractError extends Phase6ValidationError {
  constructor(code, path, message = code) { super(code, message, path); this.name = 'Phase6ResultContractError'; }
}
export function fail(code, path, message = code) { throw new Phase6ResultContractError(code, path, message); }

const unsafeControl = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
function descriptors(value, path) {
  try { return { keys: Reflect.ownKeys(value), descriptors: Object.getOwnPropertyDescriptors(value), prototype: Reflect.getPrototypeOf(value) }; }
  catch { fail('hostile_reflection', path, 'External value reflection failed'); }
}
function descriptorValue(descriptor, path) {
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('hostile_descriptor', path, 'Accessors are not accepted');
  if (!descriptor.enumerable) fail('hidden_property', path, 'Non-enumerable properties are not accepted');
  return descriptor.value;
}
export function sanitizePhase6ExternalValue(value, path = '$', seen = new Map()) {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (unsafeControl.test(value)) fail('unsafe_control_character', path, 'Unsafe control character rejected');
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value) || Object.is(value, -0)) fail('invalid_number', path, 'Number must be a finite safe non-negative-zero integer');
    return value;
  }
  if (typeof value !== 'object') fail('invalid_type', path, 'Unsupported external value type');
  if (seen.has(value)) fail('cyclic_value', path, 'Cyclic external values are rejected');
  seen.set(value, path);
  const inspected = descriptors(value, path);
  const symbols = inspected.keys.filter((key) => typeof key === 'symbol');
  if (symbols.length) fail('symbol_property', path, 'Symbol properties are rejected');
  if (Array.isArray(value)) {
    if (inspected.prototype !== Array.prototype) fail('invalid_array', path, 'Array must use the ordinary prototype');
    const lengthDescriptor = inspected.descriptors.length;
    const length = lengthDescriptor?.value;
    if (!Number.isSafeInteger(length) || length < 0) fail('invalid_array', path);
    const keys = inspected.keys.filter((key) => key !== 'length');
    if (keys.length !== length) fail('sparse_array', path, 'Sparse or decorated arrays are rejected');
    const output = [];
    for (let index = 0; index < length; index += 1) {
      const key = String(index);
      if (!Object.hasOwn(inspected.descriptors, key)) fail('sparse_array', path);
      output.push(sanitizePhase6ExternalValue(descriptorValue(inspected.descriptors[key], `${path}[${index}]`), `${path}[${index}]`, seen));
    }
    seen.delete(value);
    return output;
  }
  if (inspected.prototype !== Object.prototype && inspected.prototype !== null) fail('invalid_plain_object', path, 'Object must use Object.prototype or null');
  const output = {};
  const stringKeys = inspected.keys.map(String).sort();
  for (const key of stringKeys) {
    const childPath = path === '$' ? `$.${key}` : `${path}.${key}`;
    const child = descriptorValue(inspected.descriptors[key], childPath);
    Object.defineProperty(output, key, { value: sanitizePhase6ExternalValue(child, childPath, seen), enumerable: true, writable: true, configurable: true });
  }
  seen.delete(value);
  return output;
}
export function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); } return value; }
export function canonicalJson(value) { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`; return JSON.stringify(value); }
export function exactKeys(value, keys, path = '$') { const allowed = new Set(keys); for (const key of Object.keys(value)) if (!allowed.has(key)) fail('unknown_field', `${path}.${key}`); for (const key of keys) if (!Object.hasOwn(value, key)) fail('missing_field', `${path}.${key}`); }
export function remapError(error, prefix) { if (error?.code && typeof error.path === 'string') { const suffix = error.path === '$' ? '' : error.path.slice(1); fail(error.code, `${prefix}${suffix}`, 'Upstream Phase 6 validation rejected the value'); } fail('upstream_validation_error', prefix); }
