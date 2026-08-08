import test from 'node:test';
import assert from 'node:assert/strict';
import { controllerProjectionResponseV4 } from '../src/tier3-controller-adapter-v4.mjs';

const PROTOCOL_SHA = '2'.repeat(40), STATE_SHA = '3'.repeat(40), AUTOMATION_SHA = '4'.repeat(40);
const projection = {
  adapterVersion: 'tier3-controller-adapter-v3', controllerRelease: 'ai-auditor-deep-assurance-v6@16.13.0', controllerProtocolSha: PROTOCOL_SHA, automationRelease: AUTOMATION_SHA,
  networkScope: { active: ['ethereum', 'base'], default: 'base' }, campaign: { id: 'cmp_1', status: 'ACTIVE', completionStatus: null, securityVerdict: null },
  phases: [], lanes: [], workers: [], assignments: [], instructionProofs: [], findings: [], remediation: [], evidence: [],
  provenance: { eventCount: 1, eventHead: 'a'.repeat(64), recentEvents: [{ hash: 'a'.repeat(64), previousHash: null, commandId: 'c1', type: 'campaign.created', actor: { type: 'controller', id: 'o1' }, timestamp: '2026-08-08T01:00:00.000Z' }] },
  report: { complete: false, exactRelease: null }
};
const env = { AUDIT_CONTROLLER_GITHUB_TOKEN: 'secret', AUDIT_CONTROLLER_PROTOCOL_SHA: PROTOCOL_SHA, AUDIT_CONTROLLER_STATE_REF: 'main', AUTOMATION_RELEASE_SHA: AUTOMATION_SHA };
const fetcher = async (url) => String(url).endsWith('/commits/main')
  ? new Response(JSON.stringify({ sha: STATE_SHA }), { status: 200 })
  : new Response(JSON.stringify({ content: Buffer.from(JSON.stringify(projection)).toString('base64'), encoding: 'base64' }), { status: 200 });

test('accepts real 64-hex controller event hashes', async () => {
  const response = await controllerProjectionResponseV4('cmp_1', env, fetcher);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).projection.provenance.eventHead.length, 64);
});
