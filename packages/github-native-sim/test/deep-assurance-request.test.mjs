import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  DEEP_ASSURANCE_REQUEST_SCHEMA_VERSION,
  DEEP_ASSURANCE_RUNNER_RELEASE_VERSION,
  buildGitHubNativeJobFromDeepAssuranceRequest,
  calculateDeepAssuranceRequestDigest,
  selectDeepAssuranceRequestFromChangedPaths,
  validateDeepAssuranceRequest,
} from '../src/deep-assurance-request.mjs';
import { prepareDeepAssuranceJob } from '../src/prepare-deep-assurance-job.mjs';
import { finalizeDeepAssuranceOutput } from '../src/finalize-deep-assurance-result.mjs';

const BASE_RELEASE = {
  repository: 'CurveYield/contract-automation',
  branch: 'orchestrator/round4-ci-base-v1',
  commit: 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8',
  contractVersion: 'contract-automation-finalized-v1',
};

function request(overrides = {}) {
  const identity = {
    schemaVersion: DEEP_ASSURANCE_REQUEST_SCHEMA_VERSION,
    processId: 'deep-assurance-v6',
    contractAutomationRelease: BASE_RELEASE,
    runnerRelease: {
      version: DEEP_ASSURANCE_RUNNER_RELEASE_VERSION,
      manifestSha256: '1'.repeat(64),
    },
    campaignId: 'campaign-a',
    assignmentId: 'campaign-a-build-simulation-evidence-auditor',
    phaseId: 'build-and-test',
    gateId: 'exact-build-and-tests-complete',
    profileId: 'github-native-compile-v1',
    source: {
      repository: 'CurveYield/example-contract-suite',
      commit: 'a'.repeat(40),
      projectPath: 'contracts',
    },
    configuration: {
      compilerVersion: '0.8.30',
      openZeppelinVersion: '5.4.0',
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
      viaIR: false,
      timeoutMinutes: 20,
    },
    ...overrides,
  };
  const requestDigest = calculateDeepAssuranceRequestDigest(identity);
  return {
    ...identity,
    requestId: `dar-${requestDigest.slice(0, 32)}`,
    requestDigest,
  };
}

test('selects exactly one atomic Deep Assurance request file', () => {
  const value = request();
  const requestPath = `github-native-sim/requests/${value.requestId}/request.json`;
  assert.deepEqual(selectDeepAssuranceRequestFromChangedPaths([requestPath]), {
    requestId: value.requestId,
    requestPath,
    requestRoot: `github-native-sim/requests/${value.requestId}`,
  });
  assert.throws(() => selectDeepAssuranceRequestFromChangedPaths([]), /exactly one/i);
  assert.throws(() => selectDeepAssuranceRequestFromChangedPaths([requestPath, `${path.dirname(requestPath)}/extra.json`]), /exactly one/i);
  assert.throws(() => selectDeepAssuranceRequestFromChangedPaths(['packages/runner/src/cli.mjs']), /request/i);
});

test('validates deterministic exact-source request identity', () => {
  const value = request();
  const validated = validateDeepAssuranceRequest(value, {
    expectedRunnerManifestSha256: '1'.repeat(64),
  });
  assert.equal(validated.requestId, value.requestId);
  assert.equal(validated.requestDigest, value.requestDigest);
  assert.equal(validated.source.commit, 'a'.repeat(40));
  assert.equal(Object.isFrozen(validated), true);

  assert.throws(() => validateDeepAssuranceRequest({ ...value, requestId: 'dar-' + 'f'.repeat(32) }, {
    expectedRunnerManifestSha256: '1'.repeat(64),
  }), /requestId/i);
  assert.throws(() => validateDeepAssuranceRequest({ ...value, requestDigest: 'f'.repeat(64) }, {
    expectedRunnerManifestSha256: '1'.repeat(64),
  }), /requestDigest/i);
  assert.throws(() => validateDeepAssuranceRequest({ ...value, runnerRelease: { ...value.runnerRelease, manifestSha256: '2'.repeat(64) } }, {
    expectedRunnerManifestSha256: '1'.repeat(64),
  }), /runner release/i);
});

test('rejects arbitrary authority, unsafe paths, and unsupported profiles', () => {
  const value = request();
  assert.throws(() => validateDeepAssuranceRequest({
    ...value,
    configuration: { ...value.configuration, command: 'forge test' },
  }, { expectedRunnerManifestSha256: '1'.repeat(64) }), /forbidden/i);
  assert.throws(() => validateDeepAssuranceRequest({
    ...value,
    configuration: { ...value.configuration, rpcUrl: 'https://secret.invalid' },
  }, { expectedRunnerManifestSha256: '1'.repeat(64) }), /forbidden/i);
  assert.throws(() => validateDeepAssuranceRequest({
    ...value,
    source: { ...value.source, projectPath: '../outside' },
  }, { expectedRunnerManifestSha256: '1'.repeat(64) }), /projectPath/i);
  assert.throws(() => validateDeepAssuranceRequest({ ...value, profileId: 'solidity-smt-v1' }, {
    expectedRunnerManifestSha256: '1'.repeat(64),
  }), /profileId/i);
});

test('builds a trusted compile job with fixed local project path', () => {
  const value = validateDeepAssuranceRequest(request(), {
    expectedRunnerManifestSha256: '1'.repeat(64),
  });
  const job = buildGitHubNativeJobFromDeepAssuranceRequest(value);
  assert.equal(job.version, 'github-native-sim/v1');
  assert.equal(job.id, value.requestId);
  assert.equal(job.mode, 'compile');
  assert.equal(job.projectPath, 'project');
  assert.deepEqual(job.workflow, { steps: [] });
  assert.equal('source' in job, false);
});

test('simulation request requires pinned chain state and allowlisted workflow data', () => {
  const compile = request();
  const simulation = request({
    phaseId: 'fork-simulation-lifecycle',
    gateId: 'fork-simulation-lifecycle-complete',
    profileId: 'github-native-simulate-v1',
    configuration: {
      ...compile.configuration,
      chain: 'ethereum',
      block: 25_666_794,
      simulation: {},
      workflow: { steps: [] },
    },
  });
  const validated = validateDeepAssuranceRequest(simulation, {
    expectedRunnerManifestSha256: '1'.repeat(64),
  });
  const job = buildGitHubNativeJobFromDeepAssuranceRequest(validated);
  assert.equal(job.mode, 'simulate');
  assert.equal(job.chain, 'ethereum');
  assert.equal(job.block, 25_666_794);
  assert.deepEqual(job.workflow, { steps: [] });

  const latest = request({
    profileId: 'github-native-simulate-v1',
    configuration: { ...compile.configuration, chain: 'ethereum', block: 'latest', simulation: {}, workflow: { steps: [] } },
  });
  assert.throws(() => validateDeepAssuranceRequest(latest, {
    expectedRunnerManifestSha256: '1'.repeat(64),
  }), /pinned block/i);
});

test('prepares only regular source files and rejects symlink escape', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'deep-assurance-prepare-'));
  try {
    const sourceRoot = path.join(root, 'source');
    const outputRoot = path.join(root, 'output');
    await fs.mkdir(path.join(sourceRoot, 'contracts'), { recursive: true });
    await fs.writeFile(path.join(sourceRoot, 'contracts', 'Example.sol'), 'pragma solidity 0.8.30; contract Example {}\n');
    const value = request();
    const prepared = await prepareDeepAssuranceJob({
      request: value,
      expectedRunnerManifestSha256: '1'.repeat(64),
      sourceCheckoutRoot: sourceRoot,
      verifiedSourceCommit: value.source.commit,
      outputRoot,
    });
    assert.equal(prepared.job.id, value.requestId);
    assert.equal(await fs.readFile(path.join(outputRoot, 'project', 'Example.sol'), 'utf8'), 'pragma solidity 0.8.30; contract Example {}\n');

    await fs.symlink('/etc/passwd', path.join(sourceRoot, 'contracts', 'Escape.sol'));
    await assert.rejects(() => prepareDeepAssuranceJob({
      request: value,
      expectedRunnerManifestSha256: '1'.repeat(64),
      sourceCheckoutRoot: sourceRoot,
      verifiedSourceCommit: value.source.commit,
      outputRoot: path.join(root, 'output-2'),
    }), /symlink/i);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('normalizes runner output into exact-source Deep Assurance evidence', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'deep-assurance-result-'));
  try {
    const value = request();
    await fs.writeFile(path.join(root, 'result.json'), JSON.stringify({
      jobId: value.requestId,
      status: 'completed',
      mode: 'compile',
      compilerVersion: '0.8.30',
    }));
    await fs.writeFile(path.join(root, 'compiler-output.json'), '{"contracts":{}}\n');
    const normalized = await finalizeDeepAssuranceOutput({
      request: value,
      expectedRunnerManifestSha256: '1'.repeat(64),
      outputRoot: root,
      repository: 'CurveYield/contract-automation',
      runId: '12345',
      artifactName: `deep-assurance-${value.requestId}-12345`,
      nodeVersion: '22.18.0',
    });
    assert.equal(normalized.schemaVersion, 'deep-assurance-contract-automation-result-v1');
    assert.equal(normalized.requestId, value.requestId);
    assert.equal(normalized.requestDigest, value.requestDigest);
    assert.equal(normalized.source.commit, value.source.commit);
    assert.equal(normalized.status, 'PASSED');
    assert.equal(normalized.artifactRefs.length > 0, true);
    assert.equal(normalized.evidenceRefs.every((entry) => entry.sourceCommit === value.source.commit), true);
    assert.equal(normalized.toolVersions.solc, '0.8.30');
    assert.equal(await fs.stat(path.join(root, 'deep-assurance-result-v1.json')).then(() => true), true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
