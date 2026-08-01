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

test('missing RPC writes a failure report before rejecting', async () => {
  const temporary = await temporaryOutput('github-native-missing-rpc-');
  try {
    const jobFile = path.join(testDirectory, 'fixtures', 'missing-rpc', 'job.json');
    await assert.rejects(
      runGitHubNativeJob({
        jobFile,
        outputDir: temporary.output,
        environment: {}
      }),
      /RPC_ETHEREUM/
    );

    const persisted = await readJson(path.join(temporary.output, 'result.json'));
    assert.equal(persisted.status, 'failed');
    assert.equal(persisted.mode, 'simulate');
    assert.equal(persisted.chain, 'ethereum');
    assert.match(persisted.error.message, /RPC_ETHEREUM/);
    await fs.access(path.join(temporary.output, 'report.html'));
    await fs.access(path.join(temporary.output, 'compiler-input.json'));
    await fs.access(path.join(temporary.output, 'compiler-output.json'));
  } finally {
    await fs.rm(temporary.root, { recursive: true, force: true });
  }
});

test('simulation routes Ganache through the retrying fork proxy and closes both resources', async () => {
  const temporary = await temporaryOutput('github-native-proxy-routing-');
  let proxyClosed = false;
  let engineClosed = false;
  try {
    const jobFile = path.join(testDirectory, 'fixtures', 'missing-rpc', 'job.json');
    const result = await runGitHubNativeJob({
      jobFile,
      outputDir: temporary.output,
      environment: { RPC_ETHEREUM: 'http://127.0.0.1:1/private-rpc' },
      services: {
        startForkRpcProxy: async ({ upstreamUrl, block }) => {
          assert.equal(upstreamUrl, 'http://127.0.0.1:1/private-rpc');
          assert.equal(block, 'latest');
          return {
            url: 'http://127.0.0.1:8547',
            blockNumber: 123,
            diagnostics: {
              resolvedBlock: 123,
              blockNumberAttempts: 1,
              prefetchAttempts: 2,
              cacheHits: 0,
              forwardedRequests: 0
            },
            async close() { proxyClosed = true; }
          };
        },
        startGanacheEngine: async ({ forkUrl, block }) => {
          assert.equal(forkUrl, 'http://127.0.0.1:8547');
          assert.equal(block, 123);
          return {
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
    assert.equal(result.forkTransport.prefetchAttempts, 2);
    assert.equal(result.steps.length, 1);
    assert.equal(proxyClosed, true);
    assert.equal(engineClosed, true);
  } finally {
    await fs.rm(temporary.root, { recursive: true, force: true });
  }
});
