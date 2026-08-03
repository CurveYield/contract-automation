import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDeepAssuranceCommitStatus,
  publishDeepAssuranceCommitStatus,
} from '../src/publish-deep-assurance-status.mjs';

const base = {
  repository: 'CurveYield/contract-automation',
  commitSha: 'a'.repeat(40),
  runId: '123456789',
  requestId: `dar-${'b'.repeat(32)}`,
  profileId: 'github-native-compile-v1',
};

test('builds a sanitized navigational commit status for a Deep Assurance request', () => {
  const status = buildDeepAssuranceCommitStatus({ ...base, state: 'pending' });
  assert.deepEqual(status, {
    state: 'pending',
    target_url: 'https://github.com/CurveYield/contract-automation/actions/runs/123456789',
    description: 'Deep Assurance compile request accepted',
    context: `deep-assurance/${base.requestId}`,
  });
  assert.equal(JSON.stringify(status).includes(base.commitSha), false);
  assert.equal(JSON.stringify(status).includes('token'), false);
});

test('builds terminal success and failure statuses without claiming evidence', () => {
  const success = buildDeepAssuranceCommitStatus({ ...base, state: 'success' });
  const failure = buildDeepAssuranceCommitStatus({ ...base, state: 'failure' });
  assert.equal(success.description, 'Deep Assurance compile workflow completed');
  assert.equal(failure.description, 'Deep Assurance compile workflow failed');
  assert.doesNotMatch(success.description, /PASS|verified|safe|evidence/i);
  assert.doesNotMatch(failure.description, /NO_GO|vulnerab|evidence/i);
});

test('rejects invalid status identity and unsupported state', () => {
  assert.throws(() => buildDeepAssuranceCommitStatus({ ...base, repository: '../escape', state: 'pending' }), /repository/i);
  assert.throws(() => buildDeepAssuranceCommitStatus({ ...base, commitSha: 'short', state: 'pending' }), /commit/i);
  assert.throws(() => buildDeepAssuranceCommitStatus({ ...base, runId: '0', state: 'pending' }), /runId/i);
  assert.throws(() => buildDeepAssuranceCommitStatus({ ...base, requestId: 'request-a', state: 'pending' }), /requestId/i);
  assert.throws(() => buildDeepAssuranceCommitStatus({ ...base, profileId: 'solidity-smt-v1', state: 'pending' }), /profileId/i);
  assert.throws(() => buildDeepAssuranceCommitStatus({ ...base, state: 'error' }), /state/i);
});

test('publishes through the GitHub statuses API with the token confined to authorization', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 201, text: async () => '' };
  };
  const status = await publishDeepAssuranceCommitStatus({
    ...base,
    state: 'success',
    token: 'test-token-value',
    fetchImpl,
  });
  assert.equal(status.state, 'success');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://api.github.com/repos/${base.repository}/statuses/${base.commitSha}`);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.authorization, 'Bearer test-token-value');
  assert.equal(calls[0].init.body.includes('test-token-value'), false);
  assert.deepEqual(JSON.parse(calls[0].init.body), status);
});

test('fails closed when GitHub rejects status publication', async () => {
  const fetchImpl = async () => ({ ok: false, status: 403, text: async () => 'forbidden' });
  await assert.rejects(() => publishDeepAssuranceCommitStatus({
    ...base,
    state: 'pending',
    token: 'test-token-value',
    fetchImpl,
  }), /403.*forbidden/i);
});
