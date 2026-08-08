import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createApiClient } from '../src/client.mjs';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('browser client fetches controller compatibility with the existing bearer credential', async () => {
  const calls = [];
  const client = createApiClient({
    apiUrl: 'https://api.preflight.curveyield.online/',
    apiKey: 'client-secret',
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ adapterVersion: 'tier3-controller-adapter-v1' });
    },
  });

  const result = await client.getControllerCompatibility();
  assert.equal(result.adapterVersion, 'tier3-controller-adapter-v1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.preflight.curveyield.online/api/v1/controller/compatibility');
  assert.equal(calls[0].init.headers.get('authorization'), 'Bearer client-secret');
});

test('browser client fetches a bounded controller project using an encoded slug', async () => {
  const calls = [];
  const client = createApiClient({
    apiUrl: 'https://api.example',
    apiKey: 'client-secret',
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ project: { projectSlug: 'vlsdt', status: 'NO_ACTIVE_CAMPAIGN' }, campaign: null });
    },
  });

  const result = await client.getControllerProject('vlsdt');
  assert.equal(result.project.projectSlug, 'vlsdt');
  assert.equal(calls[0].url, 'https://api.example/api/v1/controller/projects/vlsdt');
});

test('browser client queues structured controller commands without adding routing authority', async () => {
  const calls = [];
  const command = {
    schemaVersion: 1,
    commandId: 'command-1',
    type: 'campaign.evaluate',
    actor: { type: 'controller', id: 'orchestrator' },
    payload: { terminal: false },
  };
  const client = createApiClient({
    apiUrl: 'https://api.example',
    apiKey: 'client-secret',
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ status: 'queued', commandId: 'command-1', commandType: 'campaign.evaluate', target: 'campaign-mailbox' }, 202);
    },
  });

  const result = await client.queueControllerCommand('vlsdt', command);
  assert.equal(result.status, 'queued');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.example/api/v1/controller/commands');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.get('authorization'), 'Bearer client-secret');
  assert.deepEqual(JSON.parse(calls[0].init.body), { projectSlug: 'vlsdt', command });
  assert.equal(Object.hasOwn(JSON.parse(calls[0].init.body), 'issueNumber'), false);
});

test('controller client methods preserve structured API errors', async () => {
  const client = createApiClient({
    apiUrl: 'https://api.example',
    apiKey: 'client-secret',
    fetcher: async () => jsonResponse({
      error: {
        code: 'controller_pointer_incompatible',
        message: 'The audit controller pointer is incompatible with this browser release',
      },
    }, 409),
  });

  await assert.rejects(
    () => client.getControllerProject('vlsdt'),
    (error) => error instanceof ApiError
      && error.code === 'controller_pointer_incompatible'
      && error.status === 409,
  );
});
