import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/client.mjs';

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('client submits controller command capability only in POST body to campaign-bound route', async () => {
  const calls = [];
  const client = createApiClient({
    apiUrl: 'https://api.example.test/', apiKey: 'client-key',
    fetcher: async (url, init) => { calls.push({ url, init }); return response({ status: 'SUBMITTED_TO_CONTROLLER_MAILBOX' }, 202); }
  });
  const command = { schemaVersion: 1, commandId: 'cmd1', type: 'assignment.claim', actor: { type: 'worker', id: 'w1' }, payload: {} };
  await client.submitControllerCommand('cmp_1', 'auth1', 'capability-secret', command);
  assert.equal(calls[0].url, 'https://api.example.test/api/v1/controller/campaigns/cmp_1/commands');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(new Headers(calls[0].init.headers).get('authorization'), 'Bearer client-key');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body, { authorizationId: 'auth1', capabilityToken: 'capability-secret', command });
  assert.doesNotMatch(calls[0].url, /capability-secret|auth1/);
});
