import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const README_PATH = 'docs/audit/round5/README_v1.md';
const ACCEPTED_SOURCE_SHA = '3da6b10f240e2abd031195f440c7cd80b72b691b';
const REQUIRED_FILES = Object.freeze([
  'release-source-binding-v1.json',
  'secret-variable-binding-manifest-v1.json',
  'production-resource-manifest-v1.json',
  'production-test-manifest-v1.json',
  'deployment-preflight-manifest-v1.json',
  'rollback-recovery-manifest-v1.json',
  'observability-redaction-manifest-v1.json',
  'trusted-v27-live-regression-contract-v1.json',
  'production-authorization-gate-v1.json'
]);

test('Round 5 operator guide indexes the complete static-only package', () => {
  const readme = readFileSync(README_PATH, 'utf8');
  assert.match(readme, /static-only/i);
  assert.ok(readme.includes(ACCEPTED_SOURCE_SHA));
  assert.ok(readme.includes('does **not** authorize'));
  assert.equal(REQUIRED_FILES.length, 9);
  for (const filename of REQUIRED_FILES) {
    assert.ok(readme.includes(`\`${filename}\``), `README does not index ${filename}`);
  }
});
