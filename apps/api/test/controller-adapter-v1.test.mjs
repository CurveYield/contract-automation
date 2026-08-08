import test from 'node:test';
import assert from 'node:assert/strict';
import {
  controllerSetupReadinessV1,
  handleControllerRouteV1,
} from '../src/controller-adapter-v1.mjs';

const CLIENT_KEY = 'client-secret';
const CONTROLLER_TOKEN = 'controller-github-secret';
const CONTROLLER_COMMIT = '853b77b92018f4e42068cef6def56f9902a02f27';

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
      processId: 'deep-assurance-v6',
      instructionReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.13.0',
    },
  });

  assert.equal(controllerSetupReadinessV1(env({ AUDIT_CONTROLLER_GITHUB_TOKEN: undefined })).status, 'configuration_required');
  assert.equal(controllerSetupReadinessV1(env({ CLIENT_API_KEY: undefined })).status, 'configuration_required');
});

test('controller routes accept only the browser client identity', async () => {
  for (const token of [undefined, 'gpt-secret', 'bridge-secret', 'runner-secret', 'wrong']) {
    const response = await handleControllerRouteV1(request('/api/v1/controller/compatibility', token), env());
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: { code: 'unauthorized', message: 'Valid browser client authentication is required' },
    });
  }

  const accepted = await handleControllerRouteV1(request('/api/v1/controller/compatibility'), env());
  assert.equal(accepted.status, 200);
});

test('compatibility route exposes exact bounded release and Ethereum/Base scope without secrets', async () => {
  const response = await handleControllerRouteV1(request('/api/v1/controller/compatibility'), env());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://preflight.curveyield.online');
  const body = await response.json();
  assert.equal(body.adapterVersion, 'tier3-controller-adapter-v1');
  assert.equal(body.controller.repository, 'CurveYield/audit-controller');
  assert.equal(body.controller.compatibilityCommit, CONTROLLER_COMMIT);
  assert.equal(body.controller.instructionReleaseIdentity, 'ai-auditor-deep-assurance-v6@16.13.0');
  assert.deepEqual(body.networkScope, { chains: ['ethereum', 'base'], defaultChain: 'base' });
  assert.equal(JSON.stringify(body).includes(CONTROLLER_TOKEN), false);
});

test('project route reads only the fixed main-branch active pointer path', async () => {
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

test('active pointer projection is bounded and preserves exact authoritative branch/commit without enumerating the repository', async () => {
  const fakeFetch = async () => githubContent({
    schemaVersion: 'deep-assurance-active-pointer-v2',
    projectSlug: 'vlsdt',
    activeCampaignId: 'da6-vlsdt-v19-v1',
    campaignIssueNumber: 170,
    authoritativeControllerRepository: 'CurveYield/audit-controller',
    authoritativeControllerBranch: 'campaign/vlsdt-v19-v1',
    authoritativeControllerCommit: '1'.repeat(40),
    immutableLaunchManifestPath: '.deep-assurance/manifests/vlsdt-launch-manifest-v3.json',
    immutableLaunchManifestCommit: '1'.repeat(40),
    source: {
      repository: 'CurveYield/Audits',
      commit: '2'.repeat(40),
      zipSha256: '3'.repeat(64),
      zipBytes: 725591,
      permittedSourcePath: 'source/',
      canonicalZipPath: 'source.zip',
      revokedSegmentedPublicationCommit: '4'.repeat(40),
    },
    assignments: { agent0: 25 },
    mailboxes: { agent0: 'campaigns/x/mailboxes/agent-0/MAILBOX-v1.md' },
    genericRoleInstructionPaths: { numberedWorker: '.deep-assurance/roles/NUMBERED-WORKER-v1.md' },
    permittedBootstrapResources: ['one'],
    forbiddenResourceClasses: ['two'],
    pointerFailureStatus: 'BOOTSTRAP_POINTER_UNRESOLVED',
    cleanRoomLaunchMode: 'LIMITED',
    authorizedReplacementLaunches: [3, 4],
  });

  const response = await handleControllerRouteV1(
    request('/api/v1/controller/projects/vlsdt'),
    env({ AUDIT_CONTROLLER_FETCH: fakeFetch }),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.project, {
    projectSlug: 'vlsdt',
    status: 'ACTIVE',
    activeCampaignId: 'da6-vlsdt-v19-v1',
    campaignIssueNumber: 170,
    authoritativeControllerBranch: 'campaign/vlsdt-v19-v1',
    authoritativeControllerCommit: '1'.repeat(40),
    immutableLaunchManifestPath: '.deep-assurance/manifests/vlsdt-launch-manifest-v3.json',
    immutableLaunchManifestCommit: '1'.repeat(40),
    source: { repository: 'CurveYield/Audits', commit: '2'.repeat(40) },
  });
  assert.equal(Object.hasOwn(body.project, 'assignments'), false);
  assert.equal(Object.hasOwn(body.project, 'mailboxes'), false);
  assert.equal(Object.hasOwn(body.project.source, 'canonicalZipPath'), false);
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
