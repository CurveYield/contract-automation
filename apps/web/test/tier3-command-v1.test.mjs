import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApiClient } from '../src/client.mjs';
import {
  buildAuditCommandV1,
  deriveOperatorActionsV1,
} from '../src/tier3-model-v1.mjs';

function activeState() {
  return {
    campaign: { status: 'ACTIVE', instructionPolicyRequired: true },
    compatibility: { skillReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.13.0' },
    instructionProofs: [],
    assignments: [{
      assignmentId: 'assignment-1',
      roleId: 'manual-implementation-auditor',
      instructionPhaseId: 'manual-implementation-review',
      status: 'LEASED',
      assignedWorkerId: 'worker-1',
      leaseExpiresAt: '2026-08-07T22:00:00.000Z',
    }],
  };
}

test('buildAuditCommandV1 constructs the exact command envelope payload without persisting transient values', () => {
  const command = buildAuditCommandV1({
    commandId: 'cmd-1',
    type: 'assignment.submit',
    actorType: 'worker',
    actorId: 'worker-1',
    payload: { assignmentId: 'assignment-1', workerId: 'worker-1', summary: 'Complete', evidenceRefs: [] },
    instructionScope: { sessionId: 'session-1', roleId: 'manual-implementation-auditor', phaseId: 'manual-implementation-review' },
    leaseToken: 'lease-token-transient',
  });
  assert.deepEqual(command, {
    schemaVersion: 1,
    commandId: 'cmd-1',
    type: 'assignment.submit',
    actor: { type: 'worker', id: 'worker-1' },
    payload: {
      assignmentId: 'assignment-1', workerId: 'worker-1', summary: 'Complete', evidenceRefs: [],
      instructionScope: { sessionId: 'session-1', roleId: 'manual-implementation-auditor', phaseId: 'manual-implementation-review' },
      leaseToken: 'lease-token-transient',
    },
  });
});

test('buildAuditCommandV1 rejects incomplete scope, non-object payloads, and lease tokens embedded in JSON payload', () => {
  assert.throws(() => buildAuditCommandV1({ commandId: 'x', type: 'gate.record', actorType: 'controller', actorId: 'c', payload: [] }), /payload/i);
  assert.throws(() => buildAuditCommandV1({ commandId: 'x', type: 'gate.record', actorType: 'controller', actorId: 'c', payload: {}, instructionScope: { sessionId: 's', roleId: 'orchestrator' } }), /instruction scope/i);
  assert.throws(() => buildAuditCommandV1({ commandId: 'x', type: 'assignment.claim', actorType: 'worker', actorId: 'w', payload: { leaseToken: 'must-not-live-in-textarea' } }), /transient lease token/i);
});

test('proof bootstrap commands are advisory-allowed without a previously accepted proof but ordinary work is not', () => {
  const state = activeState();
  const scope = {
    actorType: 'worker', actorId: 'worker-1', sessionId: 'session-1', roleId: 'manual-implementation-auditor', phaseId: 'manual-implementation-review', now: '2026-08-07T21:00:00.000Z',
  };
  const proofRecord = deriveOperatorActionsV1(state, { ...scope, commandType: 'instruction_read_proof.record' });
  assert.equal(proofRecord.instructionAuthorization, 'BOOTSTRAP_EXEMPT');
  assert.equal(proofRecord.substantiveActionAdvisoryAllowed, true);

  const workerRegister = deriveOperatorActionsV1(state, { ...scope, commandType: 'worker.register' });
  assert.equal(workerRegister.instructionAuthorization, 'BOOTSTRAP_EXEMPT');
  assert.equal(workerRegister.substantiveActionAdvisoryAllowed, true);

  const ordinary = deriveOperatorActionsV1(state, { ...scope, commandType: 'gate.record' });
  assert.equal(ordinary.instructionAuthorization, 'MISSING');
  assert.equal(ordinary.substantiveActionAdvisoryAllowed, false);
});

test('API client posts inactive campaign.create through the dedicated campaigns endpoint with bearer auth', async () => {
  let call = null;
  const api = createApiClient({
    apiUrl: 'https://api.example', apiKey: 'client-key',
    fetcher: async (url, init) => {
      call = { url: String(url), init };
      return new Response(JSON.stringify({ accepted: true, commentId: 64, commandId: 'create-1' }), { status: 202 });
    },
  });
  const command = { schemaVersion: 1, commandId: 'create-1', type: 'campaign.create', actor: { type: 'controller', id: 'orchestrator-1' }, payload: {} };
  const result = await api.submitAuditCampaignCreate('vlsdt', command);
  assert.equal(call.url, 'https://api.example/api/v1/audit/projects/vlsdt/campaigns');
  assert.equal(new Headers(call.init.headers).get('authorization'), 'Bearer client-key');
  assert.deepEqual(JSON.parse(call.init.body), { command });
  assert.deepEqual(result, { accepted: true, commentId: 64, commandId: 'create-1' });
});

test('Tier 3 operator exposes transient command fields and never persists lease tokens in browser storage', () => {
  const html = readFileSync(new URL('../public/audit-v1.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../public/audit-v1.js', import.meta.url), 'utf8');
  for (const id of ['audit-command-form', 'command-id', 'command-type', 'actor-type', 'actor-id', 'scope-session-id', 'scope-role-id', 'scope-phase-id', 'lease-token', 'command-payload', 'submit-command', 'command-status']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing ${id}`);
  }
  assert.match(html, /id="lease-token"[^>]*type="password"/);
  assert.match(script, /submitAuditCommand/);
  assert.match(script, /submitAuditCampaignCreate/);
  assert.match(script, /leaseToken\.value\s*=\s*['"]['"]/);
  assert.doesNotMatch(script, /localStorage|sessionStorage/);
  assert.doesNotMatch(script, /api\.github\.com/);
});
