import { DIRECT_MODE_ID,SCHEMAS,CAPABILITIES,OUTCOMES,EXECUTION_STATES } from './constants.mjs';
import {
  exactKeys,
  enumValue,
  stringArray,
  timestamp,
  sha256,
  frozenClone,
  fail,
  digest,
  nullable,
  integer,
  booleanValue,
  identifier,
  fullName,
  commitSha,
  versionSlug,
  denseArray
} from './boundary.mjs';
import { validateDirectRequest } from './request.mjs';

const AUTH_KINDS = Object.freeze(['github-token','app-installation-token']);
const REPORT_KINDS = Object.freeze(['human-markdown','machine-json','sarif']);

function capabilityBody(value) {
  const capabilities = stringArray(value.capabilities, '$.capabilities', {
    maximum: CAPABILITIES.length,
    item: (entry, path) => enumValue(entry, CAPABILITIES, path)
  });
  if (JSON.stringify(capabilities) !== JSON.stringify(value.capabilities)) {
    fail('noncanonical_order', '$.capabilities');
  }
  const body = {
    schemaVersion: value.schemaVersion,
    modeId: value.modeId,
    jobId: identifier(value.jobId, '$.jobId'),
    repositoryId: integer(value.repositoryId, '$.repositoryId', 1),
    installationId: integer(value.installationId, '$.installationId', 1),
    repositoryFullName: fullName(value.repositoryFullName, '$.repositoryFullName'),
    targetCommitSha: commitSha(value.targetCommitSha, '$.targetCommitSha'),
    authKind: enumValue(value.authKind, AUTH_KINDS, '$.authKind'),
    capabilities,
    issuedAt: timestamp(value.issuedAt, '$.issuedAt'),
    expiresAt: timestamp(value.expiresAt, '$.expiresAt')
  };
  if (body.expiresAt <= body.issuedAt) fail('invalid_expiry', '$.expiresAt');
  return body;
}

export function createCapabilityManifest(input) {
  const v = exactKeys(input, ['request','authorizationKind','capabilities','issuedAt','expiresAt'], '$');
  const r = validateDirectRequest(v.request);
  const body = capabilityBody({
    schemaVersion: SCHEMAS.capability,
    modeId: DIRECT_MODE_ID,
    jobId: r.jobId,
    repositoryId: r.repositoryId,
    installationId: r.installationId,
    repositoryFullName: r.repositoryFullName,
    targetCommitSha: r.targetCommitSha,
    authKind: v.authorizationKind,
    capabilities: [...v.capabilities].sort(),
    issuedAt: v.issuedAt,
    expiresAt: v.expiresAt
  });
  const capabilityDigest = sha256(body);
  return frozenClone({
    ...body,
    capabilityId: `direct-capability-${capabilityDigest.slice(7,31)}`,
    capabilityDigest
  });
}

export function validateCapabilityManifest(input) {
  const keys = [
    'schemaVersion','modeId','jobId','repositoryId','installationId','repositoryFullName',
    'targetCommitSha','authKind','capabilities','issuedAt','expiresAt','capabilityId','capabilityDigest'
  ];
  const v = exactKeys(input, keys, '$');
  if (v.schemaVersion !== SCHEMAS.capability) fail('invalid_schema', '$.schemaVersion');
  if (v.modeId !== DIRECT_MODE_ID) fail('invalid_mode', '$.modeId');
  const body = capabilityBody(v);
  const capabilityDigest = digest(v.capabilityDigest, '$.capabilityDigest');
  const expected = sha256(body);
  if (capabilityDigest !== expected) fail('digest_mismatch', '$.capabilityDigest');
  const capabilityId = identifier(v.capabilityId, '$.capabilityId');
  if (capabilityId !== `direct-capability-${expected.slice(7,31)}`) {
    fail('identity_mismatch', '$.capabilityId');
  }
  return frozenClone({ ...body, capabilityId, capabilityDigest });
}

function summary(value) {
  const v = exactKeys(value, ['findingCount','evidenceCount','artifactCount','truncated'], '$.summary');
  return {
    findingCount: integer(v.findingCount, '$.summary.findingCount', 0, 1_000_000),
    evidenceCount: integer(v.evidenceCount, '$.summary.evidenceCount', 0, 1_000_000),
    artifactCount: integer(v.artifactCount, '$.summary.artifactCount', 0, 100_000),
    truncated: booleanValue(v.truncated, '$.summary.truncated')
  };
}

function resultBody(value) {
  const outcome = enumValue(value.outcome, OUTCOMES, '$.outcome');
  const executionState = enumValue(value.executionState, EXECUTION_STATES, '$.executionState');
  const resultDigest = nullable(value.resultDigest, digest, '$.resultDigest');
  if (
    executionState === 'execution_plane_unavailable' &&
    (outcome !== 'execution_unavailable' || resultDigest !== null)
  ) {
    fail('execution_truth_mismatch', '$.executionState');
  }
  if (executionState === 'fixture_modeled' && outcome !== 'modeled_fixture') {
    fail('execution_truth_mismatch', '$.outcome');
  }
  return {
    schemaVersion: value.schemaVersion,
    modeId: value.modeId,
    jobId: identifier(value.jobId, '$.jobId'),
    targetCommitSha: commitSha(value.targetCommitSha, '$.targetCommitSha'),
    profileId: versionSlug(value.profileId, '$.profileId'),
    parserVersion: versionSlug(value.parserVersion, '$.parserVersion'),
    resultContractVersion: versionSlug(value.resultContractVersion, '$.resultContractVersion'),
    outcome,
    executionState,
    resultDigest,
    summary: summary(value.summary),
    producedAt: timestamp(value.producedAt, '$.producedAt')
  };
}

export function createResultManifest(input) {
  const v = exactKeys(input, ['request','outcome','executionState','resultDigest','summary','producedAt'], '$');
  const r = validateDirectRequest(v.request);
  const body = resultBody({
    schemaVersion: SCHEMAS.result,
    modeId: DIRECT_MODE_ID,
    jobId: r.jobId,
    targetCommitSha: r.targetCommitSha,
    profileId: r.profileId,
    parserVersion: r.parserVersion,
    resultContractVersion: r.resultContractVersion,
    outcome: v.outcome,
    executionState: v.executionState,
    resultDigest: v.resultDigest,
    summary: v.summary,
    producedAt: v.producedAt
  });
  const manifestDigest = sha256(body);
  return frozenClone({ ...body, manifestId: `direct-result-${manifestDigest.slice(7,31)}`, manifestDigest });
}

export function validateResultManifest(input) {
  const keys = [
    'schemaVersion','modeId','jobId','targetCommitSha','profileId','parserVersion',
    'resultContractVersion','outcome','executionState','resultDigest','summary','producedAt',
    'manifestId','manifestDigest'
  ];
  const v = exactKeys(input, keys, '$');
  if (v.schemaVersion !== SCHEMAS.result) fail('invalid_schema', '$.schemaVersion');
  if (v.modeId !== DIRECT_MODE_ID) fail('invalid_mode', '$.modeId');
  const body = resultBody(v);
  const manifestDigest = digest(v.manifestDigest, '$.manifestDigest');
  const expected = sha256(body);
  if (manifestDigest !== expected) fail('digest_mismatch', '$.manifestDigest');
  const manifestId = identifier(v.manifestId, '$.manifestId');
  if (manifestId !== `direct-result-${expected.slice(7,31)}`) {
    fail('identity_mismatch', '$.manifestId');
  }
  return frozenClone({ ...body, manifestId, manifestDigest });
}

function reportEntries(value) {
  return denseArray(value, '$.entries', 1_000).map((entry, index) => {
    const path = `$.entries[${index}]`;
    const v = exactKeys(entry, ['reportId','reportDigest','kind'], path);
    return {
      reportId: identifier(v.reportId, `${path}.reportId`),
      reportDigest: digest(v.reportDigest, `${path}.reportDigest`),
      kind: enumValue(v.kind, REPORT_KINDS, `${path}.kind`)
    };
  });
}

function ensureUniqueEntries(entries) {
  if (new Set(entries.map((entry) => entry.reportId)).size !== entries.length) {
    fail('duplicate_identity', '$.entries');
  }
}

export function createReportIndex(input) {
  const v = exactKeys(input, ['request','entries','publishedAt'], '$');
  const r = validateDirectRequest(v.request);
  const entries = reportEntries(v.entries).sort((a, b) => a.reportId.localeCompare(b.reportId));
  ensureUniqueEntries(entries);
  const body = {
    schemaVersion: SCHEMAS.report,
    modeId: DIRECT_MODE_ID,
    jobId: r.jobId,
    targetCommitSha: r.targetCommitSha,
    reportContractVersion: r.reportContractVersion,
    entries,
    publishedAt: timestamp(v.publishedAt, '$.publishedAt')
  };
  const indexDigest = sha256(body);
  return frozenClone({ ...body, indexId: `direct-report-index-${indexDigest.slice(7,31)}`, indexDigest });
}

export function validateReportIndex(input) {
  const keys = [
    'schemaVersion','modeId','jobId','targetCommitSha','reportContractVersion',
    'entries','publishedAt','indexId','indexDigest'
  ];
  const v = exactKeys(input, keys, '$');
  if (v.schemaVersion !== SCHEMAS.report) fail('invalid_schema', '$.schemaVersion');
  if (v.modeId !== DIRECT_MODE_ID) fail('invalid_mode', '$.modeId');
  const entries = reportEntries(v.entries);
  ensureUniqueEntries(entries);
  const sorted = [...entries].sort((a, b) => a.reportId.localeCompare(b.reportId));
  if (JSON.stringify(sorted) !== JSON.stringify(entries)) fail('noncanonical_order', '$.entries');
  const body = {
    schemaVersion: v.schemaVersion,
    modeId: v.modeId,
    jobId: identifier(v.jobId, '$.jobId'),
    targetCommitSha: commitSha(v.targetCommitSha, '$.targetCommitSha'),
    reportContractVersion: versionSlug(v.reportContractVersion, '$.reportContractVersion'),
    entries,
    publishedAt: timestamp(v.publishedAt, '$.publishedAt')
  };
  const indexDigest = digest(v.indexDigest, '$.indexDigest');
  const expected = sha256(body);
  if (indexDigest !== expected) fail('digest_mismatch', '$.indexDigest');
  const indexId = identifier(v.indexId, '$.indexId');
  if (indexId !== `direct-report-index-${expected.slice(7,31)}`) {
    fail('identity_mismatch', '$.indexId');
  }
  return frozenClone({ ...body, indexId, indexDigest });
}
