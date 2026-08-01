import test from 'node:test';
import assert from 'node:assert/strict';

import { validateGitHubNativeJob } from '../src/schema.mjs';

function compileJob(overrides = {}) {
  return {
    version: 'github-native-sim/v1',
    id: 'compile-smoke',
    mode: 'compile',
    projectPath: 'project',
    compilerVersion: '0.8.30',
    timeoutMinutes: 10,
    optimizer: { enabled: true, runs: 200 },
    viaIR: false,
    workflow: { steps: [] },
    ...overrides
  };
}

test('accepts and normalizes a compile manifest', () => {
  const job = validateGitHubNativeJob(compileJob());
  assert.equal(job.version, 'github-native-sim/v1');
  assert.equal(job.id, 'compile-smoke');
  assert.equal(job.mode, 'compile');
  assert.equal(job.block, 'latest');
  assert.deepEqual(job.workflow, { steps: [] });
});

test('accepts a simulation manifest on an allowlisted chain', () => {
  const job = validateGitHubNativeJob(compileJob({
    mode: 'simulate',
    chain: 'ethereum',
    block: 20_000_000,
    workflow: { steps: [{ action: 'mine', blocks: 1 }] }
  }));
  assert.equal(job.chain, 'ethereum');
  assert.equal(job.block, 20_000_000);
});

test('requires an allowlisted chain for simulation', () => {
  assert.throws(
    () => validateGitHubNativeJob(compileJob({
      mode: 'simulate',
      chain: 'unknown',
      workflow: { steps: [{ action: 'mine', blocks: 1 }] }
    })),
    /Unsupported chain: unknown/
  );
});

test('rejects a missing simulation chain', () => {
  assert.throws(
    () => validateGitHubNativeJob(compileJob({
      mode: 'simulate',
      workflow: { steps: [{ action: 'mine', blocks: 1 }] }
    })),
    /chain is required/
  );
});

test('rejects private keys recursively', () => {
  assert.throws(
    () => validateGitHubNativeJob(compileJob({ metadata: { privateKey: '0x01' } })),
    /privateKey is forbidden/
  );
});

test('rejects user supplied RPC URLs recursively', () => {
  assert.throws(
    () => validateGitHubNativeJob(compileJob({ metadata: { rpcUrl: 'https://example.invalid' } })),
    /rpcUrl is forbidden/
  );
});

test('rejects unknown top-level fields', () => {
  assert.throws(
    () => validateGitHubNativeJob(compileJob({ metadata: {} })),
    /metadata is not allowed/
  );
});

test('rejects project traversal', () => {
  assert.throws(
    () => validateGitHubNativeJob(compileJob({ projectPath: '../project' })),
    /projectPath must stay inside the job directory/
  );
});

test('rejects absolute project paths', () => {
  assert.throws(
    () => validateGitHubNativeJob(compileJob({ projectPath: '/tmp/project' })),
    /projectPath must be relative/
  );
});

test('requires exact semantic compiler versions', () => {
  assert.throws(
    () => validateGitHubNativeJob(compileJob({ compilerVersion: '^0.8.30' })),
    /compilerVersion must be an exact semantic version/
  );
});

test('rejects an empty compile workflow only when mode is simulate', () => {
  assert.throws(
    () => validateGitHubNativeJob(compileJob({ mode: 'simulate', chain: 'base' })),
    /workflow.steps must contain 1-200 steps/
  );
});
