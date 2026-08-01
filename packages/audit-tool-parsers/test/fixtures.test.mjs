import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { parseToolOutput } from '../src/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(here, '..', '..', '..');
const fixtureRoot = join(repositoryRoot, 'test', 'fixtures', 'audit-phase4');

const EXPECTED_FIXTURES = Object.freeze([
  'cancellation-v1.json',
  'compiler-findings-v1.json',
  'compiler-malformed-v1.json',
  'compiler-success-v1.json',
  'coverage-success-v1.json',
  'foundry-fuzz-counterexample-v1.json',
  'foundry-invariant-failure-v1.json',
  'foundry-test-failure-v1.json',
  'foundry-test-success-v1.json',
  'resource-exhaustion-v1.json',
  'slither-findings-v1.json',
  'timeout-v1.json',
  'trace-truncation-v1.json',
  'unsafe-path-v1.json'
]);

async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

test('CurveYield-owned Phase 4 inert fixtures have an exact versioned inventory and deterministic snapshots', async () => {
  const actualFiles = (await readdir(fixtureRoot))
    .filter((name) => name.endsWith('.json') && name !== 'normalized-snapshots-v1.json')
    .sort();
  assert.deepEqual(actualFiles, EXPECTED_FIXTURES);

  const snapshots = await loadJson(join(fixtureRoot, 'normalized-snapshots-v1.json'));
  assert.equal(snapshots.snapshotSchemaVersion, 'audit-phase4-normalized-snapshots-v1');
  assert.deepEqual(Object.keys(snapshots.results).sort(), EXPECTED_FIXTURES);

  for (const name of EXPECTED_FIXTURES) {
    const path = join(fixtureRoot, name);
    const fixture = await loadJson(path);
    assert.equal(fixture.fixtureSchemaVersion, 'audit-phase4-inert-fixture-v1', relative(repositoryRoot, path));
    assert.equal(fixture.owner, 'CurveYield', relative(repositoryRoot, path));
    assert.equal(typeof fixture.description, 'string');
    assert.equal(typeof fixture.profileId, 'string');
    assert.deepEqual(Object.keys(fixture).sort(), ['description', 'fixtureSchemaVersion', 'input', 'owner', 'profileId']);

    const first = parseToolOutput(fixture.profileId, fixture.input);
    const second = parseToolOutput(fixture.profileId, structuredClone(fixture.input));
    assert.deepEqual(first, second, `${name} must normalize deterministically`);
    assert.equal(JSON.stringify(first), JSON.stringify(second), `${name} serialization must be deterministic`);
    assert.deepEqual(first, snapshots.results[name], `${name} snapshot drift`);
  }
});

test('lifecycle, malformed, finding, failure, success, and truncation fixtures cover required outcomes', async () => {
  const snapshots = await loadJson(join(fixtureRoot, 'normalized-snapshots-v1.json'));
  const classifications = Object.fromEntries(
    Object.entries(snapshots.results).map(([name, result]) => [name, result.exitClassification])
  );
  assert.equal(classifications['compiler-success-v1.json'], 'success');
  assert.equal(classifications['compiler-findings-v1.json'], 'tool_failure');
  assert.equal(classifications['foundry-test-failure-v1.json'], 'tool_failure');
  assert.equal(classifications['compiler-malformed-v1.json'], 'parser_error');
  assert.equal(classifications['unsafe-path-v1.json'], 'parser_error');
  assert.equal(classifications['timeout-v1.json'], 'timeout');
  assert.equal(classifications['cancellation-v1.json'], 'cancelled');
  assert.equal(classifications['resource-exhaustion-v1.json'], 'resource_exhaustion');
  assert.equal(snapshots.results['trace-truncation-v1.json'].truncated, true);
  assert.equal(snapshots.results['slither-findings-v1.json'].findings.length > 0, true);
  assert.equal(snapshots.results['foundry-fuzz-counterexample-v1.json'].counterexamples.length > 0, true);
  assert.equal(snapshots.results['foundry-invariant-failure-v1.json'].invariants.some((item) => item.status === 'failed'), true);
  assert.notEqual(snapshots.results['coverage-success-v1.json'].coverage, null);
});

test('fixture corpus and snapshots contain no real secrets or host-specific stack data', async () => {
  const names = [...EXPECTED_FIXTURES, 'normalized-snapshots-v1.json'];
  for (const name of names) {
    const serialized = await readFile(join(fixtureRoot, name), 'utf8');
    assert.doesNotMatch(serialized, /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|sk_live_|github_pat_|ghp_[A-Za-z0-9]{20,}|node_modules|at TestContext|node:internal/i, name);
  }
  const snapshots = await loadJson(join(fixtureRoot, 'normalized-snapshots-v1.json'));
  assert.doesNotMatch(JSON.stringify(snapshots), /\/home\/|[A-Za-z]:\\|SyntaxError:|TypeError:|\n\s+at\s|node:internal/i);
});
