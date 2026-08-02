import {
  DIRECT_MODE_ID,
  exactKeys,
  validateDirectRequest,
  validateCapabilityManifest,
  commitSha,
  timestamp,
  nullable,
  identifier,
  digest,
  integer,
  booleanValue,
  enumValue,
  sha256,
  frozenClone,
  fail,
  fullName,
  versionSlug
} from '../../audit-github-direct-protocol/src/index.mjs';
import { matchRepositoryFixture } from './fixtures.mjs';

const REQUIRED_CAPABILITIES = ['publish-check', 'publish-status', 'read-source', 'write-control-ledger'];
const SUMMARY_KEYS = ['findingCount', 'evidenceCount', 'artifactCount', 'truncated'];
const EMPTY_SUMMARY = Object.freeze({
  findingCount: 0,
  evidenceCount: 0,
  artifactCount: 0,
  truncated: false
});

function validateSummary(value, path = '$.summary') {
  const v = exactKeys(value, SUMMARY_KEYS, path);
  if (typeof v.truncated !== 'boolean') fail('invalid_boolean', `${path}.truncated`);
  return {
    findingCount: integer(v.findingCount, `${path}.findingCount`, 0, 1_000_000),
    evidenceCount: integer(v.evidenceCount, `${path}.evidenceCount`, 0, 1_000_000),
    artifactCount: integer(v.artifactCount, `${path}.artifactCount`, 0, 100_000),
    truncated: v.truncated
  };
}

function isEmptySummary(summary) {
  return SUMMARY_KEYS.every((key) => summary[key] === EMPTY_SUMMARY[key]);
}

function capabilityMatches(capability, request) {
  return capability.jobId === request.jobId &&
    capability.repositoryId === request.repositoryId &&
    capability.installationId === request.installationId &&
    capability.repositoryFullName === request.repositoryFullName &&
    capability.targetCommitSha === request.targetCommitSha;
}

function validateAdmissionTruth({ fixtureId, admissionState, reason, modeledResultDigest, summary }) {
  const fixture = fixtureId !== null;
  if (fixture) {
    if (
      admissionState !== 'fixture_modeled' ||
      reason !== 'fixture_allowlisted' ||
      modeledResultDigest === null
    ) {
      fail('admission_contradiction', '$.fixtureId');
    }
  } else if (
    admissionState !== 'awaiting_executor' ||
    reason !== 'execution_plane_unavailable' ||
    modeledResultDigest !== null ||
    !isEmptySummary(summary)
  ) {
    fail('admission_contradiction', '$.fixtureId');
  }
}

export function admitDirectJob(input) {
  const v = exactKeys(input, ['request', 'capabilityManifest', 'sourceCommitSha', 'admittedAt'], '$');
  const request = validateDirectRequest(v.request);
  const capability = validateCapabilityManifest(v.capabilityManifest);
  const sourceCommitSha = commitSha(v.sourceCommitSha, '$.sourceCommitSha');
  const admittedAt = timestamp(v.admittedAt, '$.admittedAt');
  if (sourceCommitSha !== request.targetCommitSha) fail('source_sha_mismatch', '$.sourceCommitSha');
  if (!capabilityMatches(capability, request)) fail('capability_request_mismatch', '$.capabilityManifest');
  for (const required of REQUIRED_CAPABILITIES) {
    if (!capability.capabilities.includes(required)) {
      fail('capability_missing', '$.capabilityManifest.capabilities');
    }
  }
  const fixture = matchRepositoryFixture(request);
  const core = {
    schemaVersion: 'github-direct-runner-admission-v1',
    modeId: DIRECT_MODE_ID,
    jobId: request.jobId,
    repositoryId: request.repositoryId,
    installationId: request.installationId,
    repositoryFullName: request.repositoryFullName,
    targetCommitSha: request.targetCommitSha,
    sourceCommitSha,
    policyVersion: request.policyVersion,
    profileId: request.profileId,
    parserVersion: request.parserVersion,
    resultContractVersion: request.resultContractVersion,
    capabilityId: capability.capabilityId,
    fixtureId: fixture?.fixtureId ?? null,
    admissionState: fixture ? 'fixture_modeled' : 'awaiting_executor',
    reason: fixture ? 'fixture_allowlisted' : 'execution_plane_unavailable',
    executionEnabled: false,
    modeledResultDigest: fixture?.modeledResultDigest ?? null,
    summary: fixture?.summary ?? EMPTY_SUMMARY,
    admittedAt
  };
  const admissionDigest = sha256(core);
  return frozenClone({
    ...core,
    admissionId: `direct-admission-${admissionDigest.slice(7, 31)}`,
    admissionDigest
  });
}

export function validateRunnerAdmission(input) {
  const keys = [
    'schemaVersion', 'modeId', 'jobId', 'repositoryId', 'installationId',
    'repositoryFullName', 'targetCommitSha', 'sourceCommitSha', 'policyVersion',
    'profileId', 'parserVersion', 'resultContractVersion', 'capabilityId', 'fixtureId',
    'admissionState', 'reason', 'executionEnabled', 'modeledResultDigest', 'summary',
    'admittedAt', 'admissionId', 'admissionDigest'
  ];
  const v = exactKeys(input, keys, '$');
  if (v.schemaVersion !== 'github-direct-runner-admission-v1') fail('invalid_schema', '$.schemaVersion');
  if (v.modeId !== DIRECT_MODE_ID) fail('invalid_mode', '$.modeId');
  const core = {
    schemaVersion: v.schemaVersion,
    modeId: v.modeId,
    jobId: identifier(v.jobId, '$.jobId'),
    repositoryId: integer(v.repositoryId, '$.repositoryId', 1),
    installationId: integer(v.installationId, '$.installationId', 1),
    repositoryFullName: fullName(v.repositoryFullName, '$.repositoryFullName'),
    targetCommitSha: commitSha(v.targetCommitSha, '$.targetCommitSha'),
    sourceCommitSha: commitSha(v.sourceCommitSha, '$.sourceCommitSha'),
    policyVersion: versionSlug(v.policyVersion, '$.policyVersion'),
    profileId: versionSlug(v.profileId, '$.profileId'),
    parserVersion: versionSlug(v.parserVersion, '$.parserVersion'),
    resultContractVersion: versionSlug(v.resultContractVersion, '$.resultContractVersion'),
    capabilityId: identifier(v.capabilityId, '$.capabilityId'),
    fixtureId: nullable(v.fixtureId, identifier, '$.fixtureId'),
    admissionState: enumValue(v.admissionState, ['fixture_modeled', 'awaiting_executor'], '$.admissionState'),
    reason: enumValue(v.reason, ['fixture_allowlisted', 'execution_plane_unavailable'], '$.reason'),
    executionEnabled: booleanValue(v.executionEnabled, '$.executionEnabled'),
    modeledResultDigest: nullable(v.modeledResultDigest, digest, '$.modeledResultDigest'),
    summary: validateSummary(v.summary),
    admittedAt: timestamp(v.admittedAt, '$.admittedAt')
  };
  if (core.executionEnabled !== false) fail('execution_boundary_violation', '$.executionEnabled');
  if (core.sourceCommitSha !== core.targetCommitSha) fail('source_sha_mismatch', '$.sourceCommitSha');
  validateAdmissionTruth(core);

  const admissionDigest = digest(v.admissionDigest, '$.admissionDigest');
  const expected = sha256(core);
  if (admissionDigest !== expected) fail('digest_mismatch', '$.admissionDigest');
  const admissionId = identifier(v.admissionId, '$.admissionId');
  if (admissionId !== `direct-admission-${expected.slice(7, 31)}`) {
    fail('identity_mismatch', '$.admissionId');
  }
  return frozenClone({ ...core, admissionId, admissionDigest });
}
