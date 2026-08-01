import test from 'node:test';
import assert from 'node:assert/strict';

import { createDirectRequest } from '../packages/audit-github-direct-protocol/src/request.mjs';
import { createDirectState, validateDirectState } from '../packages/audit-github-direct-protocol/src/lifecycle.mjs';
import {
  createCapabilityManifest,
  validateCapabilityManifest,
  createResultManifest,
  validateResultManifest,
  createReportIndex,
  validateReportIndex
} from '../packages/audit-github-direct-protocol/src/publication.mjs';
import { sha256 } from '../packages/audit-github-direct-protocol/src/boundary.mjs';
import { DirectValidationError } from '../packages/audit-github-direct-protocol/src/errors.mjs';

const request = createDirectRequest({
  repositoryId: 123,
  installationId: 456,
  repositoryFullName: 'curveyield/contract-automation',
  requesterId: 'alice',
  policyVersion: 'policy-v1',
  profileId: 'slither-v1',
  parserVersion: 'parser-v1',
  resultContractVersion: 'result-v1',
  reportContractVersion: 'report-v1',
  targetCommitSha: 'a'.repeat(40),
  requestedAt: '2026-08-01T00:00:00.000Z',
  idempotencyKey: 'request-1'
});

function expectValidationError(fn, code) {
  assert.throws(fn, (error) => {
    assert.equal(error instanceof DirectValidationError, true);
    if (code) assert.equal(error.code, code);
    return true;
  });
}

test('state validator rejects a self-hashed invalid repository full name', () => {
  const valid = createDirectState({
    request,
    state: 'requested',
    version: 0,
    updatedAt: '2026-08-01T00:00:00.000Z'
  });
  const invalid = { ...valid, repositoryFullName: 'NOT A REPOSITORY' };
  invalid.stateDigest = sha256({
    schemaVersion: invalid.schemaVersion,
    modeId: invalid.modeId,
    jobId: invalid.jobId,
    repositoryId: invalid.repositoryId,
    installationId: invalid.installationId,
    repositoryFullName: invalid.repositoryFullName,
    targetCommitSha: invalid.targetCommitSha,
    state: invalid.state,
    version: invalid.version,
    updatedAt: invalid.updatedAt
  });
  expectValidationError(() => validateDirectState(invalid), 'invalid_repository_name');
});

test('capability validator rejects a self-hashed invalid auth kind', () => {
  const valid = createCapabilityManifest({
    request,
    authorizationKind: 'github-token',
    capabilities: ['read-source'],
    issuedAt: '2026-08-01T00:00:00.000Z',
    expiresAt: '2026-08-01T00:10:00.000Z'
  });
  const invalid = { ...valid, authKind: 'administrator-token' };
  const body = {
    schemaVersion: invalid.schemaVersion,
    modeId: invalid.modeId,
    jobId: invalid.jobId,
    repositoryId: invalid.repositoryId,
    installationId: invalid.installationId,
    repositoryFullName: invalid.repositoryFullName,
    targetCommitSha: invalid.targetCommitSha,
    authKind: invalid.authKind,
    capabilities: invalid.capabilities,
    issuedAt: invalid.issuedAt,
    expiresAt: invalid.expiresAt
  };
  invalid.capabilityDigest = sha256(body);
  invalid.capabilityId = `direct-capability-${invalid.capabilityDigest.slice(7,31)}`;
  expectValidationError(() => validateCapabilityManifest(invalid), 'invalid_enum');
});

test('result validator rejects a self-hashed impossible execution truth combination', () => {
  const valid = createResultManifest({
    request,
    outcome: 'execution_unavailable',
    executionState: 'execution_plane_unavailable',
    resultDigest: null,
    summary: { findingCount: 0, evidenceCount: 0, artifactCount: 0, truncated: false },
    producedAt: '2026-08-01T00:00:01.000Z'
  });
  const invalid = { ...valid, outcome: 'success' };
  const body = {
    schemaVersion: invalid.schemaVersion,
    modeId: invalid.modeId,
    jobId: invalid.jobId,
    targetCommitSha: invalid.targetCommitSha,
    profileId: invalid.profileId,
    parserVersion: invalid.parserVersion,
    resultContractVersion: invalid.resultContractVersion,
    outcome: invalid.outcome,
    executionState: invalid.executionState,
    resultDigest: invalid.resultDigest,
    summary: invalid.summary,
    producedAt: invalid.producedAt
  };
  invalid.manifestDigest = sha256(body);
  invalid.manifestId = `direct-result-${invalid.manifestDigest.slice(7,31)}`;
  expectValidationError(() => validateResultManifest(invalid), 'execution_truth_mismatch');
});

test('report validator rejects a self-hashed invalid entry kind', () => {
  const valid = createReportIndex({
    request,
    entries: [{
      reportId: 'report-1',
      reportDigest: `sha256:${'b'.repeat(64)}`,
      kind: 'machine-json'
    }],
    publishedAt: '2026-08-01T00:00:02.000Z'
  });
  const invalid = {
    ...valid,
    entries: [{ ...valid.entries[0], kind: 'arbitrary' }]
  };
  const body = {
    schemaVersion: invalid.schemaVersion,
    modeId: invalid.modeId,
    jobId: invalid.jobId,
    targetCommitSha: invalid.targetCommitSha,
    reportContractVersion: invalid.reportContractVersion,
    entries: invalid.entries,
    publishedAt: invalid.publishedAt
  };
  invalid.indexDigest = sha256(body);
  invalid.indexId = `direct-report-index-${invalid.indexDigest.slice(7,31)}`;
  expectValidationError(() => validateReportIndex(invalid), 'invalid_enum');
});

test('report validator rejects an own iterator without invoking it', () => {
  const valid = createReportIndex({
    request,
    entries: [{
      reportId: 'report-1',
      reportDigest: `sha256:${'b'.repeat(64)}`,
      kind: 'machine-json'
    }],
    publishedAt: '2026-08-01T00:00:02.000Z'
  });
  let invoked = 0;
  const hostile = [...valid.entries];
  Object.defineProperty(hostile, Symbol.iterator, {
    value() {
      invoked += 1;
      throw new Error('iterator body executed');
    }
  });
  const invalid = { ...valid, entries: hostile };
  expectValidationError(() => validateReportIndex(invalid), 'symbol_field');
  assert.equal(invoked, 0);
});

function rehashCapability(value) {
  const body = {
    schemaVersion: value.schemaVersion,
    modeId: value.modeId,
    jobId: value.jobId,
    repositoryId: value.repositoryId,
    installationId: value.installationId,
    repositoryFullName: value.repositoryFullName,
    targetCommitSha: value.targetCommitSha,
    authKind: value.authKind,
    capabilities: value.capabilities,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt
  };
  value.capabilityDigest = sha256(body);
  value.capabilityId = `direct-capability-${value.capabilityDigest.slice(7,31)}`;
  return value;
}

function rehashResult(value) {
  const body = {
    schemaVersion: value.schemaVersion,
    modeId: value.modeId,
    jobId: value.jobId,
    targetCommitSha: value.targetCommitSha,
    profileId: value.profileId,
    parserVersion: value.parserVersion,
    resultContractVersion: value.resultContractVersion,
    outcome: value.outcome,
    executionState: value.executionState,
    resultDigest: value.resultDigest,
    summary: value.summary,
    producedAt: value.producedAt
  };
  value.manifestDigest = sha256(body);
  value.manifestId = `direct-result-${value.manifestDigest.slice(7,31)}`;
  return value;
}

function rehashReport(value) {
  const body = {
    schemaVersion: value.schemaVersion,
    modeId: value.modeId,
    jobId: value.jobId,
    targetCommitSha: value.targetCommitSha,
    reportContractVersion: value.reportContractVersion,
    entries: value.entries,
    publishedAt: value.publishedAt
  };
  value.indexDigest = sha256(body);
  value.indexId = `direct-report-index-${value.indexDigest.slice(7,31)}`;
  return value;
}

test('capability validator rejects self-hashed invalid mode and expiry', () => {
  const valid = createCapabilityManifest({
    request,
    authorizationKind: 'github-token',
    capabilities: ['read-source'],
    issuedAt: '2026-08-01T00:00:00.000Z',
    expiresAt: '2026-08-01T00:10:00.000Z'
  });
  expectValidationError(
    () => validateCapabilityManifest(rehashCapability({ ...valid, modeId: 'cloudflare-audit-v1' })),
    'invalid_mode'
  );
  expectValidationError(
    () => validateCapabilityManifest(rehashCapability({ ...valid, expiresAt: valid.issuedAt })),
    'invalid_expiry'
  );
});

test('capability validator rejects self-hashed invalid capability values', () => {
  const valid = createCapabilityManifest({
    request,
    authorizationKind: 'github-token',
    capabilities: ['read-source'],
    issuedAt: '2026-08-01T00:00:00.000Z',
    expiresAt: '2026-08-01T00:10:00.000Z'
  });
  expectValidationError(
    () => validateCapabilityManifest(rehashCapability({ ...valid, capabilities: ['repository-admin'] })),
    'invalid_enum'
  );
});

test('result validator rejects self-hashed malformed summary and target SHA', () => {
  const valid = createResultManifest({
    request,
    outcome: 'execution_unavailable',
    executionState: 'execution_plane_unavailable',
    resultDigest: null,
    summary: { findingCount: 0, evidenceCount: 0, artifactCount: 0, truncated: false },
    producedAt: '2026-08-01T00:00:01.000Z'
  });
  expectValidationError(
    () => validateResultManifest(rehashResult({
      ...valid,
      summary: { ...valid.summary, findingCount: -1 }
    })),
    'invalid_integer'
  );
  expectValidationError(
    () => validateResultManifest(rehashResult({
      ...valid,
      targetCommitSha: 'A'.repeat(40)
    })),
    'invalid_commit_sha'
  );
});

test('report validator rejects self-hashed invalid mode and report version', () => {
  const valid = createReportIndex({
    request,
    entries: [{
      reportId: 'report-1',
      reportDigest: `sha256:${'b'.repeat(64)}`,
      kind: 'machine-json'
    }],
    publishedAt: '2026-08-01T00:00:02.000Z'
  });
  expectValidationError(
    () => validateReportIndex(rehashReport({ ...valid, modeId: 'cloudflare-audit-v1' })),
    'invalid_mode'
  );
  expectValidationError(
    () => validateReportIndex(rehashReport({ ...valid, reportContractVersion: 'not-versioned' })),
    'invalid_version'
  );
});

test('report validator rejects sparse arrays with a bounded validation error', () => {
  const valid = createReportIndex({
    request,
    entries: [{
      reportId: 'report-1',
      reportDigest: `sha256:${'b'.repeat(64)}`,
      kind: 'machine-json'
    }],
    publishedAt: '2026-08-01T00:00:02.000Z'
  });
  const sparse = new Array(1);
  expectValidationError(() => validateReportIndex({ ...valid, entries: sparse }), 'sparse_array');
});

test('report validator rejects accessor-backed entry fields without invoking them', () => {
  const valid = createReportIndex({
    request,
    entries: [{
      reportId: 'report-1',
      reportDigest: `sha256:${'b'.repeat(64)}`,
      kind: 'machine-json'
    }],
    publishedAt: '2026-08-01T00:00:02.000Z'
  });
  let invoked = 0;
  const entry = {
    get reportId() {
      invoked += 1;
      return 'report-1';
    },
    reportDigest: `sha256:${'b'.repeat(64)}`,
    kind: 'machine-json'
  };
  expectValidationError(() => validateReportIndex({ ...valid, entries: [entry] }), 'accessor_field');
  assert.equal(invoked, 0);
});
