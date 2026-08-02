import {
  exactKeys, sha256, digest, identifier, frozenClone, fail
} from '../../audit-github-direct-protocol/src/index.mjs';
import {
  createServiceResult as createServiceResultV1,
  validateServiceResult as validateServiceResultV1
} from './contracts.mjs';

export function createServiceResult(input) {
  const legacy = createServiceResultV1(input);
  const body = {
    ...legacy,
    schemaVersion: 'github-direct-service-result-v2'
  };
  const resultDigest = sha256(body);
  return frozenClone({
    ...body,
    resultId: `direct-service-result-${resultDigest.slice(7, 31)}`,
    resultDigest
  });
}

export function validateServiceResult(input) {
  const v = exactKeys(input, [
    'schemaVersion','modeId','commandKind','jobId','targetCommitSha','state','data',
    'completedAt','cloudflareFallback','resultId','resultDigest'
  ], '$');
  if (v.schemaVersion !== 'github-direct-service-result-v2') {
    fail('invalid_schema', '$.schemaVersion');
  }
  const legacy = validateServiceResultV1({
    schemaVersion: 'github-direct-service-result-v1',
    modeId: v.modeId,
    commandKind: v.commandKind,
    jobId: v.jobId,
    targetCommitSha: v.targetCommitSha,
    state: v.state,
    data: v.data,
    completedAt: v.completedAt,
    cloudflareFallback: v.cloudflareFallback
  });
  const body = { ...legacy, schemaVersion: v.schemaVersion };
  const expected = sha256(body);
  const resultDigest = digest(v.resultDigest, '$.resultDigest');
  if (resultDigest !== expected) fail('digest_mismatch', '$.resultDigest');
  const resultId = identifier(v.resultId, '$.resultId');
  if (resultId !== `direct-service-result-${expected.slice(7, 31)}`) {
    fail('identity_mismatch', '$.resultId');
  }
  return frozenClone({ ...body, resultId, resultDigest });
}
