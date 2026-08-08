import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createApiClient } from '../src/client.mjs';

test('client exposes authenticated controller compatibility and campaign reads', async () => {
  const seen = [];
  const client = createApiClient({
    apiUrl: 'https://api.example',
    apiKey: 'k',
    fetcher: async (url, init) => {
      seen.push([url, init.headers.get('authorization')]);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });
  await client.getControllerCompatibility();
  await client.getControllerCampaign('cmp_1');
  assert.deepEqual(seen.map(([url]) => url), [
    'https://api.example/api/v1/controller/compatibility',
    'https://api.example/api/v1/controller/campaigns/cmp_1'
  ]);
  assert.deepEqual(seen.map(([, authorization]) => authorization), ['Bearer k', 'Bearer k']);
});

test('root shell makes Deep Assurance primary and keeps Base default execution scope', async () => {
  const html = await fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /Deep Assurance Operator Console/);
  assert.match(html, /id="campaign-id"/);
  assert.match(html, /Instruction proofs/);
  assert.match(html, /Security verdict/);
  assert.match(html, /GitHub authoritative · read-only adapter v1/);
  assert.match(html, /value="ethereum"/);
  assert.match(html, /value="base" selected/);
  assert.doesNotMatch(html, /value="arbitrum"/);
});

test('controller supplied content is rendered through textContent only', async () => {
  const script = await fs.readFile(new URL('../public/tier3-operator-v1.js', import.meta.url), 'utf8');
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /innerHTML/);
  assert.doesNotMatch(script, /insertAdjacentHTML/);
});
