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
