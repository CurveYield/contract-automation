import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const protocol = await import('../packages/audit-github-direct-protocol/src/index.mjs');
const ledger = await import('../packages/audit-github-direct-ledger/src/index.mjs');
const adapter = await import('../packages/audit-github-direct-adapter/src/index.mjs');
const runner = await import('../packages/audit-github-direct-runner/src/index.mjs');
const reporting = await import('../packages/audit-github-direct-reporting/src/index.mjs');
const service = await import('../packages/audit-github-direct-service/src/index.mjs');
const cli = await import('../apps/audit-github-direct-cli/src/cli.mjs');
const transportModule = await import('../apps/audit-github-direct-cli/src/github-actions-transport.mjs');

const at = '2026-08-02T02:34:00.000Z';
const later = '2026-08-02T02:44:00.000Z';
const targetSha = 'a'.repeat(40);
const blobA = 'b'.repeat(40);
const blobB = 'c'.repeat(40);
const digest = (character) => `sha256:${character.repeat(64)}`;

function requestFor(overrides = {}) {
  return protocol.createDirectRequest({
    repositoryId: 123,
    installationId: 456,
    repositoryFullName: 'curveyield/contract-automation',
    requesterId: 'actor-123',
    policyVersion: 'direct-policy-v1',
    profileId: 'hardhat-test-v1',
    parserVersion: 'hardhat-test-parser-v1',
    resultContractVersion: 'phase5-tool-result-v1',
    reportContractVersion: 'audit-report-v1',
    targetCommitSha: targetSha,
    requestedAt: at,
    idempotencyKey: 'round3-request-1',
    ...overrides
  });
}

function capabilityFor(request) {
  return protocol.createCapabilityManifest({
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
    issuedAt: at,
    expiresAt: later
  });
}

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body
  };
}

test('mixed-case GitHub repository identity canonicalizes to lowercase', () => {
  const request = requestFor({ repositoryFullName: 'CurveYield/Contract-Automation' });
  assert.equal(request.repositoryFullName, 'curveyield/contract-automation');
  assert.deepEqual(protocol.validateDirectRequest(request), request);
});

test('request publication validator binds operation order, paths, and contents', () => {
  const request = requestFor();
  const currentIndex = ledger.createJobIndex({ entries: [], updatedAt: at });
  const plan = ledger.planRequestPublication({ request, currentIndex, indexBlobSha: blobA, at });
  const swapped = { ...plan, operations: [plan.operations[1], plan.operations[0], plan.operations[2]] };
  assert.throws(
    () => ledger.validateRequestPublicationPlan(swapped),
    (error) => error?.code === 'publication_binding_mismatch'
  );
});

test('ledger transition validator binds event, current pointer, and index operations', () => {
  const request = requestFor();
  const currentState = protocol.createDirectState({ request, state: 'requested', version: 0, updatedAt: at });
  const currentIndex = ledger.createJobIndex({
    entries: [{
      jobId: request.jobId,
      targetCommitSha: request.targetCommitSha,
      state: 'requested',
      currentPath: `.audit-direct/v1/current/${request.jobId}.json`,
      currentBlobSha: blobA
    }],
    updatedAt: at
  });
  const transition = ledger.transitionLedgerState({
    request,
    currentState,
    currentBlobSha: blobA,
    indexBlobSha: blobB,
    to: 'validating',
    reasonCode: 'round3-validation',
    at: later,
    currentIndex
  });
  const swapped = {
    ...transition,
    operations: [transition.operations[1], transition.operations[0], transition.operations[2]]
  };
  assert.throws(
    () => ledger.validateLedgerTransition(swapped),
    (error) => error?.code === 'transition_binding_mismatch'
  );
});

test('publication journal uses a closed server-owned ledger path', () => {
  assert.equal(typeof ledger.buildPublicationLedgerPath, 'function');
  const request = requestFor();
  const path = ledger.buildPublicationLedgerPath({
    jobId: request.jobId,
    publicationId: 'direct-comment-0123456789abcdef01234567'
  });
  assert.equal(
    path,
    `.audit-direct/v1/publications/${request.jobId}/direct-comment-0123456789abcdef01234567.json`
  );
  assert.equal(ledger.ledgerPath(path), path);
  assert.throws(() => ledger.ledgerPath('.audit-direct/v1/publications/comment/comment-job.json'));
});

test('service exposes strict result and error validators and rejects credential-bearing data', () => {
  assert.equal(typeof service.validateServiceResult, 'function');
  assert.equal(typeof service.validateServiceError, 'function');
  const request = requestFor();
  const command = service.createServiceCommand({ kind: 'status', request, at });
  assert.throws(
    () => service.createServiceResult({
      command,
      state: 'completed',
      data: { token: 'ghs_secret' },
      completedAt: at
    }),
    (error) => error?.code === 'credential_field'
  );
  const serviceError = service.createServiceError({ code: 'transport_failure', retryable: true, at });
  assert.deepEqual(service.validateServiceError(serviceError), serviceError);
});

test('reporting validator rejects nested report and ledger identity drift', () => {
  const request = requestFor();
  const admission = runner.admitDirectJob({
    request,
    capabilityManifest: capabilityFor(request),
    sourceCommitSha: request.targetCommitSha,
    admittedAt: at
  });
  const outcome = runner.orchestrateDirectJob({ request, admission, producedAt: later });
  const bundle = reporting.createReportingBundle({
    request,
    outcome,
    resultId: 'result-round3',
    reportId: 'report-round3',
    commentBody: 'Round 3 report.',
    publishedAt: later
  });
  const invalid = {
    ...bundle,
    reportIndex: { ...bundle.reportIndex, targetCommitSha: 'd'.repeat(40) }
  };
  assert.throws(
    () => reporting.validateReportingBundle(invalid),
    (error) => typeof error?.code === 'string'
  );
});

test('artifact metadata index validates job/SHA identity and duplicate artifact IDs', () => {
  const request = requestFor();
  const index = reporting.ingestArtifactMetadata({
    request,
    items: [{
      artifactId: 'artifact-1',
      name: 'audit-direct-result',
      sizeBytes: 10,
      digest: digest('e'),
      expired: false,
      createdAt: at,
      expiresAt: later
    }]
  });
  assert.throws(
    () => reporting.validateArtifactMetadataIndex({ ...index, jobId: 'latest' }),
    (error) => typeof error?.code === 'string'
  );
  assert.throws(
    () => reporting.validateArtifactMetadataIndex({ ...index, items: [index.items[0], index.items[0]] }),
    (error) => error?.code === 'duplicate_identity'
  );
});

test('CLI rejects malformed service responses before serialization', async () => {
  const request = requestFor();
  const argv = [
    'status',
    '--repository-id', String(request.repositoryId),
    '--installation-id', String(request.installationId),
    '--repository', request.repositoryFullName,
    '--requester', request.requesterId,
    '--policy', request.policyVersion,
    '--profile', request.profileId,
    '--parser', request.parserVersion,
    '--result-contract', request.resultContractVersion,
    '--report-contract', request.reportContractVersion,
    '--target-sha', request.targetCommitSha,
    '--requested-at', request.requestedAt,
    '--idempotency-key', request.idempotencyKey,
    '--at', at
  ];
  let stdout = '';
  let stderr = '';
  const exitCode = await cli.runCli({
    argv,
    service: { execute: async () => ({ schemaVersion: 'fake-result-v1', token: 'ghs_secret' }) },
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; }
  });
  assert.equal(exitCode, cli.CLI_EXIT_CODES.service_failure);
  assert.equal(stdout, '');
  assert.doesNotMatch(stderr, /ghs_secret/);
});

test('publication retry reconciles an existing comment before creating another side effect', async () => {
  const request = requestFor();
  const plan = adapter.planCommentPublication({ request, body: 'Round 3 comment', at });
  const comments = [];
  let journal = null;
  let failJournalWrite = true;
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push([init.method, url]);
    if (url.includes('/contents/')) {
      if (init.method === 'GET') {
        if (journal === null) return response(404, null);
        return response(200, {
          sha: blobA,
          content: Buffer.from(JSON.stringify(journal)).toString('base64')
        });
      }
      if (failJournalWrite) {
        failJournalWrite = false;
        return response(503, {});
      }
      journal = plan;
      return response(201, { content: { sha: blobA }, commit: { sha: blobB } });
    }
    if (url.endsWith('/issues/115/comments') && init.method === 'GET') {
      return response(200, comments.map((body, index) => ({ id: index + 1, body })));
    }
    if (url.endsWith('/issues/115/comments') && init.method === 'POST') {
      const body = JSON.parse(init.body).body;
      comments.push(body);
      return response(201, { id: comments.length, body });
    }
    return response(200, {});
  };
  const transport = transportModule.createGitHubActionsTransport({
    tokenProvider: () => 'token',
    fetchImpl,
    issueNumber: 115
  });
  await assert.rejects(() => transport.publish(plan));
  const retried = await transport.publish(plan);
  assert.equal(retried.published, true);
  assert.equal(comments.length, 1);
});

test('artifact metadata is scoped to the exact repository and target SHA artifact name', async () => {
  const request = requestFor();
  const wantedName = `audit-direct-result-${request.repositoryId}-${request.targetCommitSha}`;
  const fetchImpl = async (url) => {
    assert.match(url, /\/actions\/artifacts\?per_page=100$/);
    return response(200, {
      artifacts: [
        { id: 1, name: wantedName, size_in_bytes: 10, digest: digest('1'), expired: false, created_at: at, expires_at: later },
        { id: 2, name: 'unrelated-artifact', size_in_bytes: 20, digest: digest('2'), expired: false, created_at: at, expires_at: later }
      ]
    });
  };
  const transport = transportModule.createGitHubActionsTransport({
    tokenProvider: () => 'token',
    fetchImpl,
    issueNumber: 115
  });
  const items = await transport.getArtifactMetadata({
    repositoryId: request.repositoryId,
    installationId: request.installationId,
    repositoryFullName: request.repositoryFullName,
    targetCommitSha: request.targetCommitSha
  });
  assert.deepEqual(items.map((item) => item.name), [wantedName]);
});

test('workflow uses server-owned scope, operation-specific permissions, and non-cancelling concurrency', async () => {
  const workflow = await readFile(new URL('../.github/workflows/audit-direct-v1.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(workflow, /^\s{6}installation_id:/m);
  assert.doesNotMatch(workflow, /^\s{6}report_issue_number:/m);
  assert.match(workflow, /vars\.GITHUB_DIRECT_REPORT_ISSUE/);
  assert.match(workflow, /cancel-in-progress:\s*false/);
  assert.doesNotMatch(workflow, /^permissions:\n\s+contents:\s+write\n\s+checks:\s+write\n\s+statuses:\s+write\n\s+issues:\s+write/m);
  assert.match(workflow, /read-only:/);
  assert.match(workflow, /submit:/);
  assert.match(workflow, /cancel:/);
  assert.match(workflow, /report:/);
  assert.doesNotMatch(workflow, /pull_request_target/);
});

test('transport-neutral compatibility and Round 4 release manifests are strict and deterministic', () => {
  assert.equal(typeof service.createCompatibilityManifest, 'function');
  assert.equal(typeof service.validateCompatibilityManifest, 'function');
  assert.equal(typeof service.createReleaseManifest, 'function');
  assert.equal(typeof service.validateReleaseManifest, 'function');
  const compatibility = service.createCompatibilityManifest({
    candidateSha: targetSha,
    workflowSha: targetSha,
    publishedAt: at
  });
  assert.deepEqual(service.validateCompatibilityManifest(compatibility), compatibility);
  const release = service.createReleaseManifest({
    candidateSha: targetSha,
    approvedCoreSha: 'f'.repeat(40),
    workflowSha: targetSha,
    protectedBlobDigest: digest('9'),
    publishedAt: at
  });
  assert.deepEqual(service.validateReleaseManifest(release), release);
});
