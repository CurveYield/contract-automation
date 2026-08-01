import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createAuditApiClient, AuditApiError, normalizeAuditApiUrl } from '../src/client.mjs';
import { createCapabilityViewModel, safeDisplayText } from '../src/view-model.mjs';

test('normalizes an Audit API origin without accepting Lite route suffixes', () => {
  assert.equal(normalizeAuditApiUrl('https://audit.example/'), 'https://audit.example');
  assert.throws(() => normalizeAuditApiUrl('https://audit.example/api/v1'), /origin/);
  assert.throws(() => normalizeAuditApiUrl('javascript:alert(1)'), /https/);
});

test('client uses only Audit v1 paths and bearer authentication', async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ executionEnabled: false }), { headers: { 'content-type': 'application/json' } });
  };
  const client = createAuditApiClient({ apiUrl: 'https://audit.example/', apiKey: 'read-key', fetcher });
  await client.getCapabilities();
  assert.equal(calls[0].url, 'https://audit.example/audit/v1/capabilities');
  assert.equal(new Headers(calls[0].init.headers).get('authorization'), 'Bearer read-key');
  assert.doesNotMatch(calls[0].url, /\/api\/v1|\/internal\/v1/);
});

test('client exposes readiness and never has direct R2 methods', async () => {
  const client = createAuditApiClient({
    apiUrl: 'https://audit.example', apiKey: 'admin-key',
    fetcher: async () => new Response(JSON.stringify({ ready: true }))
  });
  assert.deepEqual(await client.getReadiness(), { ready: true });
  assert.equal(client.listObjects, undefined);
  assert.equal(client.uploadToR2, undefined);
});

test('structured API errors are reduced to safe text fields', async () => {
  const client = createAuditApiClient({
    apiUrl: 'https://audit.example', apiKey: 'read-key',
    fetcher: async () => new Response(JSON.stringify({
      error: { code: 'bad_input', message: '<img src=x onerror=alert(1)>', details: { path: '$.x' } }
    }), { status: 400, headers: { 'content-type': 'application/json' } })
  });
  await assert.rejects(client.getCapabilities(), (error) => {
    assert.ok(error instanceof AuditApiError);
    assert.equal(error.code, 'bad_input');
    assert.equal(safeDisplayText(error.message), '<img src=x onerror=alert(1)>');
    return true;
  });
});

test('capability view model makes disabled execution explicit', () => {
  assert.deepEqual(createCapabilityViewModel({ phase: 1, executionEnabled: false, executionState: 'awaiting_executor' }), {
    phaseLabel: 'Phase 1', executionLabel: 'Submitted execution disabled',
    stateLabel: 'Awaiting separately approved hardened executor', enabled: false
  });
});

test('static app avoids unsafe HTML and Lite endpoints', async () => {
  const [app, html] = await Promise.all([
    fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8')
  ]);
  assert.doesNotMatch(app, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.doesNotMatch(`${app}\n${html}`, /\/api\/v1|\/internal\/v1|R2_ACCESS|GITHUB_MASTER/);
  assert.match(html, /Submitted execution remains disabled/);
});
