import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHASE4_PROFILE_IDS, PHASE4_PROFILE_TEMPLATES, createPublishedProfileContract } from '../../audit-tool-profile-contracts/src/index.mjs';
import { PARSER_VERSIONS } from '../../audit-tool-parsers/src/index.mjs';
import { createInvocationPlan } from '../../audit-executor-adapters/src/index.mjs';
import {
  PHASE4_COMPATIBILITY_CONTRACT_VERSION,
  assertPhase4PackageCompatibility,
  validatePhase4ResultForPlan
} from '../src/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const snapshots = JSON.parse(fs.readFileSync(path.resolve(here, '../../../test/fixtures/audit-phase4/normalized-snapshots-v1.json'), 'utf8')).results;

const CONFIGURATIONS = Object.freeze({
  'solidity-compile-v1': { compilerVersion: '0.8.30', optimizerEnabled: true, optimizerRuns: 200, evmVersion: 'cancun', viaIR: false },
  'foundry-test-v1': { matchPath: 'test/**/*.t.sol', verbosity: 3, failFast: false },
  'foundry-fuzz-v1': { runs: 1000, seed: 42, dictionaryWeight: 40, includeStorage: true },
  'foundry-invariant-v1': { runs: 256, depth: 64, seed: 42, failOnRevert: false, callOverride: false },
  'slither-v1': { detectors: ['reentrancy-eth'], excludeDependencies: true, filterPaths: ['lib/.*'] },
  'coverage-forge-v1': { reportFormats: ['summary'], matchPath: 'test/**/*.t.sol', includeLibraries: false }
});
function plan(profileId = 'solidity-compile-v1') {
  const profile = createPublishedProfileContract(profileId, { digest: `sha256:${'a'.repeat(64)}`, publishedAt: '2026-08-01T10:00:00.000Z' });
  return createInvocationPlan(profile, CONFIGURATIONS[profileId], {
    workspaceId: `ws_${'1'.repeat(32)}`, layerIds: [], jobId: `ajob_${'2'.repeat(32)}`, attemptId: `att_${'3'.repeat(32)}`,
    timeoutSeconds: 1800, cancellationTokenId: 'cancel-token-0001'
  });
}

function assertCode(fn, code) { assert.throws(fn, (error) => error?.code === code, `expected ${code}`); }

test('publishes the deterministic compatibility contract version', () => {
  assert.equal(PHASE4_COMPATIBILITY_CONTRACT_VERSION, 'phase4-package-compatibility-v1');
});

test('proves profiles, templates, and parser versions are exactly aligned', () => {
  const result = assertPhase4PackageCompatibility();
  assert.deepEqual(result.profileIds, [...PHASE4_PROFILE_IDS]);
  assert.deepEqual(Object.keys(PARSER_VERSIONS).sort(), [...PHASE4_PROFILE_IDS].sort());
  assert.equal(result.compatible, true);
  assert.equal(Object.isFrozen(result), true);
});

test('revalidates one canonical invocation plan for every accepted profile', () => {
  const invocationPlans = PHASE4_PROFILE_IDS.map((profileId) => plan(profileId));
  const result = assertPhase4PackageCompatibility({ invocationPlans });
  assert.equal(result.checkedTemplates, 6);
  assert.equal(result.checkedInvocationPlans, 6);
});

test('rejects substituted package maps and template publication drift deterministically', () => {
  const templates = PHASE4_PROFILE_TEMPLATES.map((item) => structuredClone(item));
  templates[0].parserVersion = 'slither-parser-v1';
  assertCode(() => assertPhase4PackageCompatibility({ templates }), 'profile_parser_mismatch');
  const published = PHASE4_PROFILE_TEMPLATES.map((item) => structuredClone(item));
  published[0].runnable = true;
  assertCode(() => assertPhase4PackageCompatibility({ templates: published }), 'unsafe_template_state');
});

test('binds a normalized result to a canonical invocation plan', () => {
  const result = validatePhase4ResultForPlan(plan(), snapshots['compiler-success-v1.json']);
  assert.equal(result.plan.profileIdentity.profileId, result.result.profileId);
  assert.equal(result.plan.parserVersion, result.result.parserVersion);
  assert.equal(Object.isFrozen(result), true);
});

test('rejects plan/result mismatch, parser substitution, extra fields, and plan tampering', () => {
  assertCode(() => validatePhase4ResultForPlan(plan('slither-v1'), snapshots['compiler-success-v1.json']), 'plan_result_profile_mismatch');
  assertCode(() => validatePhase4ResultForPlan(plan(), { ...snapshots['compiler-success-v1.json'], parserVersion: 'slither-parser-v1' }), 'profile_parser_mismatch');
  assertCode(() => validatePhase4ResultForPlan(plan(), { ...snapshots['compiler-success-v1.json'], executionEnabled: false }), 'unknown_field');
  assertCode(() => validatePhase4ResultForPlan({ ...plan(), executionEnabled: true }, snapshots['compiler-success-v1.json']), 'invalid_invocation_plan');
});

test('rejects execution-state fields hidden inside normalized bounded evidence', () => {
  const result = structuredClone(snapshots['foundry-fuzz-counterexample-v1.json']);
  result.counterexamples[0].value.executionEnabled = false;
  assertCode(() => validatePhase4ResultForPlan(plan('foundry-fuzz-v1'), result), 'execution_state_field');
});
