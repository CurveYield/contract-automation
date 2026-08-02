import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDirectRequest,
  createCapabilityManifest
} from '../packages/audit-github-direct-protocol/src/index.mjs';
import {
  createPermissionManifest,
  normalizeGitHubError,
  createInjectedGitHubAdapter,
  planCheckPublication,
  planCommentPublication,
  planStatusPublication,
  validatePublicationPlan,
  reconcilePublication,
  createArtifactMetadata,
  validateArtifactMetadata
} from '../packages/audit-github-direct-adapter/src/index.mjs';
import { planImmutableCreate } from '../packages/audit-github-direct-ledger/src/index.mjs';

const ts = '2026-08-01T18:00:00.000Z';
const later = '2026-08-01T18:05:00.000Z';
const sha = 'a'.repeat(40);
const blob = 'b'.repeat(40);
const d = (character) => `sha256:${character.repeat(64)}`;

const request = createDirectRequest({
  repositoryId: 123,
  installationId: 456,
  repositoryFullName: 'curveyield/contract-automation',
  requesterId: 'user-1',
  policyVersion: 'direct-policy-v1',
  profileId: 'hardhat-test-v1',
  parserVersion: 'hardhat-test-parser-v1',
  resultContractVersion: 'phase5-tool-result-v1',
  reportContractVersion: 'audit-report-v1',
  targetCommitSha: sha,
  requestedAt: ts,
  idempotencyKey: 'request-1'
});

const capability = createCapabilityManifest({
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

const identity = {
  repositoryId: 123,
  installationId: 456,
  repositoryFullName: 'curveyield/contract-automation',
  targetCommitSha: sha
};

function fakeTransport() {
  const calls = [];
  const publications = new Map();
  return {
    calls,
    publications,
    transport: {
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
        return publications.get(`${input.kind}:${input.idempotencyKey}`) ?? null;
      },
      async publish(input) {
        calls.push(['publish', input]);
        publications.set(`${input.kind}:${input.idempotencyKey}`, input);
        return { published: true, publicationId: input.publicationId };
      },
      async getArtifactMetadata(input) {
        calls.push(['getArtifactMetadata', input]);
        return [{
          artifactId: 'artifact-1',
          name: 'results-json',
          sizeBytes: 1024,
          digest: d('c'),
          expired: false,
          createdAt: ts,
          expiresAt: later
        }];
      }
    }
  };
}

test('permission manifest is least privilege and operation-specific', () => {
  const manifest = createPermissionManifest({ capabilityManifest: capability });
  assert.deepEqual(manifest.permissions, [
    { resource: 'actions-artifact-metadata', access: 'read' },
    { resource: 'checks', access: 'write' },
    { resource: 'contents', access: 'read' },
    { resource: 'contents', access: 'write' },
    { resource: 'issues-comments', access: 'write' },
    { resource: 'statuses', access: 'write' }
  ]);
  assert.doesNotMatch(JSON.stringify(manifest), /admin|secret|workflow|deployment|token/i);
});

test('permission manifest rejects expired capabilities and unsupported broad fields', () => {
  assert.throws(
    () => createPermissionManifest({ capabilityManifest: capability, permissions: ['admin'] }),
    { code: 'unknown_field' }
  );
  assert.throws(
    () => createPermissionManifest({ capabilityManifest: { ...capability, expiresAt: ts } }),
    (error) => typeof error.code === 'string'
  );
});

test('GitHub errors normalize to bounded stable redacted forms', () => {
  const raw = {
    status: 403,
    message: 'Bearer ghs_secret failed at https://api.github.com/repos/private C:\\Users\\alice',
    response: { body: 'token=secret' },
    request: { headers: { authorization: 'Bearer ghs_secret' } }
  };
  assert.deepEqual(normalizeGitHubError(raw), {
    schemaVersion: 'github-direct-transport-error-v1',
    code: 'permission_denied',
    status: 403,
    retryable: false,
    message: 'GitHub operation failed'
  });
  const hostile = new Proxy({}, {
    ownKeys() { throw new Error('trap'); },
    get() { throw new Error('trap'); }
  });
  assert.deepEqual(normalizeGitHubError(hostile), {
    schemaVersion: 'github-direct-transport-error-v1',
    code: 'transport_error',
    status: null,
    retryable: false,
    message: 'GitHub operation failed'
  });
});

test('injected adapter binds and validates repository/install/target SHA for reads', async () => {
  const fake = fakeTransport();
  const adapter = createInjectedGitHubAdapter({ capabilityManifest: capability, transport: fake.transport });
  assert.deepEqual(await adapter.getRepository(identity), {
    repositoryId: 123,
    fullName: 'curveyield/contract-automation'
  });
  assert.deepEqual(await adapter.getCommit(identity), { sha });
  assert.deepEqual(await adapter.getBlob({ ...identity, blobSha: blob }), { blobSha: blob, sizeBytes: 3 });
  assert.deepEqual(await adapter.getContents({ ...identity, path: 'contracts/A.sol' }), {
    path: 'contracts/A.sol',
    blobSha: blob
  });
  assert.deepEqual(fake.calls.map((entry) => entry[0]), [
    'getRepository', 'getCommit', 'getBlob', 'getContents'
  ]);
  assert.throws(() => adapter.getCommit({ ...identity, targetCommitSha: 'c'.repeat(40) }), { code: 'identity_mismatch' });
  assert.throws(() => adapter.getContents({ ...identity, repositoryId: 999, path: 'contracts/A.sol' }), { code: 'identity_mismatch' });
});

test('injected adapter validates transport shape without invoking getters', () => {
  const transport = { ...fakeTransport().transport };
  Object.defineProperty(transport, 'publish', {
    enumerable: true,
    get() { throw new Error('must-not-run'); }
  });
  assert.throws(
    () => createInjectedGitHubAdapter({ capabilityManifest: capability, transport }),
    { code: 'accessor_field' }
  );
  const { proxy, revoke } = Proxy.revocable(fakeTransport().transport, {});
  revoke();
  assert.throws(
    () => createInjectedGitHubAdapter({ capabilityManifest: capability, transport: proxy }),
    { code: 'hostile_reflection' }
  );
});

test('ledger mutation dispatch requires capability and exact identity', async () => {
  const fake = fakeTransport();
  const adapter = createInjectedGitHubAdapter({ capabilityManifest: capability, transport: fake.transport });
  const mutation = planImmutableCreate({
    path: `.audit-direct/v1/requests/${request.jobId}.json`,
    content: request
  });
  const result = await adapter.applyLedgerMutation({ ...identity, mutation });
  assert.deepEqual(result, { applied: true, nextBlobSha: mutation.nextContentBlobSha });
  assert.equal(fake.calls[0][0], 'applyLedgerMutation');
  assert.throws(
    () => adapter.applyLedgerMutation({ ...identity, installationId: 999, mutation }),
    { code: 'identity_mismatch' }
  );
});

test('publication plans are deterministic, bounded, frozen, and replay validated', () => {
  const check = planCheckPublication({ request, name: 'CurveYield Direct Audit', summary: 'summary', conclusion: 'neutral', at: later });
  const comment = planCommentPublication({ request, body: 'report ready', at: later });
  const status = planStatusPublication({ request, state: 'success', description: 'complete', context: 'curveyield/direct-audit', at: later });
  for (const plan of [check, comment, status]) {
    assert.deepEqual(validatePublicationPlan(plan), plan);
    assert.equal(Object.isFrozen(plan), true);
    assert.equal(reconcilePublication({ plan, observed: null }).action, 'create');
    assert.equal(reconcilePublication({ plan, observed: plan }).action, 'noop');
    assert.throws(
      () => reconcilePublication({ plan, observed: { ...plan, publicationDigest: d('f') } }),
      { code: 'publication_conflict' }
    );
  }
});

test('adapter publication is idempotent and rejects conflicting observed records', async () => {
  const fake = fakeTransport();
  const adapter = createInjectedGitHubAdapter({ capabilityManifest: capability, transport: fake.transport });
  const plan = planCheckPublication({ request, name: 'CurveYield Direct Audit', summary: 'summary', conclusion: 'neutral', at: later });
  const created = await adapter.publish({ ...identity, plan });
  assert.equal(created.action, 'create');
  assert.equal(created.result.publicationId, plan.publicationId);
  const repeated = await adapter.publish({ ...identity, plan });
  assert.equal(repeated.action, 'noop');
  fake.publications.set(`check:${plan.idempotencyKey}`, { ...plan, publicationDigest: d('f') });
  await assert.rejects(adapter.publish({ ...identity, plan }), { code: 'publication_conflict' });
});

test('artifact metadata is exact, frozen, and safely normalized', async () => {
  const metadata = createArtifactMetadata({
    artifactId: 'artifact-1',
    name: 'results-json',
    sizeBytes: 1024,
    digest: d('c'),
    expired: false,
    createdAt: ts,
    expiresAt: later
  });
  assert.deepEqual(validateArtifactMetadata(metadata), metadata);
  assert.equal(Object.isFrozen(metadata), true);
  assert.throws(
    () => validateArtifactMetadata({ ...metadata, sizeBytes: -1 }),
    (error) => typeof error.code === 'string'
  );
  const fake = fakeTransport();
  const adapter = createInjectedGitHubAdapter({ capabilityManifest: capability, transport: fake.transport });
  const results = await adapter.getArtifactMetadata(identity);
  assert.equal(results.length, 1);
  assert.equal(results[0].artifactId, 'artifact-1');
  assert.equal(Object.isFrozen(results[0]), true);
});
