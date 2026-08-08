import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entry = readFileSync(new URL('../src/entry.mjs', import.meta.url), 'utf8');
const index = readFileSync(new URL('../src/index.mjs', import.meta.url), 'utf8');

test('entry routes only controller namespace through current v2 adapters', () => {
  assert.match(entry, /controllerSetupReadinessV2/);
  assert.match(entry, /handleControllerRouteV2/);
  assert.match(entry, /handleControllerCommandRouteV2/);
  assert.match(entry, /url\.pathname\.startsWith\('\/api\/v1\/controller\/'\)/);
  assert.match(entry, /return apiWorker\.fetch\(request, env, context\);/);
  assert.doesNotMatch(entry, /handleControllerRouteV1|handleControllerCommandRouteV1|controllerSetupReadinessV1/);
});

test('setup readiness still requires dedicated controller connection and intake issue 64', () => {
  assert.match(entry, /controllerReadReady/);
  assert.match(entry, /AUDIT_CONTROLLER_INTAKE_ISSUE/);
  assert.match(entry, /tier3Controller:\s*controllerReadReady\s*&&\s*controllerIntakeReady/);
});

test('accepted Lite API core remains controller agnostic', () => {
  assert.doesNotMatch(index, /controller-adapter|controller-command-adapter|AUDIT_CONTROLLER|\/api\/v1\/controller\//i);
});
