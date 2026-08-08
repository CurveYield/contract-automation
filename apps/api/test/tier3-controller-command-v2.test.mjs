import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

async function loadAdapter() {
  try { return await import('../src/tier3-controller-adapter-v6.mjs'); }
  catch { return {}; }
}

const SHA = (digit, length = 40) => digit.repeat(length);
const capabilityToken = 'controller-capability-secret-123';
const authorization = {
  schemaVersion: 'hosted-controller-session-authorization-v1',
  authorizationId: 'auth1', campaignId: 'cmp_1',
  actor: { type: 'worker', id: 'worker1' },
  sessionId: 'session1', roleId: 'scope-specification-auditor', phaseId: 'scope-and-provenance',
  mailboxIssueNumber: 321,
  allowedCommandTypes: ['assignment.claim'],
  controllerProtocolSha: SHA('2'),
  instructionProofKey: 'worker1|session1|scope-specification-auditor|scope-and-provenance',
  tokenSha256: createHash('sha256').update(capabilityToken).digest('hex'),
  issuedAt: '2026-08-08T05:00:00.000Z', expiresAt: '2026-08-08T07:00:00.000Z'
};
const command = {
  schemaVersion: 1, commandId: 'cmd-claim-1', type: 'assignment.claim',
  actor: { type: 'worker', id: 'worker1' },
  payload: {
    assignmentId: 'a1', workerId: 'worker1', leaseToken: 'lease-secret',
    instructionScope: { sessionId: 'session1', roleId: 'scope-specification-auditor', phaseId: 'scope-and-provenance' }
  }
};
const env = {
  AUDIT_CONTROLLER_GITHUB_TOKEN: 'read-token',
  AUDIT_CONTROLLER_GITHUB_COMMAND_TOKEN: 'write-token',
  AUDIT_CONTROLLER_PROTOCOL_SHA: SHA('2'),
  AUDIT_CONTROLLER_STATE_REF: 'main',
  AUTOMATION_RELEASE_SHA: SHA('4')
};

function authContents(value = authorization) {
  return new Response(JSON.stringify({ encoding: 'base64', content: Buffer.from(JSON.stringify(value)).toString('base64') }), { status: 200 });
}

function publicationFetcher(record = {}) {
  return async (url, init = {}) => {
    const value = String(url);
    if (value.includes('/contents/hosted-authorizations/v1/auth1.json?ref=main')) {
      record.readAuthorization = { url: value, init };
      return authContents();
    }
    if (value.endsWith('/repos/CurveYield/audit-controller/issues/321/comments')) {
      record.publish = { url: value, init, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ id: 98765 }), { status: 201 });
    }
    throw new Error(`unexpected URL ${value}`);
  };
}

test('publishes an exact controller envelope only to the authorization-bound mailbox', async () => {
  const { controllerCommandResponseV6 } = await loadAdapter();
  assert.equal(typeof controllerCommandResponseV6, 'function');
  const record = {};
  const response = await controllerCommandResponseV6('cmp_1', { authorizationId: 'auth1', capabilityToken, command }, env, publicationFetcher(record), '2026-08-08T06:00:00.000Z');
  assert.equal(response.status, 202);
  assert.equal(record.publish.url.endsWith('/issues/321/comments'), true);
  assert.equal(record.publish.init.headers.authorization, 'Bearer write-token');
  assert.match(record.publish.body.body, /CURVEYIELD_AUDIT_COMMAND_V1_BEGIN/);
  assert.match(record.publish.body.body, /"commandId":"cmd-claim-1"/);
  assert.doesNotMatch(record.publish.body.body, /controller-capability-secret-123/);
  assert.deepEqual(await response.json(), {
    status: 'SUBMITTED_TO_CONTROLLER_MAILBOX', authorizationId: 'auth1', commandId: 'cmd-claim-1', githubCommentId: 98765
  });
});

test('uses the read credential for authorization lookup and never lets request choose target repository or issue', async () => {
  const { controllerCommandResponseV6 } = await loadAdapter();
  const record = {};
  const response = await controllerCommandResponseV6('cmp_1', {
    authorizationId: 'auth1', capabilityToken, command,
    repository: 'attacker/repo', issueNumber: 999
  }, env, publicationFetcher(record), '2026-08-08T06:00:00.000Z');
  assert.equal(response.status, 400);
  assert.equal(record.publish, undefined);
});

test('rejects wrong capability, expired authorization, and campaign mismatch before publication', async () => {
  const { controllerCommandResponseV6 } = await loadAdapter();
  assert.equal(typeof controllerCommandResponseV6, 'function');
  for (const [body, now, expected] of [
    [{ authorizationId: 'auth1', capabilityToken: 'wrong', command }, '2026-08-08T06:00:00.000Z', 'controller_capability_invalid'],
    [{ authorizationId: 'auth1', capabilityToken, command }, '2026-08-08T07:00:00.000Z', 'controller_authorization_expired']
  ]) {
    const record = {};
    const response = await controllerCommandResponseV6('cmp_1', body, env, publicationFetcher(record), now);
    assert.equal((await response.json()).error.code, expected);
    assert.equal(record.publish, undefined);
  }
  const record = {};
  const response = await controllerCommandResponseV6('other_campaign', { authorizationId: 'auth1', capabilityToken, command }, env, publicationFetcher(record), '2026-08-08T06:00:00.000Z');
  assert.equal((await response.json()).error.code, 'controller_authorization_campaign_mismatch');
  assert.equal(record.publish, undefined);
});

test('fails closed without separate command credential or on GitHub publication failure', async () => {
  const { controllerCommandResponseV6 } = await loadAdapter();
  assert.equal(typeof controllerCommandResponseV6, 'function');
  const missing = await controllerCommandResponseV6('cmp_1', { authorizationId: 'auth1', capabilityToken, command }, { ...env, AUDIT_CONTROLLER_GITHUB_COMMAND_TOKEN: '' }, publicationFetcher({}), '2026-08-08T06:00:00.000Z');
  assert.equal(missing.status, 503);
  const failed = await controllerCommandResponseV6('cmp_1', { authorizationId: 'auth1', capabilityToken, command }, env, async (url, init) => {
    if (String(url).includes('/contents/hosted-authorizations/')) return authContents();
    return new Response(JSON.stringify({ message: 'sensitive upstream detail' }), { status: 403 });
  }, '2026-08-08T06:00:00.000Z');
  assert.equal(failed.status, 502);
  assert.deepEqual(await failed.json(), { error: { code: 'controller_command_publish_failed', message: 'Controller command could not be submitted' } });
});
