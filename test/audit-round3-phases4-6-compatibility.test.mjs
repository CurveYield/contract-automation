import test from 'node:test';
import assert from 'node:assert/strict';

import { createPublishedProfileContract } from '../packages/audit-tool-profile-contracts/src/index.mjs';
import {
  createInvocationPlan,
  serializeInvocationPlan,
  validateInvocationPlan
} from '../packages/audit-executor-adapters/src/index.mjs';
import { parseToolOutput } from '../packages/audit-tool-parsers/src/index.mjs';
import {
  assertPhase4PackageCompatibility,
  validatePhase4ResultForPlan
} from '../packages/audit-tool-result-contracts/src/index.mjs';

import {
  PHASE5_PROFILE_TEMPLATES
} from '../packages/audit-phase5-profile-contracts/src/index.mjs';
import { parsePhase5ToolResult } from '../packages/audit-phase5-parsers/src/index.mjs';
import {
  validatePhase5ResultForProfile,
  validatePhase5ToolResult
} from '../packages/audit-phase5-result-contracts/src/index.mjs';
import {
  assertPhase5PackageCompatibility,
  createPhase5ToolCatalog
} from '../packages/audit-phase5-tool-catalog/src/index.mjs';

import {
  PHASE6_TRUSTED_PRODUCER,
  parseFormalObligationsBytes
} from '../packages/audit-phase6-parsers/src/index.mjs';
import {
  createPhase6ToolResultEnvelope,
  validatePhase6ToolResult
} from '../packages/audit-phase6-result-contracts/src/index.mjs';
import {
  assertPhase6PackageCompatibility,
  createPhase6ToolCatalog
} from '../packages/audit-phase6-tool-catalog/src/index.mjs';

const encoder = new TextEncoder();
const digest = `sha256:${'a'.repeat(64)}`;
const publishedAt = '2026-08-02T02:00:00.000Z';

function phase4Plan() {
  const profile = createPublishedProfileContract('foundry-test-v1', { digest, publishedAt });
  return createInvocationPlan(
    profile,
    { matchPath: 'test/**/*.t.sol', verbosity: 1, failFast: false },
    {
      workspaceId: `ws_${'1'.repeat(32)}`,
      layerIds: [],
      jobId: `ajob_${'2'.repeat(32)}`,
      attemptId: `att_${'3'.repeat(32)}`,
      timeoutSeconds: 60,
      cancellationTokenId: 'cancel-token-1'
    }
  );
}

test('Phase 4 profile, plan, parser, result, and compatibility identities compose', () => {
  const plan = phase4Plan();
  const serialized = serializeInvocationPlan(plan);
  assert.deepEqual(validateInvocationPlan(JSON.parse(serialized)), plan);
  assert.equal(plan.executionEnabled, false);
  assert.equal(plan.executorState, 'unavailable');

  const result = parseToolOutput('foundry-test-v1', {
    resultJson: JSON.stringify({
      tests: [{
        suite: 'Round3Suite',
        name: 'testAccepted',
        status: 'passed',
        durationMs: 1
      }]
    }),
    stdout: '',
    stderr: '',
    exitCode: 0,
    durationMs: 1,
    terminationReason: 'completed'
  });
  const bound = validatePhase4ResultForPlan(plan, result);
  assert.equal(bound.result.profileId, plan.profileIdentity.profileId);
  assert.equal(bound.result.parserVersion, plan.parserVersion);
  assert.equal(bound.result.exitClassification, 'success');

  const compatibility = assertPhase4PackageCompatibility({ invocationPlans: [plan] });
  assert.equal(compatibility.compatible, true);
  assert.equal(compatibility.checkedInvocationPlans, 1);
});

test('Phase 5 normal result remains compatible with exact profile/catalog identities', () => {
  const profile = PHASE5_PROFILE_TEMPLATES.find((entry) => entry.profileId === 'hardhat-test-v1');
  assert.ok(profile);
  const result = parsePhase5ToolResult('hardhat-test-v1', {
    resultBytes: JSON.stringify({
      tests: [{
        file: 'test/round3.js',
        suite: 'Round3',
        name: 'accepts',
        status: 'passed',
        durationMs: 1
      }]
    }),
    exitCode: 0,
    durationMs: 1,
    termination: 'completed'
  });
  assert.equal(validatePhase5ToolResult(result).classification, 'success');
  assert.equal(validatePhase5ResultForProfile(profile, result).profileId, 'hardhat-test-v1');

  const catalog = createPhase5ToolCatalog();
  assert.deepEqual(catalog.map((entry) => entry.profileId), [
    'dependency-scan-v1', 'echidna-v1', 'hardhat-test-v1', 'mutation-v1'
  ]);
  const compatibility = assertPhase5PackageCompatibility();
  assert.equal(compatibility.compatible, true);
  assert.equal(compatibility.executionEnabled, false);
  assert.equal(compatibility.executorState, 'unavailable');
});

test('Phase 5 resource exhaustion repair nulls raw process exit code', () => {
  const repaired = parsePhase5ToolResult('hardhat-test-v1', {
    resultBytes: '{}',
    exitCode: 137,
    durationMs: 20,
    termination: 'resource_exhausted'
  });
  assert.equal(repaired.classification, 'resource_exhaustion');
  assert.equal(repaired.exitCode, null);
  assert.deepEqual(repaired.hardhatTests, []);
  assert.deepEqual(repaired.evidence, []);
  assert.deepEqual(repaired.summary, {});
  assert.equal(validatePhase5ToolResult(repaired).exitCode, null);
});

test('Phase 6 trusted capture, result envelope, catalog, and compatibility compose', () => {
  const capture = {
    schemaVersion: 'formal-obligations-capture-v1',
    trustedProducer: PHASE6_TRUSTED_PRODUCER,
    profileId: 'formal-obligations-v1',
    toolVersion: '1.0.0',
    outcome: 'proved',
    obligations: [],
    assertions: [],
    models: [],
    traces: [],
    counterexamples: [],
    diagnostics: [],
    sourceReferences: [],
    parserWarnings: [],
    truncated: false
  };
  const result = parseFormalObligationsBytes(encoder.encode(JSON.stringify(capture)));
  assert.equal(result.outcome, 'proved');
  const envelope = createPhase6ToolResultEnvelope('formal-obligations-v1', result);
  assert.equal(validatePhase6ToolResult(envelope).profileId, 'formal-obligations-v1');

  const catalog = createPhase6ToolCatalog();
  assert.deepEqual(catalog.entries.map((entry) => entry.profileId), [
    'formal-obligations-v1', 'halmos-v1', 'solidity-smt-v1'
  ]);
  const compatibility = assertPhase6PackageCompatibility({ catalog, results: [envelope] });
  assert.equal(compatibility.compatible, true);
  assert.equal(compatibility.checkedResults, 1);
});
