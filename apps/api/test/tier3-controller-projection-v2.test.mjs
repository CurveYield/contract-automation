import test from 'node:test';
import assert from 'node:assert/strict';
import {
  controllerCompatibilityResponseV2,
  controllerProjectionResponseV2
} from '../src/tier3-controller-adapter-v2.mjs';

const PROTOCOL_SHA = '2222222222222222222222222222222222222222';
const STATE_SHA = '3333333333333333333333333333333333333333';
const AUTOMATION_SHA = '4444444444444444444444444444444444444444';
const projection = {
  adapterVersion: 'tier3-controller-adapter-v2',
  controllerRelease: 'ai-auditor-deep-assurance-v6@16.13.0',
  controllerProtocolSha: PROTOCOL_SHA,
  automationRelease: AUTOMATION_SHA,
  networkScope: { active: ['ethereum', 'base'], default: 'base' },
  campaign: { id: 'cmp_1', status: 'ACTIVE', completionStatus: null, securityVerdict: null },
  phases: [], lanes: [], instructionProofs: [], findings: [], remediation: [], evidence: [],
  report: { complete: false, exactRelease: null }
};

const env = {
  AUDIT_CONTROLLER_GITHUB_TOKEN: 'secret',
  AUDIT_CONTROLLER_PROTOCOL_SHA: PROTOCOL_SHA,
  AUDIT_CONTROLLER_STATE_REF: 'main',
  AUTOMATION_RELEASE_SHA: AUTOMATION_SHA
};

function fetcher({ branchStatus = 200, projectionStatus = 200, value = projection } = {}) {
  return async (url, init) => {
    assert.equal(init.headers.authorization, 'Bearer secret');
    const text = String(url);
    if (text.endsWith('/repos/CurveYield/audit-controller/commits/main')) {
      return new Response(JSON.stringify(branchStatus === 200 ? { sha: STATE_SHA } : { message: 'private branch error' }), {
        status: branchStatus,
        headers: { 'content-type': 'application/json' }
      });
    }
    assert.match(text, new RegExp(`contents/hosted-projections/v2/cmp_1\\.json\\?ref=${STATE_SHA}$`));
    return new Response(JSON.stringify(projectionStatus === 200 ? {
      content: Buffer.from(JSON.stringify(value)).toString('base64'), encoding: 'base64'
    } : { message: 'private projection error' }), {
      status: projectionStatus,
      headers: { 'content-type': 'application/json' }
    });
  };
}

test('compatibility exposes immutable protocol sha and mutable state ref separately', async () => {
  const response = await controllerCompatibilityResponseV2(env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.controllerProtocolSha, PROTOCOL_SHA);
  assert.equal(body.controllerStateRef, 'main');
});

test('resolves state ref once and fetches projection at exact commit', async () => {
  const response = await controllerProjectionResponseV2('cmp_1', env, fetcher());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.controllerStateCommit, STATE_SHA);
  assert.equal(body.projection.campaign.id, 'cmp_1');
});

test('rejects projection built for another controller protocol sha', async () => {
  const response = await controllerProjectionResponseV2('cmp_1', env, fetcher({
    value: { ...projection, controllerProtocolSha: '5555555555555555555555555555555555555555' }
  }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'controller_projection_incompatible');
});

test('redacts state-ref resolution failure', async () => {
  const response = await controllerProjectionResponseV2('cmp_1', env, fetcher({ branchStatus: 403 }));
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /private branch error/);
});
