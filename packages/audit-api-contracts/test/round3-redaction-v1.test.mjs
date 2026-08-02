import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiContractError,
  errorResponse,
  normalizeApiError
} from '../src/index.mjs';

const forbidden = [
  'supersecret',
  'nested-secret',
  'attacker.example',
  '/home/alice/private',
  'C:\\Users\\alice\\private',
  'stack-marker',
  'provider-controlled-marker',
  'authorization',
  '\u0000'
];

function assertRedacted(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const marker of forbidden) {
    assert.equal(serialized.includes(marker.toLowerCase()), false, marker);
  }
  assert.ok(serialized.length < 1_000);
}

test('unknown provider errors discard recursive details, headers, URLs, paths, stacks, controls, and oversized attacker text', () => {
  const cause = new Error(
    `provider-controlled-marker Authorization: Bearer supersecret https://attacker.example ` +
    `/home/alice/private C:\\Users\\alice\\private ${'x'.repeat(100_000)}\u0000`
  );
  cause.stack = `stack-marker\n${cause.message}`;
  cause.details = {
    headers: { authorization: 'Bearer nested-secret' },
    nested: [{ url: 'https://attacker.example/x', path: '/home/alice/private' }]
  };
  cause.cause = cause;
  const normalized = normalizeApiError(cause);
  assert.equal(normalized.status, 500);
  assert.equal(normalized.error.code, 'internal_error');
  assertRedacted(normalized);
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.body));
  assert.ok(Object.isFrozen(normalized.body.error));
});

test('known contract errors use stable public text rather than attacker-controlled constructor messages', () => {
  const cause = new ApiContractError(
    'invalid_request',
    'provider-controlled-marker Authorization: Bearer supersecret https://attacker.example /home/alice/private',
    '$.request'
  );
  const normalized = normalizeApiError(cause);
  assert.equal(normalized.status, 400);
  assert.equal(normalized.error.code, 'invalid_request');
  assert.equal(normalized.error.details.path, '$.request');
  assert.equal(normalized.error.message, 'Request rejected');
  assertRedacted(normalized);
});

test('throwing and revoked proxy errors normalize without reflection text or trap execution beyond guarded classification', () => {
  let traps = 0;
  const hostile = new Proxy({}, {
    getPrototypeOf() {
      traps += 1;
      throw new Error('provider-controlled-marker');
    },
    get() {
      traps += 1;
      throw new Error('nested-secret');
    }
  });
  const normalized = normalizeApiError(hostile);
  assert.equal(normalized.error.code, 'internal_error');
  assertRedacted(normalized);
  assert.ok(traps <= 1);

  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  const revoked = normalizeApiError(proxy);
  assert.equal(revoked.error.code, 'internal_error');
  assertRedacted(revoked);
});

test('error responses are deterministic and byte-identical across unrelated hostile provider messages', async () => {
  const left = await errorResponse(new Error('provider-controlled-marker supersecret'), {
    CORS_ORIGIN: 'https://audit.example'
  });
  const right = await errorResponse(new Error('different attacker payload https://attacker.example'), {
    CORS_ORIGIN: 'https://audit.example'
  });
  assert.equal(left.status, 500);
  assert.equal(right.status, 500);
  assert.equal(await left.text(), await right.text());
  assert.equal(left.headers.get('cache-control'), 'private, no-store');
  assert.equal(right.headers.get('cache-control'), 'private, no-store');
});

test('Unicode edge cases and bidi/control text cannot enter public error output', () => {
  const cause = new Error(
    `provider-controlled-marker\u202eAuthorization: Bearer supersecret\u2066` +
    `https://attacker.example\u0007${'é'.repeat(50_000)}`
  );
  const normalized = normalizeApiError(cause);
  const text = JSON.stringify(normalized);
  assert.equal(text.includes('\u202e'), false);
  assert.equal(text.includes('\u2066'), false);
  assert.equal(text.includes('\u0007'), false);
  assertRedacted(normalized);
});
