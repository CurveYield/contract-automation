import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditPhase4Capabilities,
  handlePhase4CatalogRequest
} from '../src/phase4-catalog.mjs';

const env = {
  AUDIT_CLIENT_API_KEY: 'client',
  AUDIT_GPT_API_KEY: 'gpt',
  AUDIT_READ_API_KEY: 'read',
  AUDIT_SUBMIT_API_KEY: 'submit',
  AUDIT_ADMIN_API_KEY: 'admin',
  CORS_ORIGIN: 'https://audit.example'
};
const bearer = (value) => ({ authorization: `Bearer ${value}` });
const request = (path, init = {}) => new Request(`https://api.example${path}`, init);

test('six-item Phase 4 route matrix is exact and read-only', async () => {
  const cases = [
    ['GET', '/audit/v1/tool-profiles', 200],
    ['GET', '/audit/v1/tool-profiles/solidity-compile-v1', 200],
    ['OPTIONS', '/audit/v1/tool-profiles', 204],
    ['OPTIONS', '/audit/v1/tool-profiles/solidity-compile-v1', 204],
    ['POST', '/audit/v1/tool-profiles', 405],
    ['DELETE', '/audit/v1/tool-profiles/solidity-compile-v1', 405]
  ];
  for (const [method, path, status] of cases) {
    const response = await handlePhase4CatalogRequest(request(path, {
      method,
      headers: method === 'OPTIONS' ? {} : bearer('client')
    }), env);
    assert.equal(response.status, status, `${method} ${path}`);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://audit.example');
  }
});

test('malformed, empty, encoded slash, and extra-segment item paths fail deterministically', async () => {
  for (const path of [
    '/audit/v1/tool-profiles/',
    '/audit/v1/tool-profiles/%',
    '/audit/v1/tool-profiles/%2F',
    '/audit/v1/tool-profiles/solidity-compile-v1/extra'
  ]) {
    const response = await handlePhase4CatalogRequest(request(path, { headers: bearer('client') }), env);
    assert.equal(response.status, 400, path);
    assert.equal((await response.json()).error.code, 'invalid_profile_id');
  }
});

test('catalog routes never parse request bodies', async () => {
  for (const [method, path] of [
    ['POST', '/audit/v1/tool-profiles'],
    ['PUT', '/audit/v1/tool-profiles/solidity-compile-v1'],
    ['PATCH', '/audit/v1/tool-profiles/solidity-compile-v1']
  ]) {
    const stream = new ReadableStream({
      start(controller) { controller.error(new Error('must not read body')); }
    });
    const response = await handlePhase4CatalogRequest(new Request(`https://api.example${path}`, {
      method,
      headers: bearer('client'),
      body: stream,
      duplex: 'half'
    }), env);
    assert.equal(response.status, 405);
  }
});

test('capability parser truth requires exact profile-to-parser identity, not count equality', () => {
  const good = auditPhase4Capabilities({ campaigns: true });
  assert.equal(good.outputParsers, true);
  assert.equal(good.executionEnabled, false);
  assert.ok(Object.isFrozen(good));
  const bad = auditPhase4Capabilities({}, {
    parserVersions: {
      'coverage-forge-v1': 'wrong-parser',
      'foundry-fuzz-v1': 'foundry-fuzz-parser-v1',
      'foundry-invariant-v1': 'foundry-invariant-parser-v1',
      'foundry-test-v1': 'foundry-test-parser-v1',
      'slither-v1': 'slither-parser-v1',
      'solidity-compile-v1': 'solidity-compile-parser-v1'
    }
  });
  assert.equal(bad.outputParsers, false);
});
