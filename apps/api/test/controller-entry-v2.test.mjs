import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entry = readFileSync(new URL('../src/entry.mjs', import.meta.url), 'utf8');
const index = readFileSync(new URL('../src/index.mjs', import.meta.url), 'utf8');

test('clean v2 entry isolates controller routes and delegates every other request to accepted Lite API', () => {
  assert.match(entry, /controllerSetupReadinessV1/);
  assert.match(entry, /handleControllerRouteV1/);
  assert.match(entry, /handleControllerCommandRouteV1/);
  assert.match(entry, /url\.pathname\.startsWith\('\/api\/v1\/controller\/'\)/);
  assert.match(entry, /return apiWorker\.fetch\(request, env, context\);/);
});

test('clean v2 readiness requires both controller credential and fixed intake issue', () => {
  assert.match(entry, /controllerReadReady/);
  assert.match(entry, /AUDIT_CONTROLLER_INTAKE_ISSUE/);
  assert.match(entry, /tier3Controller:\s*controllerReadReady\s*&&\s*controllerIntakeReady/);
});

test('accepted Lite API implementation remains controller-agnostic', () => {
  assert.doesNotMatch(index, /controller-adapter|controller-command-adapter|AUDIT_CONTROLLER|\/api\/v1\/controller\//i);
});
