import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_COMMAND_BEGIN_MARKER_V1,
  AUDIT_COMMAND_END_MARKER_V1,
  AuditControllerAdapterError,
  createAuditControllerAdapterV1,
} from '../src/audit-controller-adapter-v1.mjs';

const controllerCommit = 'c'.repeat(40);
const skillReleaseIdentity = 'ai-auditor-deep-assurance-v6@16.13.0';
const pointer = Object.freeze({
  schemaVersion: 'deep-assurance-active-pointer-v2',
  projectSlug: 'vlsdt',
  status: 'ACTIVE',
  launchAuthorized: true,
  campaignId: 'camp-v1',
  campaignGenerationId: 'gen-v1',
  controllerBranch: 'campaign/vlsdt-v20-v1',
  workspacePath: 'campaigns/CurveYield-vlSDT-v20/',
  mailboxIssueNumber: 171,
  projectionPath: 'campaigns/CurveYield-vlSDT-v20/HOSTED-OPERATOR-STATE-v1.json',
  controllerCommit,
  skillReleaseIdentity,
});
const projection = Object.freeze({
  schemaVersion: 'hosted-operator-state-v1',
  controllerStateSchemaVersion: 2,
  compatibility: {
    controllerCommit,
    controllerRelease: 'audit-controller@hosted-tier3-v1',
    skillReleaseIdentity,
    automationRelease: 'contract-automation@round5-tier3-v1',
  },
  campaign: {
    campaignId: 'camp-v1',
    processId: 'deep-assurance-v6',
    title: 'vlSDT audit',
    status: 'ACTIVE',
    completionStatus: null,
    securityVerdict: null,
    terminalReason: null,
    source: { repository: 'CurveYield/Audits', commit: 'a'.repeat(40), revision: 1 },
    preflight: { status: 'READY', capabilities: { 'github-mailbox-v1': true } },
    instructionPolicyRequired: true,
    createdAt: '2026-08-07T20:00:00.000Z',
    updatedAt: '2026-08-07T20:10:00.000Z',
  },
  topology: { gateIds: [], laneRoleIds: [] },
  gates: [], workers: [], assignments: [], instructionProofs: [], findings: [],
  remediation: null, report: null,
  publication: { status: 'PENDING' }, userDelivery: { status: 'PENDING' }, events: [],
});

function encoded(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function githubContent(value, status = 200) {
  return new Response(JSON.stringify({ encoding: 'base64', content: encoded(value), size: JSON.stringify(value).length }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function adapter(fetcher) {
  return createAuditControllerAdapterV1({
    fetcher,
    token: 'github-token-never-render',
    owner: 'CurveYield',
    repo: 'audit-controller',
    mainRef: 'main',
    expectedControllerCommit: controllerCommit,
    expectedSkillReleaseIdentity: skillReleaseIdentity,
    automationRelease: 'contract-automation@round5-tier3-v1',
  });
}

test('getProject reads the active pointer and exact campaign projection with release binding', async () => {
  const urls = [];
  const api = adapter(async (url, init) => {
    urls.push(String(url));
    assert.equal(init.headers.authorization, 'Bearer github-token-never-render');
    if (String(url).includes('.deep-assurance/active/vlsdt.json')) return githubContent(pointer);
    if (String(url).includes('HOSTED-OPERATOR-STATE-v1.json')) return githubContent(projection);
    throw new Error(`unexpected URL ${url}`);
  });

  const result = await api.getProject('vlsdt');
  assert.equal(result.pointer.campaignId, 'camp-v1');
  assert.equal(result.projection.campaign.status, 'ACTIVE');
  assert.equal(result.projection.compatibility.controllerCommit, controllerCommit);
  assert.equal(urls.length, 2);
  assert.match(urls[0], /ref=main/);
  assert.match(urls[1], /ref=campaign%2Fvlsdt-v20-v1/);
});

test('getProject returns a bounded inactive result for a NO_ACTIVE_CAMPAIGN tombstone', async () => {
  const tombstone = {
    schemaVersion: 'deep-assurance-active-pointer-tombstone-v1',
    projectSlug: 'vlsdt',
    status: 'NO_ACTIVE_CAMPAIGN',
    reason: 'FULL_RESTART_REQUESTED',
    launchAuthorized: false,
    allPriorGenerationsAdmissible: false,
    scrubCommit: 'd'.repeat(40),
  };
  const api = adapter(async () => githubContent(tombstone));
  const result = await api.getProject('vlsdt');
  assert.deepEqual(result, {
    pointer: tombstone,
    projection: null,
    status: 'NO_ACTIVE_CAMPAIGN',
  });
});

test('getProject rejects malformed slugs, unsafe projection paths and release mismatches', async () => {
  const api = adapter(async (url) => {
    if (String(url).includes('.deep-assurance/active/')) return githubContent({ ...pointer, projectionPath: '../secret.json' });
    return githubContent(projection);
  });
  await assert.rejects(() => api.getProject('../vlsdt'), /project slug/i);
  await assert.rejects(() => api.getProject('vlsdt'), /projection path/i);

  const mismatch = adapter(async (url) => {
    if (String(url).includes('.deep-assurance/active/')) return githubContent(pointer);
    return githubContent({ ...projection, compatibility: { ...projection.compatibility, controllerCommit: 'e'.repeat(40) } });
  });
  await assert.rejects(() => mismatch.getProject('vlsdt'), /controller commit/i);
});

test('GitHub authorization failures are normalized without reflecting response bodies or tokens', async () => {
  const api = adapter(async () => new Response(JSON.stringify({ message: 'private upstream detail token=abc' }), { status: 403 }));
  await assert.rejects(async () => {
    try {
      await api.getProject('vlsdt');
    } catch (error) {
      assert.ok(error instanceof AuditControllerAdapterError);
      assert.equal(error.code, 'github_forbidden');
      assert.equal(error.status, 502);
      assert.equal(error.message.includes('private upstream detail'), false);
      assert.equal(error.message.includes('github-token-never-render'), false);
      throw error;
    }
  }, /audit controller GitHub request failed/i);
});

test('submitCommand posts exactly one canonical v1 envelope to the pointer-bound mailbox issue', async () => {
  let posted = null;
  const api = adapter(async (url, init) => {
    const text = String(url);
    if (text.includes('.deep-assurance/active/vlsdt.json')) return githubContent(pointer);
    if (text.includes('HOSTED-OPERATOR-STATE-v1.json')) return githubContent(projection);
    if (text.endsWith('/issues/171/comments')) {
      posted = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: 9001, html_url: 'https://github.invalid/private/comment' }), { status: 201 });
    }
    throw new Error(`unexpected URL ${url}`);
  });

  const command = {
    schemaVersion: 1,
    commandId: 'cmd-1',
    type: 'assignment.claim',
    actor: { type: 'worker', id: 'worker-1' },
    payload: {
      assignmentId: 'assignment-1',
      workerId: 'worker-1',
      leaseToken: 'transient-lease-token',
      instructionScope: { sessionId: 'session-1', roleId: 'manual-implementation-auditor', phaseId: 'manual-implementation-review' },
    },
  };
  const result = await api.submitCommand({ projectSlug: 'vlsdt', command });

  assert.deepEqual(result, { accepted: true, commentId: 9001, commandId: 'cmd-1' });
  assert.ok(posted);
  assert.equal((posted.body.match(new RegExp(AUDIT_COMMAND_BEGIN_MARKER_V1, 'g')) ?? []).length, 1);
  assert.equal((posted.body.match(new RegExp(AUDIT_COMMAND_END_MARKER_V1, 'g')) ?? []).length, 1);
  assert.ok(posted.body.startsWith(`${AUDIT_COMMAND_BEGIN_MARKER_V1}\n`));
  assert.ok(posted.body.endsWith(`\n${AUDIT_COMMAND_END_MARKER_V1}`));
  assert.match(posted.body, /"commandId":"cmd-1"/);
  assert.equal(result.htmlUrl, undefined);
});

test('submitCommand rejects unsafe command shapes and marker injection before GitHub mutation', async () => {
  let calls = 0;
  const api = adapter(async () => { calls += 1; return githubContent(pointer); });
  await assert.rejects(() => api.submitCommand({
    projectSlug: 'vlsdt',
    command: { schemaVersion: 1, commandId: 'cmd-1', type: 'x', actor: { type: 'controller', id: 'c' }, payload: { note: AUDIT_COMMAND_BEGIN_MARKER_V1 } },
  }), /marker/i);
  assert.equal(calls, 0);

  const polluted = JSON.parse('{"schemaVersion":1,"commandId":"cmd-2","type":"x","actor":{"type":"controller","id":"c"},"payload":{"__proto__":{"admin":true}}}');
  await assert.rejects(() => api.submitCommand({ projectSlug: 'vlsdt', command: polluted }), /forbidden key/i);
  assert.equal(calls, 0);
});
