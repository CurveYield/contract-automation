function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalize(value, path = '$') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`Numbers must be finite at ${path}`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => normalize(entry, `${path}[${index}]`));
  if (!isPlainObject(value)) throw new TypeError(`Only plain objects are supported at ${path}`);

  const result = Object.create(null);
  for (const key of Object.keys(value).sort()) {
    const entry = value[key];
    if (entry === undefined || typeof entry === 'function' || typeof entry === 'symbol' || typeof entry === 'bigint') {
      throw new TypeError(`Unsupported value at ${path}.${key}`);
    }
    result[key] = normalize(entry, `${path}.${key}`);
  }
  return result;
}

export function canonicalJson(value) {
  return JSON.stringify(normalize(value));
}
