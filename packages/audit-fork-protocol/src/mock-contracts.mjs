import { assertCheckpointId, assertEnum, assertForkId, assertInteger, assertLimit, assertPlainObject, assertSha, assertString, clone, fail, strictObject } from './internals.mjs';
import { validateForkActionRequest } from './fork-contracts.mjs';

export function validateMockAdapterRequest(value) {
  const allowed = new Set(['schemaVersion','operation','forkId','chainId','blockNumber','timestamp','seed','mode','action','checkpointId']);
  const required = new Set(['schemaVersion','operation','forkId','chainId','blockNumber','timestamp','seed','mode']);
  strictObject(value, allowed, required);
  if (value.schemaVersion !== 'fork-mock-request-v1') fail('invalid_schema_version', '$.schemaVersion must be fork-mock-request-v1', '$.schemaVersion');
  assertEnum(value.operation, ['create','action','checkpoint','restore','cancel'], '$.operation');
  assertForkId(value.forkId);
  assertInteger(value.chainId, '$.chainId', 1, 4_294_967_295);
  assertInteger(value.blockNumber, '$.blockNumber', 0);
  assertInteger(value.timestamp, '$.timestamp', 0);
  assertString(value.seed, '$.seed', 80, /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/);
  assertEnum(value.mode, ['success','fail','cancel'], '$.mode');
  if (value.operation === 'action') validateForkActionRequest(value.action);
  if (['checkpoint','restore'].includes(value.operation)) assertCheckpointId(value.checkpointId);
  return clone(value);
}

export function validateMockAdapterResult(value) {
  const allowed = new Set(['schemaVersion','operation','forkId','status','chainId','blockNumber','timestamp','deterministicDigest','checkpointId','sha256','bytes','artifactHex','result']);
  const required = new Set(['schemaVersion','operation','forkId','status','chainId','blockNumber','timestamp','deterministicDigest','result']);
  strictObject(value, allowed, required);
  if (value.schemaVersion !== 'fork-mock-result-v1') fail('invalid_schema_version', '$.schemaVersion must be fork-mock-result-v1', '$.schemaVersion');
  assertEnum(value.operation, ['create','action','checkpoint','restore','cancel'], '$.operation');
  assertForkId(value.forkId);
  assertEnum(value.status, ['ready','succeeded','failed','cancelled'], '$.status');
  assertInteger(value.chainId, '$.chainId', 1, 4_294_967_295);
  assertInteger(value.blockNumber, '$.blockNumber', 0);
  assertInteger(value.timestamp, '$.timestamp', 0);
  assertSha(value.deterministicDigest, '$.deterministicDigest');
  assertPlainObject(value.result, '$.result');
  if ('checkpointId' in value) assertCheckpointId(value.checkpointId);
  if ('sha256' in value) assertSha(value.sha256, '$.sha256');
  if ('bytes' in value) assertLimit(value.bytes, '$.bytes', 0, 1_000_000);
  if ('artifactHex' in value) assertString(value.artifactHex, '$.artifactHex', 2_000_002, /^0x(?:[0-9a-f]{2})*$/);
  return clone(value);
}
