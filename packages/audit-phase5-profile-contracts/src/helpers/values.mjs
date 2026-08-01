import {
  ValidationError,
  assertProfileId
} from '../../../audit-protocol/src/index.mjs';
import { TEMPLATE_BY_ID } from '../templates.mjs';

export function boolean(value, path) {
  if (typeof value !== 'boolean') throw new ValidationError('invalid_boolean', `${path} must be a boolean`, path);
  return value;
}

export function integer(value, path, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ValidationError('invalid_integer', `${path} must be an integer from ${minimum} to ${maximum}`, path);
  }
  return value;
}

export function enumeration(value, path, allowed) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new ValidationError('invalid_enum', `${path} is not allowlisted`, path);
  }
  return value;
}

export function boundedString(value, path, maximum, allowEmpty = true) {
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && value.length === 0) || /[\u0000-\u001f]/.test(value)) {
    throw new ValidationError('invalid_string', `${path} is invalid`, path);
  }
  return value;
}

export function safeRelativePath(value, path, suffixes) {
  boundedString(value, path, 512, false);
  if (
    value.startsWith('/') || /^[A-Za-z]:/.test(value) || value.includes('\\') ||
    value.split('/').includes('..') || value.includes('//') ||
    !/^[A-Za-z0-9_.{}*?\[\],@+\/-]+$/.test(value) ||
    !suffixes.some((suffix) => value.endsWith(suffix))
  ) {
    throw new ValidationError('invalid_path', `${path} must be a safe allowlisted relative file`, path);
  }
  return value;
}

export function uniqueArray(value, path, validator, maximum = 64) {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) {
    throw new ValidationError('invalid_array', `${path} must contain 1 to ${maximum} entries`, path);
  }
  const seen = new Set();
  return value.map((item, index) => {
    const checked = validator(item, `${path}[${index}]`);
    const key = JSON.stringify(checked);
    if (seen.has(key)) throw new ValidationError('duplicate_array_item', `${path}[${index}] is duplicated`, `${path}[${index}]`);
    seen.add(key);
    return checked;
  });
}

export function knownProfile(profileId) {
  assertProfileId(profileId);
  const templateValue = TEMPLATE_BY_ID.get(profileId);
  if (!templateValue) throw new ValidationError('unknown_profile_id', `Unsupported Phase 5 profileId: ${profileId}`, '$.profileId');
  return templateValue;
}
