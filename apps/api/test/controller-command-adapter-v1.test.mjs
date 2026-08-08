import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleControllerCommandRouteV1,
  renderControllerCommandEnvelopeV1,
} from '../src/controller-command-adapter-v1.mjs';

const CLIENT_KEY = 'client-secret';
const TOKEN = 'controller-github-secret';
const CONTROLLER_COMMIT = 'd4851886ece3e8793dcc2a99f97f6d34da10e1cd';
const SKILL_RELEASE = 'ai-auditor-deep-assurance-v6@16.13.0';

function env(overrides = {}) {
  return {
    CLIENT_API_KEY: CLIENT_KEY,
    GPT_API_KEY: 'gpt-secret',
    GITHUB_BRIDGE_API_KEY: 'bridge-secret',
    RUNNER_API_KEY: 'runner-secret',
    AUDIT_CONTROLLER_GITHUB_TOKEN: TOKEN,
    AUDIT_CONTROLLER_INTAKE_ISSUE: '64',
    CORS_ORIGIN: 'https://preflight.curveyield.online',
    ...overrides,
  };
}

function request(body, token = CLIENT_KEY) {
  return new Request('https://api.preflight.curveyield.online/api/v1/controller/commands', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function githubContent(value) {
  return new Response(JSON.stringify({
    encoding: 'base64',
    content: Buffer.from(JSON.stringify(value), 'utf8').toString('base64'),
    sha: 'a'.repeat(40),
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function tombstone() {
  return {
    schemaVersion: 'deep-assurance-active-pointer-tombstone-v1',
    projectSlug: 'vlsdt',
    status: 'NO_ACTIVE_CAMPAIGN',
    reason: 'FULL_RESTART_REQUESTED',
    launchAuthorized: false,
    allPriorGenerationsAdmissible: false,
    scrubCommit: 'e'.repeat(40),
  };
}

function activePointer() {
  return {
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
    controllerCommit: CONTROLLER_COMMIT,
    skillReleaseIdentity: SKILL_RELEASE,
  };
}

function createCommand() {
  return {
    schemaVersion: 1,
    commandId: 'create-1',
    type: 'campaign.create',
    actor: { type: 'controller', id: 'orchestrator' },
    payload: {
      requestedProjectSlug: 'vlsdt',
      title: 'New campaign',
      source: { repository: 'CurveYield/Audits', commit: '1'.repeat(40) },
    },
  };
}

function activeCommand(type = 'campaign.evaluate') {
  return {
    schemaVersion: 1,
    commandId: 'command-1',
    type,
    actor: { type: 'controller', id: 'orchestrator' },
    payload: {
      instructionScope: { sessionId: 'session-1', roleId: 'orchestrator', phaseId: 'release-and-report' },
      terminal: false,
    },
  };
}

test('renders exactly one canonical CURVEYIELD_AUDIT_COMMAND_V1 envelope', () => {
  const envelope = renderControllerCommandEnvelopeV1({
    payload: { z: 2, a: 1 },
    actor: { id: 'orchestrator', type: 'controller' },
    type: 'campaign.evaluate',
    commandId: 'command-1',
    schemaVersion: 1,
  });
  assert.equal(
    envelope,
    '<!-- CURVEYIELD_AUDIT_COMMAND_V1_BEGIN -->\n{"actor":{"id":"orchestrator","type":"controller"},"commandId":"command-1","payload":{"a":1,"z":2},"schemaVersion":1,"type":"campaign.evaluate"}\n<!-- CURVEYIELD_AUDIT_COMMAND_V1_END -->',
  );
});

test('campaign.create can queue only on configured intake issue when project pointer is a tombstone', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) return githubContent(tombstone());
    return new Response(JSON.stringify({ id: 999 }), { status: 201, headers: { 'content-type': 'application/json' } });
  };

  const response = await handleControllerCommandRouteV1(
    request({ projectSlug: 'vlsdt', command: createCommand() }),
    env({ AUDIT_CONTROLLER_FETCH: fakeFetch }),
  );
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    status: 'queued',
    commandId: 'create-1',
    commandType: 'campaign.create',
    target: 'controller-intake',
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://api.github.com/repos/CurveYield/audit-controller/issues/64/comments');
  const posted = JSON.parse(calls[1].init.body);
  assert.equal(posted.body, renderControllerCommandEnvelopeV1(createCommand()));
  assert.equal(calls[1].init.headers.authorization, `Bearer ${TOKEN}`);
});

test('campaign.create is rejected when an active campaign already exists', async () => {
  const response = await handleControllerCommandRouteV1(
    request({ projectSlug: 'vlsdt', command: createCommand() }),
    env({ AUDIT_CONTROLLER_FETCH: async () => githubContent(activePointer()) }),
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'controller_campaign_already_active');
});

test('active commands are rejected when no active campaign exists', async () => {
  const response = await handleControllerCommandRouteV1(
    request({ projectSlug: 'vlsdt', command: activeCommand() }),
    env({ AUDIT_CONTROLLER_FETCH: async () => githubContent(tombstone()) }),
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'controller_no_active_campaign');
});

test('active command queues only on the exact pointer-bound campaign mailbox', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) return githubContent(activePointer());
    return new Response(JSON.stringify({ id: 1000 }), { status: 201, headers: { 'content-type': 'application/json' } });
  };
  const command = activeCommand('campaign.evaluate');
  const response = await handleControllerCommandRouteV1(
    request({ projectSlug: 'vlsdt', command }),
    env({ AUDIT_CONTROLLER_FETCH: fakeFetch }),
  );
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    status: 'queued', commandId: 'command-1', commandType: 'campaign.evaluate', target: 'campaign-mailbox',
  });
  assert.equal(calls[1].url, 'https://api.github.com/repos/CurveYield/audit-controller/issues/171/comments');
  assert.equal(JSON.parse(calls[1].init.body).body, renderControllerCommandEnvelopeV1(command));
});

test('mailbox route rejects non-browser identities, caller-supplied targets, unsupported commands, and unsafe payload keys', async () => {
  const cases = [
    { body: { projectSlug: 'vlsdt', command: activeCommand() }, token: 'gpt-secret', code: 'unauthorized' },
    { body: { projectSlug: 'vlsdt', issueNumber: 999, command: activeCommand() }, token: CLIENT_KEY, code: 'invalid_controller_command_request' },
    { body: { projectSlug: 'vlsdt', command: activeCommand('arbitrary.shell') }, token: CLIENT_KEY, code: 'unsupported_controller_command' },
    { body: JSON.parse('{"projectSlug":"vlsdt","command":{"schemaVersion":1,"commandId":"x","type":"campaign.evaluate","actor":{"type":"controller","id":"orchestrator"},"payload":{"constructor":{"x":1}}}}'), token: CLIENT_KEY, code: 'invalid_controller_command_request' },
  ];
  for (const entry of cases) {
    const response = await handleControllerCommandRouteV1(request(entry.body, entry.token), env({ AUDIT_CONTROLLER_FETCH: async () => { throw new Error('must not fetch'); } }));
    assert.equal((await response.json()).error.code, entry.code);
  }
});

test('GitHub write failures are bounded and never expose token or upstream body', async () => {
  let calls = 0;
  const response = await handleControllerCommandRouteV1(
    request({ projectSlug: 'vlsdt', command: activeCommand() }),
    env({ AUDIT_CONTROLLER_FETCH: async () => {
      calls += 1;
      if (calls === 1) return githubContent(activePointer());
      return new Response(`RAW ${TOKEN}`, { status: 500 });
    } }),
  );
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.error.code, 'controller_command_queue_failed');
  assert.equal(JSON.stringify(body).includes(TOKEN), false);
  assert.equal(JSON.stringify(body).includes('RAW'), false);
});
