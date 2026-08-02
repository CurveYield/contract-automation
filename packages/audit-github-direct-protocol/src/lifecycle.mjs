import { DIRECT_MODE_ID,SCHEMAS,DIRECT_STATES } from './constants.mjs';
import {
  exactKeys,
  enumValue,
  integer,
  timestamp,
  identifier,
  fullName,
  sha256,
  frozenClone,
  fail,
  digest,
  commitSha
} from './boundary.mjs';
import { validateDirectRequest } from './request.mjs';

function directStateBody(input) {
  return {
    schemaVersion: input.schemaVersion,
    modeId: input.modeId,
    jobId: identifier(input.jobId, '$.jobId'),
    repositoryId: integer(input.repositoryId, '$.repositoryId', 1),
    installationId: integer(input.installationId, '$.installationId', 1),
    repositoryFullName: fullName(input.repositoryFullName, '$.repositoryFullName'),
    targetCommitSha: commitSha(input.targetCommitSha, '$.targetCommitSha'),
    state: enumValue(input.state, DIRECT_STATES, '$.state'),
    version: integer(input.version, '$.version', 0, 1_000_000),
    updatedAt: timestamp(input.updatedAt, '$.updatedAt')
  };
}

export function createDirectState(input) {
  const v = exactKeys(input, ['request','state','version','updatedAt'], '$');
  const r = validateDirectRequest(v.request);
  const body = directStateBody({
    schemaVersion: SCHEMAS.state,
    modeId: DIRECT_MODE_ID,
    jobId: r.jobId,
    repositoryId: r.repositoryId,
    installationId: r.installationId,
    repositoryFullName: r.repositoryFullName,
    targetCommitSha: r.targetCommitSha,
    state: v.state,
    version: v.version,
    updatedAt: v.updatedAt
  });
  const stateDigest = sha256(body);
  return frozenClone({ ...body, stateDigest });
}

export function validateDirectState(input) {
  const keys = [
    'schemaVersion','modeId','jobId','repositoryId','installationId','repositoryFullName',
    'targetCommitSha','state','version','updatedAt','stateDigest'
  ];
  const v = exactKeys(input, keys, '$');
  if (v.schemaVersion !== SCHEMAS.state) fail('invalid_schema', '$.schemaVersion');
  if (v.modeId !== DIRECT_MODE_ID) fail('invalid_mode', '$.modeId');
  const body = directStateBody(v);
  const stateDigest = digest(v.stateDigest, '$.stateDigest');
  if (stateDigest !== sha256(body)) fail('digest_mismatch', '$.stateDigest');
  return frozenClone({ ...body, stateDigest });
}

export function createDirectEvent(input) {
  const v = exactKeys(input, ['request','from','to','version','reasonCode','at'], '$');
  const r = validateDirectRequest(v.request);
  const body = {
    schemaVersion: SCHEMAS.event,
    modeId: DIRECT_MODE_ID,
    jobId: r.jobId,
    targetCommitSha: r.targetCommitSha,
    from: enumValue(v.from, DIRECT_STATES, '$.from'),
    to: enumValue(v.to, DIRECT_STATES, '$.to'),
    version: integer(v.version, '$.version', 1, 1_000_000),
    reasonCode: identifier(v.reasonCode, '$.reasonCode'),
    at: timestamp(v.at, '$.at')
  };
  const eventDigest = sha256(body);
  return frozenClone({ ...body, eventId: `direct-event-${eventDigest.slice(7,31)}`, eventDigest });
}

export function validateDirectEvent(input) {
  const v = exactKeys(input, [
    'schemaVersion','modeId','jobId','targetCommitSha','from','to','version',
    'reasonCode','at','eventId','eventDigest'
  ], '$');
  if (v.schemaVersion !== SCHEMAS.event) fail('invalid_schema', '$.schemaVersion');
  if (v.modeId !== DIRECT_MODE_ID) fail('invalid_mode', '$.modeId');
  const body = {
    schemaVersion: v.schemaVersion,
    modeId: v.modeId,
    jobId: identifier(v.jobId, '$.jobId'),
    targetCommitSha: commitSha(v.targetCommitSha, '$.targetCommitSha'),
    from: enumValue(v.from, DIRECT_STATES, '$.from'),
    to: enumValue(v.to, DIRECT_STATES, '$.to'),
    version: integer(v.version, '$.version', 1, 1_000_000),
    reasonCode: identifier(v.reasonCode, '$.reasonCode'),
    at: timestamp(v.at, '$.at')
  };
  const eventDigest = digest(v.eventDigest, '$.eventDigest');
  const expected = sha256(body);
  if (eventDigest !== expected) fail('digest_mismatch', '$.eventDigest');
  const eventId = identifier(v.eventId, '$.eventId');
  if (eventId !== `direct-event-${expected.slice(7,31)}`) fail('identity_mismatch', '$.eventId');
  return frozenClone({ ...body, eventId, eventDigest });
}
