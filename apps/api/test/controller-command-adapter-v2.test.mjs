import test from 'node:test';
import assert from 'node:assert/strict';
import { handleControllerCommandRouteV2 } from '../src/controller-command-adapter-v2.mjs';

const activePointer = {
  schemaVersion: 'deep-assurance-active-pointer-v2',
  projectSlug: 'vlsdt', campaignId: 'vlsdt-a47590c4dd9f68b7', campaignGenerationId: 'gen-v1', phaseSequence: 0,
  status: 'ACTIVE', launchAuthorized: false, priorGenerationsAdmissible: false,
  sourceRepository: 'CurveYield/Audits', sourceCommit: '7'.repeat(40), sourceArchiveSha256: '4'.repeat(64),
  controllerCampaignCreateReceipt: 'campaigns/CurveYield-vlSDT-v20/control/CONTROLLER_CAMPAIGN_CREATE_RECEIPT-v1.json',
  requiredSkillPackageVersion: '16.14.0', requiredEmbeddedReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.14.0',
};
const tombstone = {
  schemaVersion: 'deep-assurance-active-pointer-tombstone-v1', projectSlug: 'new-project', status: 'NO_ACTIVE_CAMPAIGN',
  launchAuthorized: false, allPriorGenerationsAdmissible: false, reason: 'NO_ACTIVE_CAMPAIGN', scrubCommit: 'a'.repeat(40),
};

function envelope(value) {
  return new Response(JSON.stringify({ encoding: 'base64', content: Buffer.from(JSON.stringify(value)).toString('base64') }), { status: 200 });
}
function command(type = 'gate.record') {
  return { schemaVersion: 1, commandId: `cmd-${type}`, type, actor: { type: 'controller', id: 'orchestrator' }, payload: {} };
}
function request(projectSlug, value) {
  return new Request('https://api.example/api/v1/controller/commands', {
    method: 'POST', headers: { authorization: 'Bearer client-key', 'content-type': 'application/json' },
    body: JSON.stringify({ projectSlug, command: value }),
  });
}

function makeEnv(pointer, onPost = () => {}) {
  return {
    CLIENT_API_KEY: 'client-key', AUDIT_CONTROLLER_GITHUB_TOKEN: 'controller-token', AUDIT_CONTROLLER_INTAKE_ISSUE: '64',
    CORS_ORIGIN: 'https://preflight.curveyield.online',
    AUDIT_CONTROLLER_FETCH: async (url, init = {}) => {
      if (init.method === 'POST') { onPost(url, init); return new Response('{}', { status: 201 }); }
      return envelope(pointer);
    },
  };
}

test('Phase 0 active campaign rejects substantive command before any GitHub mutation', async () => {
  let posts = 0;
  const response = await handleControllerCommandRouteV2(request('vlsdt', command('gate.record')), makeEnv(activePointer, () => { posts += 1; }));
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.error.code, 'controller_command_fenced');
  assert.equal(posts, 0);
});

test('campaign.create is rejected while current campaign exists even if launch is fenced', async () => {
  let posts = 0;
  const response = await handleControllerCommandRouteV2(request('vlsdt', command('campaign.create')), makeEnv(activePointer, () => { posts += 1; }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'controller_campaign_already_active');
  assert.equal(posts, 0);
});

test('legacy no-active tombstone still permits controller campaign.create only to trusted intake issue 64', async () => {
  let postedUrl = '';
  const response = await handleControllerCommandRouteV2(
    request('new-project', command('campaign.create')),
    makeEnv(tombstone, (url) => { postedUrl = String(url); }),
  );
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.target, 'controller-intake');
  assert.match(postedUrl, /\/issues\/64\/comments$/);
});

test('future launch-authorized v16.14 pointer without authoritative mailbox remains fail-closed', async () => {
  let posts = 0;
  const response = await handleControllerCommandRouteV2(
    request('vlsdt', command('gate.record')),
    makeEnv({ ...activePointer, launchAuthorized: true }, () => { posts += 1; }),
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'controller_mailbox_unpublished');
  assert.equal(posts, 0);
});
