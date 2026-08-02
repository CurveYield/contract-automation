import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runGitHubNativeJob } from '../src/run-job-file.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

async function temporaryOutput(prefix) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return { root, output: path.join(root, 'output') };
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

test('compile mode writes the complete artifact bundle', async () => {
  const temporary = await temporaryOutput('github-native-compile-');
  try {
    const jobFile = path.join(testDirectory, 'fixtures', 'compile', 'job.json');
    const result = await runGitHubNativeJob({
      jobFile,
      outputDir: temporary.output,
      environment: {}
    });

    assert.equal(result.status, 'completed');
    assert.equal(result.mode, 'compile');
    assert.equal(result.transport, 'github-native');
    assert.ok(result.artifacts.some((artifact) => artifact.contractName === 'Counter'));

    await fs.access(path.join(temporary.output, 'result.json'));
    await fs.access(path.join(temporary.output, 'report.html'));
    await fs.access(path.join(temporary.output, 'compiler-input.json'));
    await fs.access(path.join(temporary.output, 'compiler-output.json'));
    await fs.access(path.join(temporary.output, 'compiler-diagnostics.json'));
    await fs.access(path.join(temporary.output, 'artifacts', 'index.json'));

    const persisted = await readJson(path.join(temporary.output, 'result.json'));
    assert.equal(persisted.status, 'completed');
    assert.equal(persisted.jobId, 'compile-fixture');

    const index = await readJson(path.join(temporary.output, 'artifacts', 'index.json'));
    assert.ok(index.some((artifact) => artifact.contractName === 'Counter'));
  } finally {
    await fs.rm(temporary.root, { recursive: true, force: true });
  }
});

test('missing archive RPC pool writes a failure report before rejecting', async () => {
  const temporary = await temporaryOutput('github-native-missing-rpc-');
  try {
    const jobFile = path.join(testDirectory, 'fixtures', 'missing-rpc', 'job.json');
    await assert.rejects(
      runGitHubNativeJob({
        jobFile,
        outputDir: temporary.output,
        environment: {}
      }),
      /archive RPC/i
    );

    const persisted = await readJson(path.join(temporary.output, 'result.json'));
    assert.equal(persisted.status, 'failed');
    assert.equal(persisted.mode, 'simulate');
    assert.equal(persisted.chain, 'ethereum');
    assert.match(persisted.error.message, /archive RPC/i);
    await fs.access(path.join(temporary.output, 'report.html'));
    await fs.access(path.join(temporary.output, 'compiler-input.json'));
    await fs.access(path.join(temporary.output, 'compiler-output.json'));
  } finally {
    await fs.rm(temporary.root, { recursive: true, force: true });
  }
});

test('simulation routes configured slots through the shared proxy and selected engine', async () => {
  const temporary = await temporaryOutput('github-native-live-fork-routing-');
  let proxyClosed = false;
  let engineClosed = false;
  try {
    const jobFile = path.join(testDirectory, 'fixtures', 'missing-rpc', 'job.json');
    const result = await runGitHubNativeJob({
      jobFile,
      outputDir: temporary.output,
      environment: {
        SIM_ARCHIVE_PRIMARY_ETHEREUM_01: 'http://127.0.0.1:1/primary-secret',
        SIM_ARCHIVE_SECONDARY_ETHEREUM_01: 'http://127.0.0.1:2/secondary-secret'
      },
      services: {
        startLiveForkProxy: async ({ slots, blockPolicy, chainId, routing, healthPolicy }) => {
          assert.equal(chainId, 1);
          assert.deepEqual(slots.map(({ id, pool }) => ({ id, pool })), [
            { id: 'primary-01', pool: 'primary' },
            { id: 'secondary-01', pool: 'secondary' }
          ]);
          assert.equal(slots[0].url, 'http://127.0.0.1:1/primary-secret');
          assert.equal(slots[1].url, 'http://127.0.0.1:2/secondary-secret');
          assert.deepEqual(blockPolicy, { mode: 'latest-at-start' });
          assert.equal(routing.distribution.strategy, 'round-robin');
          assert.equal(healthPolicy.sessionFailureThreshold, 3);
          return {
            url: 'http://127.0.0.1:8547',
            blockNumber: 123,
            blockHash: `0x${'ab'.repeat(32)}`,
            blockTimestamp: 100,
            diagnostics: {
              assurance: 'continuous-archive-backed-local-fork',
              resolvedBlock: 123,
              blockHash: `0x${'ab'.repeat(32)}`,
              rpc: { slots: [] }
            },
            async close() { proxyClosed = true; }
          };
        },
        startForkEngine: async ({ mode, forkUrl, block }) => {
          assert.equal(mode, 'hardhat-edr');
          assert.equal(forkUrl, 'http://127.0.0.1:8547');
          assert.equal(block, 123);
          return {
            name: 'hardhat-edr',
            version: '3.12.0',
            aliases: { account0: '0x0000000000000000000000000000000000000001' },
            runtime: {
              async execute(step) {
                assert.equal(step.action, 'mine');
                return { blocks: step.blocks };
              }
            },
            async close() { engineClosed = true; }
          };
        }
      }
    });

    assert.equal(result.status, 'completed');
    assert.equal(result.resolvedBlock, 123);
    assert.equal(result.resolvedBlockHash, `0x${'ab'.repeat(32)}`);
    assert.equal(result.engine.name, 'hardhat-edr');
    assert.equal(result.forkTransport.assurance, 'continuous-archive-backed-local-fork');
    assert.equal(result.steps.length, 1);
    assert.equal(proxyClosed, true);
    assert.equal(engineClosed, true);
  } finally {
    await fs.rm(temporary.root, { recursive: true, force: true });
  }
});
