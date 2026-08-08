import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try { return await import('../src/tier3-controller-command-v1.mjs'); }
  catch { return {}; }
}

const authorization = {
  authorizationId: 'auth1', campaignId: 'cmp_1',
  actor: { type: 'worker', id: 'worker1' },
  sessionId: 'session1', roleId: 'scope-specification-auditor', phaseId: 'scope-and-provenance',
  mailboxIssueNumber: 321,
  allowedCommandTypes: ['instruction_read_proof.record', 'assignment.claim', 'assignment.submit']
};

function command(type, payload) {
  return { schemaVersion: 1, commandId: `cmd-${type}`, type, actor: authorization.actor, payload };
}

test('renders exact audit-controller command envelope markers', async () => {
  const { renderHostedControllerCommandV1, BEGIN_MARKER_V1, END_MARKER_V1 } = await loadModule();
  assert.equal(typeof renderHostedControllerCommandV1, 'function');
  const value = command('assignment.claim', {
    assignmentId: 'a1', workerId: 'worker1', leaseToken: 'lease-1',
    instructionScope: { sessionId: 'session1', roleId: 'scope-specification-auditor', phaseId: 'scope-and-provenance' }
  });
  const rendered = renderHostedControllerCommandV1(value, authorization);
  assert.match(rendered, new RegExp(BEGIN_MARKER_V1));
  assert.match(rendered, new RegExp(END_MARKER_V1));
  assert.match(rendered, /"type":"assignment.claim"/);
});

test('requires command actor and instruction scope to match hosted authorization', async () => {
  const { validateHostedControllerCommandV1 } = await loadModule();
  assert.equal(typeof validateHostedControllerCommandV1, 'function');
  const value = command('assignment.submit', {
    assignmentId: 'a1', workerId: 'worker1', leaseToken: 'lease-1', summary: 'done', evidenceRefs: [],
    instructionScope: { sessionId: 'session1', roleId: 'scope-specification-auditor', phaseId: 'scope-and-provenance' }
  });
  assert.equal(validateHostedControllerCommandV1(value, authorization).type, 'assignment.submit');
  assert.throws(() => validateHostedControllerCommandV1({ ...value, actor: { type: 'worker', id: 'worker2' } }, authorization), /actor/i);
  assert.throws(() => validateHostedControllerCommandV1({ ...value, payload: { ...value.payload, instructionScope: { ...value.payload.instructionScope, phaseId: 'phase-0' } } }, authorization), /instructionScope/i);
});

test('rejects commands not granted by the session capability or controller catalog', async () => {
  const { validateHostedControllerCommandV1 } = await loadModule();
  assert.equal(typeof validateHostedControllerCommandV1, 'function');
  const scope = { sessionId: 'session1', roleId: 'scope-specification-auditor', phaseId: 'scope-and-provenance' };
  assert.throws(() => validateHostedControllerCommandV1(command('campaign.evaluate', { terminal: true, instructionScope: scope }), authorization), /not allowed/i);
  assert.throws(() => validateHostedControllerCommandV1(command('shell.exec', { instructionScope: scope }), { ...authorization, allowedCommandTypes: ['shell.exec'] }), /unsupported command type/i);
});

test('binds worker identity fields for claim and submit', async () => {
  const { validateHostedControllerCommandV1 } = await loadModule();
  assert.equal(typeof validateHostedControllerCommandV1, 'function');
  const scope = { sessionId: 'session1', roleId: 'scope-specification-auditor', phaseId: 'scope-and-provenance' };
  assert.throws(() => validateHostedControllerCommandV1(command('assignment.claim', { assignmentId: 'a1', workerId: 'other', leaseToken: 'lease', instructionScope: scope }), authorization), /workerId/);
});

test('validates proof recording against the exact authorized actor session role and phase', async () => {
  const { validateHostedControllerCommandV1 } = await loadModule();
  assert.equal(typeof validateHostedControllerCommandV1, 'function');
  const proof = {
    actorType: 'worker', actorId: 'worker1', sessionId: 'session1', roleId: 'scope-specification-auditor', phaseId: 'scope-and-provenance'
  };
  assert.equal(validateHostedControllerCommandV1(command('instruction_read_proof.record', { proof }), authorization).type, 'instruction_read_proof.record');
  assert.throws(() => validateHostedControllerCommandV1(command('instruction_read_proof.record', { proof: { ...proof, sessionId: 'other' } }), authorization), /proof/i);
});

test('rejects unexpected top-level transport targeting fields', async () => {
  const { validateHostedControllerCommandV1 } = await loadModule();
  assert.equal(typeof validateHostedControllerCommandV1, 'function');
  const scope = { sessionId: 'session1', roleId: 'scope-specification-auditor', phaseId: 'scope-and-provenance' };
  const value = command('assignment.claim', { assignmentId: 'a1', workerId: 'worker1', leaseToken: 'lease', instructionScope: scope });
  assert.throws(() => validateHostedControllerCommandV1({ ...value, repository: 'attacker/repo' }, authorization), /unknown command field/i);
  assert.throws(() => validateHostedControllerCommandV1({ ...value, issueNumber: 999 }, authorization), /unknown command field/i);
});
