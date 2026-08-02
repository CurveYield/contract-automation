import test from 'node:test';
import assert from 'node:assert/strict';

import { runJob } from '../src/run-job.mjs';

const SOURCE = `// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;
contract Counter { uint256 public value; function set(uint256 next) external { value = next; } }
`;

const REMOTE_URL = 'https://remote-anvil.invalid/secret-token';
const BLOCK_HASH = `0x${'ab'.repeat(32)}`;

test('remote-rpc simulation uses the trusted persistent Anvil endpoint and never starts an archive proxy', async () => {
  const statuses = [];
  let published;
  let engineClosed = false;
  let proxyStarted = false;
  const apiClient = {
    async updateStatus(_jobId, status) { statuses.push(status); },
    async getJob(jobId) {
      return {
        jobId,
        createdAt: '2026-08-02T00:00:00.000Z',
        mode: 'simulate',
        project: { type: 'inline', files: { 'Counter.sol': SOURCE } },
        compilerVersion: '0.8.30',
        chain: 'ethereum',
        block: 'latest',
        timeoutMinutes: 10,
        workflow: { steps: [{ action: 'mine', blocks: 1 }] },
        optimizer: { enabled: true, runs: 200 },
        viaIR: false,
        simulation: {
          engine: { mode: 'remote-rpc' },
          fork: { start: { mode: 'latest-at-start' } },
          rpc: { allowLegacyRpcFallback: false }
        }
      };
    },
    async publishResult(_jobId, result, report) { published = { result, report }; }
  };

  const result = await runJob({
    jobId: 'remote-runner-test',
    apiUrl: 'https://unused.invalid',
    runnerApiKey: 'unused',
    environment: { RPC_ANVIL_ETHEREUM1: REMOTE_URL },
    services: {
      apiClient,
      startLiveForkProxy: async () => {
        proxyStarted = true;
        throw new Error('archive proxy must not start for remote-rpc');
      },
      startForkEngine: async (options) => {
        assert.equal(options.mode, 'remote-rpc');
        assert.equal(options.rpcUrl, REMOTE_URL);
        assert.equal(options.forkUrl, undefined);
        assert.equal(options.chainId, 1);
        return {
          name: 'remote-rpc',
          version: 'anvil-json-rpc',
          aliases: { account0: '0x0000000000000000000000000000000000000001' },
          runtime: { async execute(step) { return { blocks: step.blocks }; } },
          async getEvidence() {
            return {
              assurance: 'remote-mutable-rpc',
              chainId: 1,
              initialBlockNumber: 100,
              initialBlockHash: BLOCK_HASH,
              initialBlockTimestamp: 101,
              capabilityProof: {
                remoteMutationReadBack: true,
                revertedAfterProof: true
              },
              persistentForkRestoredOnClose: true
            };
          },
          async close() { engineClosed = true; }
        };
      }
    }
  });

  assert.equal(proxyStarted, false);
  assert.equal(engineClosed, true);
  assert.equal(result.status, 'completed');
  assert.equal(result.resolvedBlock, 100);
  assert.equal(result.resolvedBlockHash, BLOCK_HASH);
  assert.equal(result.resolvedBlockTimestamp, 101);
  assert.equal(result.engine.name, 'remote-rpc');
  assert.equal(result.engine.runtime.assurance, 'remote-mutable-rpc');
  assert.equal(result.forkTransport.assurance, 'remote-mutable-rpc');
  assert.equal(result.forkTransport.slotId, 'anvil-ethereum-1');
  assert.equal(result.rpcHealth, undefined);
  assert.equal(published.result.status, 'completed');
  assert.equal(published.report.includes('secret-token'), false);
  assert.ok(statuses.some((status) => status.stage === 'starting_remote_fork'));
});
