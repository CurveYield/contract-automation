import test from 'node:test';
import assert from 'node:assert/strict';
import {
  controllerCompatibilityResponseV1,
  controllerProjectionResponseV1
} from '../src/tier3-controller-adapter-v1.mjs';

const projection = {
  adapterVersion: 'tier3-controller-adapter-v1',
  controllerRelease: 'ai-auditor-deep-assurance-v6@16.13.0',
  automationRelease: '0123456789abcdef0123456789abcdef01234567',
  networkScope: { active: ['ethereum', 'base'], default: 'base' },
  campaign: { id: 'cmp_1', status: 'ACTIVE', completionStatus: null, securityVerdict: null },
  phases: [], lanes: [], instructionProofs: [], findings: [], remediation: [], evidence: [],
  report: { complete: false, exactRelease: null }
};

const env = {
  AUDIT_CONTROLLER_GITHUB_TOKEN: 'secret',
  AUDIT_CONTROLLER_REF: '853b77b92018f4e42068cef6def56f9902a02f27',
  AUTOMATION_RELEASE_SHA: projection.automationRelease
};

function githubFetcher(payload = projection, status = 200) {
  return async (url, init) => {
    assert.match(String(url), /repos\/CurveYield\/audit-controller\/contents\/hosted-projections\/v1\/cmp_1\.json/);
    assert.equal(init.headers.authorization, 'Bearer secret');
    const body = status === 200
      ? { content: Buffer.from(JSON.stringify(payload)).toString('base64'), encoding: 'base64' }
      : { message: 'private upstream detail' };
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
}

test('compatibility is fail closed without dedicated controller credential', async () => {
  const response = await controllerCompatibilityResponseV1({ ...env, AUDIT_CONTROLLER_GITHUB_TOKEN: '' });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, 'controller_not_configured');
});

test('projection fetch is pinned to audit-controller and normalizes state', async () => {
  const response = await controllerProjectionResponseV1('cmp_1', env, githubFetcher());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.campaign.id, 'cmp_1');
  assert.deepEqual(body.networkScope.active, ['ethereum', 'base']);
});

test('projection rejects unsafe campaign ids before GitHub fetch', async () => {
  let called = false;
  const response = await controllerProjectionResponseV1('../secrets', env, async () => { called = true; });
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test('upstream errors are redacted', async () => {
  const response = await controllerProjectionResponseV1('cmp_1', env, githubFetcher(null, 403));
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.error.code, 'controller_upstream_failed');
  assert.doesNotMatch(JSON.stringify(body), /private upstream detail/);
});
