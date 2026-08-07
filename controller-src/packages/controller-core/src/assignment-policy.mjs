import { createHash, timingSafeEqual } from 'node:crypto';
import { AssignmentStatus } from './constants.mjs';
import { InvalidTransitionError, ValidationError } from './errors.mjs';

export function hashLeaseToken(token) {
  if (typeof token !== 'string' || token.length < 8) throw new ValidationError('lease token must contain at least 8 characters');
  return createHash('sha256').update(token).digest('hex');
}

export function leaseTokenMatches(expectedHash, token) {
  const actual = Buffer.from(hashLeaseToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function addSeconds(timestamp, seconds) {
  const start = Date.parse(timestamp);
  if (!Number.isFinite(start)) throw new ValidationError('timestamp must be ISO-8601');
  if (!Number.isInteger(seconds) || seconds < 60 || seconds > 604800) {
    throw new ValidationError('leaseDurationSeconds must be an integer from 60 through 604800');
  }
  return new Date(start + seconds * 1000).toISOString();
}

export function isLeaseExpired(assignment, timestamp) {
  if (!assignment.leaseExpiresAt) return false;
  const now = Date.parse(timestamp);
  const expiry = Date.parse(assignment.leaseExpiresAt);
  if (!Number.isFinite(now) || !Number.isFinite(expiry)) throw new ValidationError('lease timestamps must be ISO-8601');
  return now >= expiry;
}

export function assertWorkerCanClaim(assignment, worker, leaseToken) {
  if (assignment.status !== AssignmentStatus.READY) throw new InvalidTransitionError(`assignment is ${assignment.status}, not READY`);
  if (worker.roleId !== assignment.roleId) throw new ValidationError(`worker role ${worker.roleId} does not match assignment role ${assignment.roleId}`);
  const missing = assignment.requiredCapabilities.filter((capability) => !worker.capabilities.includes(capability));
  if (missing.length > 0) throw new ValidationError(`worker is missing required capabilities: ${missing.join(', ')}`);
  if (!leaseTokenMatches(assignment.leaseTokenHash, leaseToken)) throw new ValidationError('lease token does not match assignment');
}

export function assertCurrentLease(assignment, workerId, leaseToken, timestamp) {
  if (assignment.status !== AssignmentStatus.LEASED) throw new InvalidTransitionError(`assignment is ${assignment.status}, not LEASED`);
  if (assignment.assignedWorkerId !== workerId) throw new ValidationError('worker does not own this assignment lease');
  if (!leaseTokenMatches(assignment.leaseTokenHash, leaseToken)) throw new ValidationError('lease token does not match assignment');
  if (isLeaseExpired(assignment, timestamp)) throw new InvalidTransitionError('assignment lease has expired');
}
