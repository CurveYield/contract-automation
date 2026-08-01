import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { parsePhase5ToolResult } from '../src/index.mjs';

const fixtureUrl = (name) => new URL(`../../../test/fixtures/audit-phase5/${name}`, import.meta.url);
const fixture = (name, encoding = null) => readFile(fixtureUrl(name), encoding ? { encoding } : undefined);
const input = (resultBytes, overrides = {}) => ({
  resultBytes,
  exitCode: 0,
  durationMs: 25,
  termination: 'completed',
  ...overrides
});

function reverseToolRecords(profileId, value) {
  const clone = structuredClone(value);
  if (profileId === 'hardhat-test-v1') clone.tests.reverse();
  if (profileId === 'echidna-v1') clone.tests.reverse();
  if (profileId === 'mutation-v1') clone.mutants.reverse();
  if (profileId === 'dependency-scan-v1') {
    clone.results.reverse();
    for (const result of clone.results) {
      result.packages.reverse();
      for (const packageResult of result.packages) packageResult.vulnerabilities.reverse();
    }
  }
  return clone;
}

function parseJson(profileId, value, overrides = {}) {
  return parsePhase5ToolResult(profileId, input(JSON.stringify(value), overrides));
}

test('P5-R02 parser input boundary rejects class and custom-prototype instances', () => {
  class ParserInput {
    constructor() {
      Object.assign(this, input('{}'));
    }
  }
  const classResult = parsePhase5ToolResult('hardhat-test-v1', new ParserInput());
  assert.equal(classResult.classification, 'parser_error');
  assert.equal(classResult.parserErrors[0].code, 'invalid_object');

  const custom = Object.assign(Object.create({ inherited: true }), input('{}'));
  const customResult = parsePhase5ToolResult('hardhat-test-v1', custom);
  assert.equal(customResult.classification, 'parser_error');
  assert.equal(customResult.parserErrors[0].code, 'invalid_object');

  const nullPrototype = Object.assign(Object.create(null), input(JSON.stringify({ tests: [] })));
  assert.equal(parsePhase5ToolResult('hardhat-test-v1', nullPrototype).classification, 'success');
});

test('P5-R03 mutation exact duplicates deduplicate and conflicting identities fail canonically', async () => {
  const exact = {
    mutants: [
      { id: 'mut-1', status: 'killed', operator: 'require-mutation', file: 'contracts/A.sol', line: 1, column: 1, killedBy: 'test A' },
      { id: 'mut-1', status: 'killed', operator: 'require-mutation', file: 'contracts/A.sol', line: 1, column: 1, killedBy: 'test A' }
    ]
  };
  const exactResult = parseJson('mutation-v1', exact);
  assert.equal(exactResult.classification, 'success');
  assert.equal(exactResult.mutationResults.length, 1);

  const conflict = JSON.parse(await fixture('mutation-conflicting-duplicates-v2.json', 'utf8'));
  const forward = parseJson('mutation-v1', conflict);
  const reversed = parseJson('mutation-v1', reverseToolRecords('mutation-v1', conflict));
  assert.equal(forward.classification, 'parser_error');
  assert.equal(forward.parserErrors[0].code, 'conflicting_duplicate');
  assert.deepEqual(reversed, forward);
});

test('P5-R03 dependency identity includes source and conflicts are permutation-invariant', async () => {
  const sameVulnerability = {
    id: 'OSV-1', aliases: ['CVE-1'], summary: 'same', severity: 'high', fixedVersion: '2.0.0'
  };
  const exact = {
    results: [
      {
        source: { path: 'package-lock.json', type: 'lockfile' },
        packages: [{
          package: { name: 'lib', version: '1.0.0', ecosystem: 'npm' },
          vulnerabilities: [sameVulnerability, structuredClone(sameVulnerability)]
        }]
      },
      {
        source: { path: 'nested/package-lock.json', type: 'lockfile' },
        packages: [{
          package: { name: 'lib', version: '1.0.0', ecosystem: 'npm' },
          vulnerabilities: [structuredClone(sameVulnerability)]
        }]
      }
    ]
  };
  const exactResult = parseJson('dependency-scan-v1', exact, { exitCode: 1 });
  assert.equal(exactResult.classification, 'findings');
  assert.equal(exactResult.dependencyFindings.length, 2);
  assert.deepEqual(exactResult.dependencyFindings.map((item) => item.sourcePath), [
    'nested/package-lock.json',
    'package-lock.json'
  ]);

  const conflict = JSON.parse(await fixture('dependency-conflicting-duplicates-v2.json', 'utf8'));
  const forward = parseJson('dependency-scan-v1', conflict, { exitCode: 1 });
  const reversed = parseJson('dependency-scan-v1', reverseToolRecords('dependency-scan-v1', conflict), { exitCode: 1 });
  assert.equal(forward.classification, 'parser_error');
  assert.equal(forward.parserErrors[0].code, 'conflicting_duplicate');
  assert.deepEqual(reversed, forward);
});

test('P5-R04 invalid and unknown profile identifiers use a fixed schema-valid sentinel', () => {
  const cases = [
    ['x'.repeat(100_000), 'invalid_profile_id'],
    ['hardhat-test-v1\u0000secret', 'invalid_profile_id'],
    [{ profile: 'hardhat-test-v1' }, 'invalid_profile_id'],
    [['hardhat-test-v1'], 'invalid_profile_id'],
    ['unknown-v1', 'unknown_profile_id'],
    [{ toString() { throw new Error('must not coerce profile objects'); } }, 'invalid_profile_id']
  ];
  for (const [profileId, expectedCode] of cases) {
    const result = parsePhase5ToolResult(profileId, input('{}'));
    assert.equal(result.profileId, 'invalid-profile-v1');
    assert.match(result.profileId, /^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/);
    assert.equal(result.parserErrors[0].code, expectedCode);
    assert.ok(JSON.stringify(result).length < 10_000);
    assert.doesNotMatch(JSON.stringify(result), /hardhat-test-v1\\u0000secret/);
  }
});

test('P5-R05 fixed secret forms and host paths are deterministically redacted', async () => {
  const result = parsePhase5ToolResult(
    'hardhat-test-v1',
    input(await fixture('hardhat-sensitive-messages-v2.json'), { exitCode: 1 })
  );
  assert.equal(result.classification, 'findings');
  const message = result.hardhatTests[0].errorMessage;
  assert.match(message, /\[redacted\]/);
  assert.match(message, /\[path\]/);
  assert.doesNotMatch(message, /aaaaaaaaaaaaaaaa|abandon abandon|api-example|AKIAEXAMPLE|abc\.def\.ghi|token-example|secret-example|KEY=value|Users\\alice|home\/alice/);

  const malformed = parsePhase5ToolResult('hardhat-test-v1', input('{"PRIVATE_KEY":"super-secret"'));
  assert.equal(malformed.classification, 'malformed_output');
  assert.doesNotMatch(JSON.stringify(malformed), /super-secret|PRIVATE_KEY/);
});

test('all four parsers are replay-stable and invariant under record permutation', async () => {
  const cases = [
    ['hardhat-test-v1', 'hardhat-success-v1.json', 0],
    ['echidna-v1', 'echidna-success-v1.json', 0],
    ['mutation-v1', 'mutation-findings-v1.json', 0],
    ['dependency-scan-v1', 'dependency-findings-v1.json', 1]
  ];
  for (const [profileId, file, exitCode] of cases) {
    const value = JSON.parse(await fixture(file, 'utf8'));
    const first = parseJson(profileId, value, { exitCode });
    const replay = parseJson(profileId, value, { exitCode });
    const permuted = parseJson(profileId, reverseToolRecords(profileId, value), { exitCode });
    assert.deepEqual(replay, first, `${profileId} replay changed`);
    assert.deepEqual(permuted, first, `${profileId} permutation changed`);
  }
});
