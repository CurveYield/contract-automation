export class ValidationError extends Error {
  constructor(code, message, path = '$') {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.path = path;
  }
}

const PREFIXES = Object.freeze({
  tenant: 'ten',
  workspace: 'ws',
  campaign: 'cmp',
  attempt: 'att',
  fork: 'fork',
  snapshot: 'snap'
});

export function assertAuditId(value, type, path = '$') {
  const prefix = PREFIXES[type];
  if (!prefix) throw new ValidationError('invalid_id_type', `Unknown Audit ID type: ${type}`, path);
  const expression = new RegExp(`^${prefix}_[0-9a-f]{32}$`);
  if (typeof value !== 'string' || !expression.test(value)) {
    throw new ValidationError('invalid_id', `${path} must be a ${type} Audit ID`, path);
  }
  return value;
}

export function assertProfileId(value, path = '$.profileId') {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/.test(value)) {
    throw new ValidationError('invalid_profile_id', `${path} must be a lowercase versioned profile slug`, path);
  }
  return value;
}
