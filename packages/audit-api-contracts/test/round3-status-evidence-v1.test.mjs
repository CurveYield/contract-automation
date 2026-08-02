import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEvidenceSummary,
  validateStatusSummary
} from '../src/status.mjs';

const scope = { tenantId: 'tenant-a', workspaceId: 'workspace-a' };
function status(resourceType, resourceId, state, terminal) {
  return {
    schemaVersion: 'audit-status-summary-v1',
    resourceType,
    resourceId,
    ...scope,
    state,
    updatedAt: '2026-08-02T02:45:00.000Z',
    terminal,
    progress: { completed: terminal ? 1 : 0, total: 1 }
  };
}
function options(resourceType, resourceId) {
  return { resourceType, resourceId, ...scope };
}
function evidence(jobId = 'job-a') {
  return {
    schemaVersion: 'audit-evidence-summary-v1',
    jobId,
    ...scope,
    classification: 'findings',
    findingCount: 2,
    evidenceCount: 3,
    artifactCount: 0,
    truncated: false,
    updatedAt: '2026-08-02T02:45:00.000Z'
  };
}

test('workspace, campaign, job, fork, and clean-room lifecycle summaries accept exact truthful states', () => {
  const cases = [
    ['workspace', 'workspace-a', 'active', false],
    ['workspace', 'workspace-a', 'archived', true],
    ['campaign', 'campaign-a', 'running', false],
    ['campaign', 'campaign-a', 'completed', true],
    ['job', 'job-a', 'awaiting_executor', false],
    ['job', 'job-a', 'resource_exhaustion', true],
    ['fork', 'fork-a', 'awaiting_executor', false],
    ['fork', 'fork-a', 'deleted', true],
    ['clean-room', 'clean-room-a', 'active', false],
    ['clean-room', 'clean-room-a', 'policy_rejected', true]
  ];
  for (const [type, id, state, terminal] of cases) {
    const output = validateStatusSummary(status(type, id, state, terminal), options(type, id));
    assert.equal(output.state, state);
    assert.ok(Object.isFrozen(output));
    assert.ok(Object.isFrozen(output.progress));
  }
});

test('status summaries reject one-field schema, identity, scope, lifecycle, terminal, progress, and shape mutations', () => {
  const base = status('fork', 'fork-a', 'awaiting_executor', false);
  const mutations = [
    (value) => { value.schemaVersion = 'wrong'; },
    (value) => { value.resourceType = 'job'; },
    (value) => { value.resourceId = 'fork-b'; },
    (value) => { value.tenantId = 'tenant-b'; },
    (value) => { value.workspaceId = 'workspace-b'; },
    (value) => { value.state = 'ready-and-executing'; },
    (value) => { value.updatedAt = 'not-an-instant'; },
    (value) => { value.terminal = true; },
    (value) => { value.progress.completed = -1; },
    (value) => { value.progress.total = 1_000_001; },
    (value) => { value.progress.completed = 2; },
    (value) => { value.debug = { token: 'secret' }; }
  ];
  for (const mutate of mutations) {
    const value = structuredClone(base);
    mutate(value);
    assert.throws(() => validateStatusSummary(value, options('fork', 'fork-a')));
  }
});

test('evidence summary is bounded, frozen, identity-scoped, URL-free, and artifact-byte-free', () => {
  const output = validateEvidenceSummary(evidence(), { jobId: 'job-a', ...scope });
  assert.ok(Object.isFrozen(output));
  assert.equal('url' in output, false);
  assert.equal('artifactBytes' in output, false);
  assert.equal('signedUrl' in output, false);
  assert.equal(JSON.stringify(output).includes('https://'), false);
});

test('evidence summaries reject every one-field identity, schema, count, truncation, timestamp, and shape mutation', () => {
  const mutations = [
    (value) => { value.schemaVersion = 'wrong'; },
    (value) => { value.jobId = 'job-b'; },
    (value) => { value.tenantId = 'tenant-b'; },
    (value) => { value.workspaceId = 'workspace-b'; },
    (value) => { value.classification = 'executed'; },
    (value) => { value.findingCount = -1; },
    (value) => { value.evidenceCount = 1_000_001; },
    (value) => { value.artifactCount = Number.MAX_SAFE_INTEGER; },
    (value) => { value.truncated = 'false'; },
    (value) => { value.updatedAt = 'yesterday'; },
    (value) => { value.url = 'https://attacker.example/evidence'; },
    (value) => { value.artifactBytes = 'deadbeef'; }
  ];
  for (const mutate of mutations) {
    const value = evidence();
    mutate(value);
    assert.throws(() => validateEvidenceSummary(value, { jobId: 'job-a', ...scope }));
  }
});
