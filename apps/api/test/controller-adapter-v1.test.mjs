import test from 'node:test';
import assert from 'node:assert/strict';
import {
  controllerSetupReadinessV1,
  handleControllerRouteV1,
} from '../src/controller-adapter-v1.mjs';

const CLIENT_KEY = 'client-secret';
const CONTROLLER_TOKEN = 'controller-github-secret';
const CONTROLLER_COMMIT = 'd4851886ece3e8793dcc2a99f97f6d34da10e1cd';
const CONTROLLER_RELEASE = 'audit-controller@hosted-tier3-v1';
const SKILL_RELEASE = 'ai-auditor-deep-assurance-v6@16.13.0';
const AUTOMATION_RELEASE = 'contract-automation@round5-tier3-v1';

function env(overrides = {}) {
  return {
    CLIENT_API_KEY: CLIENT_KEY,
    GPT_API_KEY: 'gpt-secret',
    GITHUB_BRIDGE_API_KEY: 'bridge-secret',
    RUNNER_API_KEY: 'runner-secret',
    AUDIT_CONTROLLER_GITHUB_TOKEN: CONTROLLER_TOKEN,
    CORS_ORIGIN: 'https://preflight.curveyield.online',
    ...overrides,
  };
}

function request(path, token = CLIENT_KEY) {
  return new Request(`https://api.preflight.curveyield.online${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function githubContent(value) {
  return new Response(JSON.stringify({
    encoding: 'base64',
    content: Buffer.from(`${JSON.stringify(value)}\n`, 'utf8').toString('base64'),
    sha: 'a'.repeat(40),
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function activePointer(overrides = {}) {
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
    ...overrides,
  };
}

function hostedProjection(overrides = {}) {
  return {
    schemaVersion: 'hosted-operator-state-v1',
    controllerStateSchemaVersion: 2,
    compatibility: {
      controllerCommit: CONTROLLER_COMMIT,
      controllerRelease: CONTROLLER_RELEASE,
      skillReleaseIdentity: SKILL_RELEASE,
      automationRelease: AUTOMATION_RELEASE,
    },
    campaign: {
      campaignId: 'camp-v1',
      processId: 'deep-assurance-v6',
      title: 'Tier 3 campaign',
      status: 'ACTIVE',
      completionStatus: null,
      securityVerdict: null,
      terminalReason: null,
      source: { repository: 'CurveYield/Audits', commit: '2'.repeat(40), revision: 1 },
      preflight: { status: 'READY', capabilities: { 'github-mailbox-v1': true } },
      instructionPolicyRequired: true,
      createdAt: '2026-08-08T04:00:00.000Z',
      updatedAt: '2026-08-08T04:15:00.000Z',
    },
    topology: {
      gateIds: ['manual-review-complete'],
      laneRoleIds: ['manual-implementation-auditor'],
    },
    gates: [{
      gateId: 'manual-review-complete',
      phaseId: 'manual-implementation-review',
      title: 'Manual review',
      mandatory: true,
      status: 'MEDIUM_ISSUE_FOUND',
      evidenceRefCount: 2,
      recordedAt: '2026-08-08T04:10:00.000Z',
    }],
    workers: [{
      workerId: 'worker-1',
      roleId: 'manual-implementation-auditor',
      capabilities: ['browser-agent-review-v1'],
      session: {
        productSurface: 'chatgpt-web',
        model: 'gpt-5.6-sol',
        sessionId: 'session-1',
        priorMaterialVisibility: 'clean-room',
        independenceClassification: 'isolated-correlated-ai-review',
      },
      registeredAt: '2026-08-08T04:02:00.000Z',
    }],
    assignments: [{
      assignmentId: 'assignment-1',
      roleId: 'manual-implementation-auditor',
      title: 'Manual implementation review',
      mandatory: true,
      status: 'SUBMITTED',
      requiredCapabilities: ['browser-agent-review-v1'],
      requiredEvidenceClasses: ['manual-review'],
      promptVersion: 'v1',
      cleanRoom: true,
      controllerOwned: false,
      instructionPhaseId: 'manual-implementation-review',
      revision: 1,
      sourceRevision: 1,
      assignedWorkerId: 'worker-1',
      leaseStartedAt: '2026-08-08T04:03:00.000Z',
      leaseExpiresAt: '2026-08-08T05:03:00.000Z',
      submission: {
        workerId: 'worker-1',
        controllerId: null,
        summary: 'One medium issue found.',
        sourceRevision: 1,
        evidenceRefCount: 2,
        submittedAt: '2026-08-08T04:12:00.000Z',
      },
      review: null,
      reviewCount: 0,
      invalidationCount: 0,
      publishedAt: '2026-08-08T04:03:00.000Z',
    }],
    instructionProofs: [{
      proofKey: 'worker-1|session-1|manual-implementation-auditor|manual-implementation-review',
      skillReleaseIdentity: SKILL_RELEASE,
      actorType: 'worker',
      actorId: 'worker-1',
      sessionId: 'session-1',
      roleId: 'manual-implementation-auditor',
      phaseId: 'manual-implementation-review',
      aggregateInstructionSetDigest: 'b'.repeat(64),
      acknowledgedAt: '2026-08-08T04:01:00.000Z',
    }],
    findings: [{
      findingId: 'F-1',
      title: 'Medium finding',
      severity: 'MEDIUM',
      status: 'UNRESOLVED',
      phaseId: 'manual-implementation-review',
      assignmentId: 'assignment-1',
      remediationStatus: 'PENDING',
    }],
    remediation: { status: 'PENDING', unresolvedHighCriticalCount: 0, reviewedAt: null },
    report: null,
    publication: { status: 'PENDING' },
    userDelivery: { status: 'PENDING' },
    events: [{
      sequence: 7,
      hash: '1'.repeat(64),
      previousHash: '3'.repeat(64),
      commandId: 'command-7',
      type: 'assignment.submitted',
      actor: { type: 'worker', id: 'worker-1' },
      timestamp: '2026-08-08T04:12:00.000Z',
    }],
    ...overrides,
  };
}

test('readiness requires browser API auth and a dedicated audit-controller GitHub token', () => {
  assert.deepEqual(controllerSetupReadinessV1(env()), {
    status: 'ready',
    features: {
      browserApiAuth: true,
      auditControllerGithub: true,
    },
    controller: {
      repository: 'CurveYield/audit-controller',
      ref: 'main',
      compatibilityCommit: CONTROLLER_COMMIT,
      releaseIdentity: CONTROLLER_RELEASE,
      processId: 'deep-assurance-v6',
      instructionReleaseIdentity: SKILL_RELEASE,
    },
  });

  assert.equal(controllerSetupReadinessV1(env({ AUDIT_CONTROLLER_GITHUB_TOKEN: undefined })).status, 'configuration_required');
  assert.equal(controllerSetupReadinessV1(env({ CLIENT_API_KEY: undefined })).status, 'configuration_required');
});

test('controller routes accept only the browser client identity', async () => {
  for (const token of [null, 'gpt-secret', 'bridge-secret', 'runner-secret', 'wrong']) {
    const response = await handleControllerRouteV1(request('/api/v1/controller/compatibility', token), env());
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: { code: 'unauthorized', message: 'Valid browser client authentication is required' },
    });
  }

  const accepted = await handleControllerRouteV1(request('/api/v1/controller/compatibility'), env());
  assert.equal(accepted.status, 200);
});

test('compatibility route exposes exact hosted releases and Ethereum/Base scope without secrets', async () => {
  const response = await handleControllerRouteV1(request('/api/v1/controller/compatibility'), env());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://preflight.curveyield.online');
  const body = await response.json();
  assert.equal(body.adapterVersion, 'tier3-controller-adapter-v1');
  assert.equal(body.controller.repository, 'CurveYield/audit-controller');
  assert.equal(body.controller.compatibilityCommit, CONTROLLER_COMMIT);
  assert.equal(body.controller.releaseIdentity, CONTROLLER_RELEASE);
  assert.equal(body.controller.instructionReleaseIdentity, SKILL_RELEASE);
  assert.equal(body.automation.releaseIdentity, AUTOMATION_RELEASE);
  assert.deepEqual(body.networkScope, { chains: ['ethereum', 'base'], defaultChain: 'base' });
  assert.equal(JSON.stringify(body).includes(CONTROLLER_TOKEN), false);
});

test('tombstone project route reads only the fixed main-branch active pointer path', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return githubContent({
      schemaVersion: 'deep-assurance-active-pointer-tombstone-v1',
      projectSlug: 'vlsdt',
      status: 'NO_ACTIVE_CAMPAIGN',
      reason: 'FULL_RESTART_REQUESTED',
      launchAuthorized: false,
      allPriorGenerationsAdmissible: false,
      scrubCommit: 'e077259bb589f98df4da903fd38e5f1990ce893d',
    });
  };

  const response = await handleControllerRouteV1(
    request('/api/v1/controller/projects/vlsdt'),
    env({ AUDIT_CONTROLLER_FETCH: fakeFetch }),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.project, {
    projectSlug: 'vlsdt',
    status: 'NO_ACTIVE_CAMPAIGN',
    reason: 'FULL_RESTART_REQUESTED',
    launchAuthorized: false,
    allPriorGenerationsAdmissible: false,
    scrubCommit: 'e077259bb589f98df4da903fd38e5f1990ce893d',
  });
  assert.equal(body.campaign, null);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://api.github.com/repos/CurveYield/audit-controller/contents/.deep-assurance/active/vlsdt.json?ref=main',
  );
  assert.equal(calls[0].options.headers.authorization, `Bearer ${CONTROLLER_TOKEN}`);
});

test('active project reads only the pointer-bound hosted projection and returns its bounded Tier 3 state', async () => {
  const calls = [];
  const pointer = activePointer();
  const projection = hostedProjection();
  const fakeFetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return calls.length === 1 ? githubContent(pointer) : githubContent(projection);
  };

  const response = await handleControllerRouteV1(
    request('/api/v1/controller/projects/vlsdt'),
    env({ AUDIT_CONTROLLER_FETCH: fakeFetch }),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.project, {
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
  });
  assert.equal(body.campaign.schemaVersion, 'hosted-operator-state-v1');
  assert.equal(body.campaign.campaign.campaignId, 'camp-v1');
  assert.equal(body.campaign.gates[0].status, 'MEDIUM_ISSUE_FOUND');
  assert.equal(body.campaign.assignments[0].submission.evidenceRefCount, 2);
  assert.equal(body.campaign.instructionProofs[0].skillReleaseIdentity, SKILL_RELEASE);
  assert.equal(body.campaign.findings[0].severity, 'MEDIUM');
  assert.equal(body.campaign.remediation.unresolvedHighCriticalCount, 0);
  assert.equal(body.campaign.report, null);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://api.github.com/repos/CurveYield/audit-controller/contents/campaigns/CurveYield-vlSDT-v20/HOSTED-OPERATOR-STATE-v1.json?ref=campaign%2Fvlsdt-v20-v1');
  assert.equal(JSON.stringify(body).includes('leaseToken'), false);
  assert.equal(JSON.stringify(body).includes('promptHash'), false);
  assert.equal(JSON.stringify(body).includes('evidenceRefs'), false);
});

test('active project rejects pointer/projection compatibility, campaign, and route mismatches', async () => {
  const cases = [
    { pointer: activePointer({ controllerCommit: '1'.repeat(40) }), projection: hostedProjection() },
    { pointer: activePointer(), projection: hostedProjection({ compatibility: { ...hostedProjection().compatibility, automationRelease: 'wrong-release' } }) },
    { pointer: activePointer(), projection: hostedProjection({ campaign: { ...hostedProjection().campaign, campaignId: 'other-campaign' } }) },
    { pointer: activePointer({ projectionPath: 'campaigns/Other/HOSTED-OPERATOR-STATE-v1.json' }), projection: hostedProjection() },
    { pointer: activePointer({ controllerBranch: '../main' }), projection: hostedProjection() },
  ];

  for (const entry of cases) {
    let call = 0;
    const response = await handleControllerRouteV1(
      request('/api/v1/controller/projects/vlsdt'),
      env({ AUDIT_CONTROLLER_FETCH: async () => {
        call += 1;
        return call === 1 ? githubContent(entry.pointer) : githubContent(entry.projection);
      } }),
    );
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'controller_pointer_incompatible');
  }
});

test('invalid project slugs fail before any GitHub request', async () => {
  let called = false;
  const response = await handleControllerRouteV1(
    request('/api/v1/controller/projects/..%2Fsecret'),
    env({ AUDIT_CONTROLLER_FETCH: async () => { called = true; throw new Error('must not run'); } }),
  );
  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.equal((await response.json()).error.code, 'invalid_project_slug');
});

test('missing token and upstream failures are fail-closed and never expose raw error bodies or credentials', async () => {
  const missing = await handleControllerRouteV1(
    request('/api/v1/controller/projects/vlsdt'),
    env({ AUDIT_CONTROLLER_GITHUB_TOKEN: undefined }),
  );
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).error.code, 'controller_configuration_required');

  const upstream = await handleControllerRouteV1(
    request('/api/v1/controller/projects/vlsdt'),
    env({ AUDIT_CONTROLLER_FETCH: async () => new Response('SECRET RAW BODY', { status: 500 }) }),
  );
  assert.equal(upstream.status, 502);
  const body = await upstream.json();
  assert.deepEqual(body, {
    error: { code: 'controller_upstream_unavailable', message: 'The audit controller could not be read safely' },
  });
  assert.equal(JSON.stringify(body).includes('SECRET RAW BODY'), false);
  assert.equal(JSON.stringify(body).includes(CONTROLLER_TOKEN), false);
});
