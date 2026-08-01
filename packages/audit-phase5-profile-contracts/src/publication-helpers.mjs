import { ValidationError } from '../../audit-protocol/src/index.mjs';

export function immutableDigest(value, path = '$.digest') {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) {
    throw new ValidationError('invalid_digest', `${path} must be an immutable sha256 digest`, path);
  }
  return value;
}

export function canonicalInstant(value, path = '$.publishedAt') {
  if (typeof value !== 'string') throw new ValidationError('invalid_timestamp', `${path} must be a canonical ISO instant`, path);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new ValidationError('invalid_timestamp', `${path} must be a canonical ISO instant`, path);
  }
  return value;
}

