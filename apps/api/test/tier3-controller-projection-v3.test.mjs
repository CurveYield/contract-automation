import test from 'node:test';
import assert from 'node:assert/strict';
import { controllerProjectionResponseV3 } from '../src/tier3-controller-adapter-v3.mjs';

const PROTOCOL_SHA = '2222222222222222222222222222222222222222';
const STATE_SHA = '3333333333333333333333333333333333333333';
const AUTOMATION_SHA = '4444444444444444444444444444444444444444';
const projection = {
  adapterVersion: 'tier3-controller-adapter-v3',
  controllerRelease: 'ai-auditor-deep-assurance-v6@16.13.0',
  controllerProtocolSha: PROTOCOL_SHA,
  automationRelease: AUTOMATION_SHA,
  networkScope: { active: ['ethereum', 'base'], default: 'base' },
  campaign: { id: 'cmp_1', status: 'ACTIVE', completionStatus: null, securityVerdict: null },
  phases: [], lanes: [], workers: [{ id: 'w1', roleId: 'scope-specification-auditor' }], assignments: [], instructionProofs: [], findings: [], remediation: [], evidence: [],
  provenance: { eventCount: 1, eventHead: '5555555555555555555555555555555555555555', recentEvents: [] },
  report: { complete: false, exactRelease: null }
};
const env = { AUDIT_CONTROLLER_GITHUB_TOKEN: 'secret', AUDIT_CONTROLLER_PROTOCOL_SHA: PROTOCOL_SHA, AUDIT_CONTROLLER_STATE_REF: 'main', AUTOMATION_RELEASE_SHA: AUTOMATION_SHA };

const fetcher = async (url) => {
  const text = String(url);
  if (text.endsWith('/commits/main')) return new Response(JSON.stringify({ sha: STATE_SHA }), { status: 200 });
  assert.match(text, /hosted-projections\/v3\/cmp_1\.json\?ref=3333333333333333333333333333333333333333$/);
  return new Response(JSON.stringify({ content: Buffer.from(JSON.stringify(projection)).toString('base64'), encoding: 'base64' }), { status: 200 });
};

test('returns exact state commit plus complete projection', async () => {
  const response = await controllerProjectionResponseV3('cmp_1', env, fetcher);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.controllerStateCommit, STATE_SHA);
  assert.equal(body.projection.workers[0].id, 'w1');
  assert.equal(body.projection.provenance.eventCount, 1);
});
