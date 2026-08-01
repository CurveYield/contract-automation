import { FORK_LIMITS, FREE_DEVELOPMENT_FORK_CAPABILITY } from './constants.mjs';
import {
  EXPORT_ID, RESTORE_ID, assertAttemptId, assertAuditId, assertBlockHash,
  assertCheckpointId, assertEnum, assertForkId, assertInteger, assertIso, assertLimit,
  assertSha, assertString, clone, fail, strictObject
} from './internals.mjs';
import { checkpointObjectKey } from './keys.mjs';

export function validateCheckpointManifest(value) {
  const keys = new Set(['schemaVersion','checkpointId','forkId','tenantId','attemptId','chainId','blockNumber','blockHash','objectKey','sha256','bytes','contentType','opaque','encryption','createdAt','expiresAt']);
  strictObject(value, keys, new Set([...keys].filter((key) => key !== 'blockHash')));
  if (value.schemaVersion !== 'fork-checkpoint-manifest-v1') fail('invalid_schema_version', '$.schemaVersion must be fork-checkpoint-manifest-v1', '$.schemaVersion');
  assertCheckpointId(value.checkpointId);
  assertForkId(value.forkId);
  assertAuditId(value.tenantId, 'tenant', '$.tenantId');
  assertAttemptId(value.attemptId);
  assertInteger(value.chainId, '$.chainId', 1, 4_294_967_295);
  assertInteger(value.blockNumber, '$.blockNumber', 0);
  if ('blockHash' in value) assertBlockHash(value.blockHash, '$.blockHash');
  const expectedKey = checkpointObjectKey(value.forkId, value.checkpointId);
  if (value.objectKey !== expectedKey) fail('invalid_object_key', `$.objectKey must be ${expectedKey}`, '$.objectKey');
  assertSha(value.sha256, '$.sha256');
  assertLimit(value.bytes, '$.bytes', 1, FORK_LIMITS.checkpointMaxBytes);
  if (value.contentType !== 'application/octet-stream') fail('invalid_content_type', '$.contentType must be application/octet-stream', '$.contentType');
  if (value.opaque !== true) fail('invalid_opaque_flag', '$.opaque must be true', '$.opaque');
  strictObject(value.encryption, new Set(['mode','keyReference']), undefined, '$.encryption');
  assertEnum(value.encryption.mode, ['client-managed','platform-opaque','none'], '$.encryption.mode');
  assertString(value.encryption.keyReference, '$.encryption.keyReference', 160);
  assertIso(value.createdAt, '$.createdAt');
  assertIso(value.expiresAt, '$.expiresAt');
  const duration = (Date.parse(value.expiresAt) - Date.parse(value.createdAt)) / 1000;
  if (duration < 1 || duration > FORK_LIMITS.activeRetentionSeconds) fail('invalid_retention', 'Checkpoint retention exceeds one day', '$.expiresAt');
  return clone(value);
}

export function validateExportManifest(value) {
  const keys = new Set(['schemaVersion','exportId','forkId','tenantId','checkpointId','sourceObjectKey','sourceSha256','createdAt','expiresAt']);
  strictObject(value, keys);
  if (value.schemaVersion !== 'fork-export-manifest-v1') fail('invalid_schema_version', '$.schemaVersion must be fork-export-manifest-v1', '$.schemaVersion');
  assertString(value.exportId, '$.exportId', 36, EXPORT_ID);
  assertForkId(value.forkId);
  assertAuditId(value.tenantId, 'tenant', '$.tenantId');
  assertCheckpointId(value.checkpointId);
  const expected = checkpointObjectKey(value.forkId, value.checkpointId);
  if (value.sourceObjectKey !== expected) fail('invalid_object_key', `$.sourceObjectKey must be ${expected}`, '$.sourceObjectKey');
  assertSha(value.sourceSha256, '$.sourceSha256');
  assertIso(value.createdAt, '$.createdAt');
  assertIso(value.expiresAt, '$.expiresAt');
  const duration = (Date.parse(value.expiresAt) - Date.parse(value.createdAt)) / 1000;
  if (duration < 1 || duration > FORK_LIMITS.exportedRetentionSeconds) fail('invalid_retention', 'Export retention exceeds seven days', '$.expiresAt');
  return clone(value);
}

export function validateForkQuotaCapability(value) {
  strictObject(value, new Set(Object.keys(FREE_DEVELOPMENT_FORK_CAPABILITY)));
  for (const [key, expected] of Object.entries(FREE_DEVELOPMENT_FORK_CAPABILITY)) {
    if (value[key] !== expected) fail('invalid_capability', `$.${key} must equal the free-development contract`, `$.${key}`);
  }
  return clone(value);
}

export function validateRestoreManifest(value) {
  const keys = new Set(['schemaVersion','restoreId','forkId','tenantId','attemptId','checkpointId','sourceObjectKey','sourceSha256','requestedAt']);
  strictObject(value, keys);
  if (value.schemaVersion !== 'fork-restore-manifest-v1') fail('invalid_schema_version', '$.schemaVersion must be fork-restore-manifest-v1', '$.schemaVersion');
  assertString(value.restoreId, '$.restoreId', 36, RESTORE_ID);
  assertForkId(value.forkId);
  assertAuditId(value.tenantId, 'tenant', '$.tenantId');
  assertAttemptId(value.attemptId);
  assertCheckpointId(value.checkpointId);
  const expected = checkpointObjectKey(value.forkId, value.checkpointId);
  if (value.sourceObjectKey !== expected) fail('invalid_object_key', `$.sourceObjectKey must be ${expected}`, '$.sourceObjectKey');
  assertSha(value.sourceSha256, '$.sourceSha256');
  assertIso(value.requestedAt, '$.requestedAt');
  return clone(value);
}

export function validateForkTombstone(value) {
  const keys = new Set(['schemaVersion','forkId','tenantId','attemptId','reason','deletedAt','requestDigest']);
  strictObject(value, keys);
  if (value.schemaVersion !== 'fork-tombstone-v1') fail('invalid_schema_version', '$.schemaVersion must be fork-tombstone-v1', '$.schemaVersion');
  assertForkId(value.forkId);
  assertAuditId(value.tenantId, 'tenant', '$.tenantId');
  assertAttemptId(value.attemptId);
  assertString(value.reason, '$.reason', 160, /^[A-Za-z0-9][A-Za-z0-9 ._:-]{0,159}$/);
  assertIso(value.deletedAt, '$.deletedAt');
  assertSha(value.requestDigest, '$.requestDigest');
  return clone(value);
}
