import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDirectRequest,
  createCapabilityManifest,
  createResultManifest,
  sha256,
  DirectValidationError
} from '../packages/audit-github-direct-protocol/src/index.mjs';
import { planImmutableCreate } from '../packages/audit-github-direct-ledger/src/index.mjs';
import {
  createInjectedGitHubAdapter,
  planCheckPublication,
  validatePublicationPlan
} from '../packages/audit-github-direct-adapter/src/index.mjs';
import {
  DIRECT_FIXTURE_ALLOWLIST,
  admitDirectJob,
  validateRunnerAdmission,
  orchestrateDirectJob,
  validateRunnerOutcome,
  planRunnerPublication,
  validateRunnerPublicationPlan
} from '../packages/audit-github-direct-runner/src/index.mjs';

const ts = '2026-08-01T18:00:00.000Z';
const later = '2026-08-01T18:05:00.000Z';
const sha = 'a'.repeat(40);
const blob = 'b'.repeat(40);
const digest = (character) => `sha256:${character.repeat(64)}`;

function requestFor(targetCommitSha = sha, overrides = {}) {
  return createDirectRequest({
    repositoryId: 123,
    installationId: 456,
    repositoryFullName: 'curveyield/contract-automation',
    requesterId: 'user-1',
    policyVersion: 'direct-policy-v1',
    profileId: 'hardhat-test-v1',
    parserVersion: 'hardhat-test-parser-v1',
    resultContractVersion: 'phase5-tool-result-v1',
    reportContractVersion: 'audit-report-v1',
    targetCommitSha,
    requestedAt: ts,
    idempotencyKey: `request-${targetCommitSha.slice(0, 8)}`,
    ...overrides
  });
}

function capabilityFor(request) {
  return createCapabilityManifest({
    request,
    authorizationKind: 'github-token',
    capabilities: [
      'read-source',
      'write-control-ledger',
      'publish-check',
      'publish-comment',
      'publish-status',
      'read-artifact-metadata'
    ],
    issuedAt: ts,
    expiresAt: later
  });
}

function identityFor(request) {
  return {
    repositoryId: request.repositoryId,
    installationId: request.installationId,
    repositoryFullName: request.repositoryFullName,
    targetCommitSha: request.targetCommitSha
  };
}

function expectValidationError(action, code) {
  assert.throws(action, (error) => {
    assert.equal(error instanceof DirectValidationError, true);
    if (code) assert.equal(error.code, code);
    return true;
  });
}

function fakeTransport(overrides = {}) {
  const calls = [];
  const transport = {
    async getRepository(input) {
      calls.push(['getRepository', input]);
      return { repositoryId: 123, fullName: 'curveyield/contract-automation' };
    },
    async getCommit(input) {
      calls.push(['getCommit', input]);
      return { sha: input.targetCommitSha };
    },
    async getBlob(input) {
      calls.push(['getBlob', input]);
      return { blobSha: input.blobSha, sizeBytes: 3 };
    },
    async getContents(input) {
      calls.push(['getContents', input]);
      return { path: input.path, blobSha: blob };
    },
    async applyLedgerMutation(input) {
      calls.push(['applyLedgerMutation', input]);
      return { applied: true, nextBlobSha: input.mutation.nextContentBlobSha };
    },
    async getPublication(input) {
      calls.push(['getPublication', input]);
      return null;
    },
    async publish(input) {
      calls.push(['publish', input]);
      return { published: true, publicationId: input.publicationId };
    },
    async getArtifactMetadata(input) {
      calls.push(['getArtifactMetadata', input]);
      return [{
        artifactId: 'artifact-1',
        name: 'results-json',
        sizeBytes: 1024,
        digest: digest('c'),
        expired: false,
        createdAt: ts,
        expiresAt: later
      }];
    },
    ...overrides
  };
  return { calls, transport };
}

function rehashAdmission(value) {
  const core = {
    schemaVersion: value.schemaVersion,
    modeId: value.modeId,
    jobId: value.jobId,
    repositoryId: value.repositoryId,
    installationId: value.installationId,
    repositoryFullName: value.repositoryFullName,
    targetCommitSha: value.targetCommitSha,
    sourceCommitSha: value.sourceCommitSha,
    policyVersion: value.policyVersion,
    profileId: value.profileId,
    parserVersion: value.parserVersion,
    resultContractVersion: value.resultContractVersion,
    capabilityId: value.capabilityId,
    fixtureId: value.fixtureId,
    admissionState: value.admissionState,
    reason: value.reason,
    executionEnabled: value.executionEnabled,
    modeledResultDigest: value.modeledResultDigest,
    summary: value.summary,
    admittedAt: value.admittedAt
  };
  value.admissionDigest = sha256(core);
  value.admissionId = `direct-admission-${value.admissionDigest.slice(7, 31)}`;
  return value;
}

function rehashOutcome(value) {
  const core = {
    schemaVersion: value.schemaVersion,
    modeId: value.modeId,
    jobId: value.jobId,
    targetCommitSha: value.targetCommitSha,
    fixtureId: value.fixtureId,
    terminalState: value.terminalState,
    transitions: value.transitions,
    executionPerformed: value.executionPerformed,
    resultManifest: value.resultManifest,
    producedAt: value.producedAt
  };
  value.outcomeDigest = sha256(core);
  value.outcomeId = `direct-outcome-${value.outcomeDigest.slice(7, 31)}`;
  return value;
}

function rehashPublication(value) {
  const core = {
    schemaVersion: value.schemaVersion,
    modeId: value.modeId,
    jobId: value.jobId,
    targetCommitSha: value.targetCommitSha,
    outcomeId: value.outcomeId,
    resultManifest: value.resultManifest,
    reportIndex: value.reportIndex,
    ledgerPlans: value.ledgerPlans,
    adapterPlans: value.adapterPlans,
    publishedAt: value.publishedAt
  };
  value.publicationDigest = sha256(core);
  value.publicationId = `direct-runner-publication-${value.publicationDigest.slice(7, 31)}`;
  return value;
}

test('publication validation rejects hostile kind access without invoking it', () => {
  let invoked = 0;
  const input = {};
  Object.defineProperty(input, 'kind', {
    enumerable: true,
    get() {
      invoked += 1;
      throw new Error('must not run');
    }
  });
  expectValidationError(() => validatePublicationPlan(input), 'accessor_field');
  assert.equal(invoked, 0);
});

test('adapter validates publication before any transport lookup', async () => {
  const request = requestFor();
  const fake = fakeTransport();
  const adapter = createInjectedGitHubAdapter({ capabilityManifest: capabilityFor(request), transport: fake.transport });
  const valid = planCheckPublication({ request, name: 'CurveYield Direct Audit', summary: 'summary', conclusion: 'neutral', at: later });
  const invalid = { ...valid, publicationDigest: digest('f') };
  await assert.rejects(
    adapter.publish({ ...identityFor(request), plan: invalid }),
    (error) => error instanceof DirectValidationError && error.code === 'digest_mismatch'
  );
  assert.deepEqual(fake.calls, []);
});

test('artifact metadata inspection rejects accessors without invoking them', async () => {
  const request = requestFor();
  let invoked = 0;
  const item = {};
  Object.defineProperty(item, 'schemaVersion', {
    enumerable: true,
    get() {
      invoked += 1;
      throw new Error('must not run');
    }
  });
  const fake = fakeTransport({ async getArtifactMetadata(input) { fake.calls.push(['getArtifactMetadata', input]); return [item]; } });
  const adapter = createInjectedGitHubAdapter({ capabilityManifest: capabilityFor(request), transport: fake.transport });
  await assert.rejects(
    adapter.getArtifactMetadata(identityFor(request)),
    (error) => error instanceof DirectValidationError && error.code === 'accessor_field'
  );
  assert.equal(invoked, 0);
});

test('adapter rejects repository and commit identity drift in transport responses', async () => {
  const request = requestFor();
  const fake = fakeTransport({
    async getRepository(input) { fake.calls.push(['getRepository', input]); return { repositoryId: 999, fullName: 'other/repository' }; },
    async getCommit(input) { fake.calls.push(['getCommit', input]); return { sha: 'd'.repeat(40) }; }
  });
  const adapter = createInjectedGitHubAdapter({ capabilityManifest: capabilityFor(request), transport: fake.transport });
  await assert.rejects(adapter.getRepository(identityFor(request)), { code: 'transport_identity_mismatch' });
  await assert.rejects(adapter.getCommit(identityFor(request)), { code: 'transport_identity_mismatch' });
});

test('adapter rejects malformed blob, contents, ledger, and publish transport responses', async () => {
  const request = requestFor();
  const fake = fakeTransport({
    async getBlob(input) { fake.calls.push(['getBlob', input]); return { blobSha: 'e'.repeat(40), sizeBytes: -1 }; },
    async getContents(input) { fake.calls.push(['getContents', input]); return { path: 'other/path.sol', blobSha: blob, extra: true }; },
    async applyLedgerMutation(input) { fake.calls.push(['applyLedgerMutation', input]); return { applied: true, nextBlobSha: 'e'.repeat(40) }; },
    async publish(input) { fake.calls.push(['publish', input]); return { published: true, publicationId: 'other-publication' }; }
  });
  const adapter = createInjectedGitHubAdapter({ capabilityManifest: capabilityFor(request), transport: fake.transport });
  await assert.rejects(adapter.getBlob({ ...identityFor(request), blobSha: blob }), (error) => typeof error.code === 'string');
  await assert.rejects(adapter.getContents({ ...identityFor(request), path: 'contracts/A.sol' }), (error) => typeof error.code === 'string');
  const mutation = planImmutableCreate({ path: `.audit-direct/v1/requests/${request.jobId}.json`, content: request });
  await assert.rejects(adapter.applyLedgerMutation({ ...identityFor(request), mutation }), { code: 'transport_identity_mismatch' });
  const publication = planCheckPublication({ request, name: 'CurveYield Direct Audit', summary: 'summary', conclusion: 'neutral', at: later });
  await assert.rejects(adapter.publish({ ...identityFor(request), plan: publication }), { code: 'transport_identity_mismatch' });
});

test('runner admission rejects self-hashed fixture reason contradictions', () => {
  const fixture = DIRECT_FIXTURE_ALLOWLIST.entries[0];
  const request = requestFor(fixture.targetCommitSha, { idempotencyKey: 'fixture-request-1' });
  const admission = admitDirectJob({ request, capabilityManifest: capabilityFor(request), sourceCommitSha: request.targetCommitSha, admittedAt: later });
  expectValidationError(() => validateRunnerAdmission(rehashAdmission({ ...admission, reason: 'execution_plane_unavailable' })), 'admission_contradiction');
});

test('runner admission rejects self-hashed non-fixture fabricated summary', () => {
  const request = requestFor();
  const admission = admitDirectJob({ request, capabilityManifest: capabilityFor(request), sourceCommitSha: request.targetCommitSha, admittedAt: later });
  const invalid = rehashAdmission({ ...admission, summary: { findingCount: 1, evidenceCount: 0, artifactCount: 0, truncated: false } });
  expectValidationError(() => validateRunnerAdmission(invalid), 'admission_contradiction');
});

test('runner outcome rejects a self-hashed fixture with unavailable result truth', () => {
  const fixture = DIRECT_FIXTURE_ALLOWLIST.entries[0];
  const request = requestFor(fixture.targetCommitSha, { idempotencyKey: 'fixture-request-2' });
  const admission = admitDirectJob({ request, capabilityManifest: capabilityFor(request), sourceCommitSha: request.targetCommitSha, admittedAt: later });
  const outcome = orchestrateDirectJob({ request, admission, producedAt: later });
  const resultManifest = createResultManifest({
    request,
    outcome: 'execution_unavailable',
    executionState: 'execution_plane_unavailable',
    resultDigest: null,
    summary: { findingCount: 0, evidenceCount: 0, artifactCount: 0, truncated: false },
    producedAt: later
  });
  expectValidationError(() => validateRunnerOutcome(rehashOutcome({ ...outcome, resultManifest })), 'outcome_contradiction');
});

test('runner publication rejects swapped ledger content even after rehashing', () => {
  const request = requestFor();
  const admission = admitDirectJob({ request, capabilityManifest: capabilityFor(request), sourceCommitSha: request.targetCommitSha, admittedAt: later });
  const outcome = orchestrateDirectJob({ request, admission, producedAt: later });
  const publication = planRunnerPublication({ request, outcome, resultId: 'result-1', reportId: 'report-1', publishedAt: later });
  const invalid = structuredClone(publication);
  [invalid.ledgerPlans[0], invalid.ledgerPlans[1]] = [invalid.ledgerPlans[1], invalid.ledgerPlans[0]];
  rehashPublication(invalid);
  expectValidationError(() => validateRunnerPublicationPlan(invalid), 'publication_binding_mismatch');
});

test('runner publication rejects truthful child plans that describe the wrong outcome', () => {
  const request = requestFor();
  const admission = admitDirectJob({ request, capabilityManifest: capabilityFor(request), sourceCommitSha: request.targetCommitSha, admittedAt: later });
  const outcome = orchestrateDirectJob({ request, admission, producedAt: later });
  const publication = planRunnerPublication({ request, outcome, resultId: 'result-1', reportId: 'report-1', publishedAt: later });
  const invalid = structuredClone(publication);
  invalid.adapterPlans[0] = planCheckPublication({
    request,
    name: 'CurveYield Direct Audit',
    summary: 'Modeled repository fixture result published',
    conclusion: 'success',
    at: later
  });
  rehashPublication(invalid);
  expectValidationError(() => validateRunnerPublicationPlan(invalid), 'publication_binding_mismatch');
});
