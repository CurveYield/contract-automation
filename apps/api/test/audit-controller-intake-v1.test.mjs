import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuditControllerAdapterV1 } from '../src/audit-controller-adapter-v1.mjs';

const controllerCommit = 'c'.repeat(40);
const skillReleaseIdentity = 'ai-auditor-deep-assurance-v6@16.13.0';
const tombstone = Object.freeze({
  schemaVersion: 'deep-assurance-active-pointer-tombstone-v1',
  projectSlug: 'vlsdt',
  status: 'NO_ACTIVE_CAMPAIGN',
  reason: 'FULL_RESTART_REQUESTED',
  launchAuthorized: false,
  allPriorGenerationsAdmissible: false,
  scrubCommit: 'd'.repeat(40),
});
const activePointer = Object.freeze({
  schemaVersion: 'deep-assurance-active-pointer-v2', projectSlug: 'vlsdt', status: 'ACTIVE', launchAuthorized: true,
  campaignId: 'camp-v1', campaignGenerationId: 'gen-v1', controllerBranch: 'campaign/vlsdt-v20-v1',
  workspacePath: 'campaigns/CurveYield-vlSDT-v20/', mailboxIssueNumber: 171,
  projectionPath: 'campaigns/CurveYield-vlSDT-v20/HOSTED-OPERATOR-STATE-v1.json',
  controllerCommit, skillReleaseIdentity,
});

function encoded(value) { return Buffer.from(JSON.stringify(value)).toString('base64'); }
function content(value) {
  return new Response(JSON.stringify({ encoding: 'base64', content: encoded(value), size: JSON.stringify(value).length }), { status: 200 });
}
function create(fetcher, intakeIssueNumber = 64) {
  return createAuditControllerAdapterV1({
    fetcher,
    token: 'github-token-never-render',
    owner: 'CurveYield', repo: 'audit-controller', mainRef: 'main',
    expectedControllerCommit: controllerCommit,
    expectedSkillReleaseIdentity: skillReleaseIdentity,
    automationRelease: 'contract-automation@round5-tier3-v1',
    intakeIssueNumber,
  });
}
function campaignCreateCommand(overrides = {}) {
  return {
    schemaVersion: 1,
    commandId: 'create-1',
    type: 'campaign.create',
    actor: { type: 'controller', id: 'orchestrator-1' },
    payload: { processId: 'deep-assurance-v6', campaignId: 'camp-new', ...overrides },
  };
}

test('inactive project may post one campaign.create envelope to trusted intake issue', async () => {
  let posted = null;
  const api = create(async (url, init) => {
    const text = String(url);
    if (text.includes('.deep-assurance/active/vlsdt.json')) return content(tombstone);
    if (text.endsWith('/issues/64/comments')) {
      posted = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: 64001, html_url: 'https://github.invalid/private' }), { status: 201 });
    }
    throw new Error(`unexpected URL ${url}`);
  });
  const result = await api.submitCampaignCreate({ projectSlug: 'vlsdt', command: campaignCreateCommand() });
  assert.deepEqual(result, { accepted: true, commentId: 64001, commandId: 'create-1' });
  assert.match(posted.body, /CURVEYIELD_AUDIT_COMMAND_V1_BEGIN/);
  assert.match(posted.body, /"type":"campaign.create"/);
  assert.equal(result.htmlUrl, undefined);
  assert.equal(api.getCompatibility().campaignCreateAvailable, true);
  assert.equal('intakeIssueNumber' in api.getCompatibility(), false);
});

test('campaign intake rejects active projects before any intake mutation', async () => {
  let intakePosts = 0;
  const api = create(async (url) => {
    if (String(url).includes('.deep-assurance/active/vlsdt.json')) return content(activePointer);
    intakePosts += 1;
    return new Response('{}', { status: 201 });
  });
  await assert.rejects(() => api.submitCampaignCreate({ projectSlug: 'vlsdt', command: campaignCreateCommand() }), /active campaign/i);
  assert.equal(intakePosts, 0);
});

test('campaign intake rejects wrong type or actor before GitHub access', async () => {
  let calls = 0;
  const api = create(async () => { calls += 1; return content(tombstone); });
  await assert.rejects(() => api.submitCampaignCreate({
    projectSlug: 'vlsdt', command: { ...campaignCreateCommand(), type: 'campaign.activate' },
  }), /campaign\.create/i);
  await assert.rejects(() => api.submitCampaignCreate({
    projectSlug: 'vlsdt', command: { ...campaignCreateCommand(), actor: { type: 'worker', id: 'worker-1' } },
  }), /controller actor/i);
  assert.equal(calls, 0);
});

test('campaign intake is unavailable without trusted intake configuration', async () => {
  const api = create(async () => content(tombstone), null);
  assert.equal(api.getCompatibility().campaignCreateAvailable, false);
  await assert.rejects(() => api.submitCampaignCreate({ projectSlug: 'vlsdt', command: campaignCreateCommand() }), /not configured/i);
});
