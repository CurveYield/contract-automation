import test from 'node:test';
import assert from 'node:assert/strict';

async function loadAdapter() {
  try { return await import('../src/tier3-controller-adapter-v5.mjs'); }
  catch { return {}; }
}

const SHA = (digit) => digit.repeat(40);
const PROTOCOL_SHA = SHA('2');
const SOURCE_SHA = SHA('3');
const AUTOMATION_SHA = SHA('4');
const NEWER_SHA = SHA('5');
const projection = {
  projectionVersion: 'hosted-tier3-projection-v2',
  adapterVersion: 'tier3-controller-adapter-v4',
  controllerRelease: 'ai-auditor-deep-assurance-v6@16.13.0',
  controllerProtocolSha: PROTOCOL_SHA,
  automationRelease: AUTOMATION_SHA,
  campaignSource: { path: 'campaigns/CurveYield-example-v1', commit: SOURCE_SHA },
  networkScope: { active: ['ethereum', 'base'], default: 'base' },
  campaign: { id: 'cmp_1', status: 'ACTIVE', completionStatus: null, securityVerdict: null },
  phases: [], lanes: [], workers: [], assignments: [], instructionProofs: [], findings: [], remediation: [], evidence: [],
  provenance: { eventCount: 0, eventHead: null, recentEvents: [] },
  report: { complete: false, exactRelease: null }
};
const env = {
  AUDIT_CONTROLLER_GITHUB_TOKEN: 'secret', AUDIT_CONTROLLER_PROTOCOL_SHA: PROTOCOL_SHA,
  AUDIT_CONTROLLER_STATE_REF: 'main', AUTOMATION_RELEASE_SHA: AUTOMATION_SHA
};

function contentsResponse() {
  return new Response(JSON.stringify({ content: Buffer.from(JSON.stringify(projection)).toString('base64'), encoding: 'base64' }), { status: 200 });
}

function fetcherWithLatest(latestCommit) {
  return async (url) => {
    const value = String(url);
    if (value.includes('/contents/hosted-projections/v4/cmp_1.json?ref=')) return contentsResponse();
    if (value.includes('/commits?sha=main&path=campaigns%2FCurveYield-example-v1&per_page=1')) {
      return new Response(JSON.stringify([{ sha: latestCommit }]), { status: 200 });
    }
    throw new Error(`unexpected URL: ${value}`);
  };
}

test('accepts projection only when its campaign source commit is current', async () => {
  const { controllerProjectionResponseV5 } = await loadAdapter();
  assert.equal(typeof controllerProjectionResponseV5, 'function');
  const response = await controllerProjectionResponseV5('cmp_1', env, fetcherWithLatest(SOURCE_SHA));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.controllerCampaignCommit, SOURCE_SHA);
  assert.equal(body.projection.campaignSource.commit, SOURCE_SHA);
});

test('fails closed when campaign state advanced after projection publication', async () => {
  const { controllerProjectionResponseV5 } = await loadAdapter();
  assert.equal(typeof controllerProjectionResponseV5, 'function');
  const response = await controllerProjectionResponseV5('cmp_1', env, fetcherWithLatest(NEWER_SHA));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: { code: 'controller_projection_stale', message: 'Published controller projection is stale for the campaign' }
  });
});

test('fails closed when campaign freshness cannot be resolved', async () => {
  const { controllerProjectionResponseV5 } = await loadAdapter();
  assert.equal(typeof controllerProjectionResponseV5, 'function');
  const response = await controllerProjectionResponseV5('cmp_1', env, async (url) => {
    if (String(url).includes('/contents/hosted-projections/v4/cmp_1.json?ref=')) return contentsResponse();
    return new Response(JSON.stringify([]), { status: 200 });
  });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, 'controller_upstream_failed');
});
