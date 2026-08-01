import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePhase5CatalogRequest } from '../src/phase5-catalog.mjs';
import { handlePhase6CatalogRequest } from '../src/phase6-catalog.mjs';

const env = {
  AUDIT_CLIENT_API_KEY: 'client',
  AUDIT_GPT_API_KEY: 'gpt',
  CORS_ORIGIN: 'https://audit.example'
};
const request = (path, init = {}) => new Request(`https://api.example${path}`, init);
const headers = { authorization: 'Bearer client' };

test('Phase 5 and Phase 6 read-only route matrices expose exact accepted identities', async () => {
  for (const [handler, base, expected] of [
    [
      handlePhase5CatalogRequest,
      '/audit/v1/phase5/tool-profiles',
      ['dependency-scan-v1', 'echidna-v1', 'hardhat-test-v1', 'mutation-v1']
    ],
    [
      handlePhase6CatalogRequest,
      '/audit/v1/phase6/tool-profiles',
      ['formal-obligations-v1', 'halmos-v1', 'solidity-smt-v1']
    ]
  ]) {
    assert.equal((await handler(request(base, { headers }), env)).status, 200);
    const list = await (await handler(request(base, { headers }), env)).json();
    assert.deepEqual(list.profiles.map((value) => value.profileId), expected);
    assert.equal((await handler(request(`${base}/${expected[0]}`, { headers }), env)).status, 200);
    assert.equal((await handler(request(base, { method: 'OPTIONS' }), env)).status, 204);
    assert.equal((await handler(request(base, { method: 'POST', headers }), env)).status, 405);
    assert.equal((await handler(request(`${base}/${expected[0]}/extra`, { headers }), env)).status, 400);
  }
});
