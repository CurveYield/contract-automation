import test from 'node:test';
import assert from 'node:assert/strict';

import { runJob } from '../src/run-job.mjs';

const SOURCE = `// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;
contract Counter { uint256 public value; function set(uint256 next) external { value = next; } }
`;

test('Cloudflare-orchestrated simulation uses healthy archive pools and configured engine', async () => {
  const statuses = [];
  const healthEvents = [];
  let published;
  let proxyClosed = false;
  let engineClosed = false;
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
          engine: { mode: 'hardhat-edr' },
          fork: { start: { mode: 'latest-at-start' } },
          rpc: { allowLegacyRpcFallback: false }
        }
      };
    },
    async publishResult(_jobId, result, report) { published = { result, report }; }
  };
  const rpcHealthStore = {
    async load() {
      return {
        issueNumber: 20,
        disabledSlotIds: ['primary-02'],
        state: { slots: { 'primary-02': { disabled: true } } }
      };
    },
    async recordSession(input) {
      healthEvents.push(input);
      return {
        backend: 'github-issue',
        ledgerIssueNumber: 20,
        disabledSlotIds: ['primary-02'],
        newlyDisabled: [],
        incidentIssues: []
      };
    }
  };

  const result = await runJob({
    jobId: 'cloudflare-live-fork-test',
    apiUrl: 'https://unused.invalid',
    runnerApiKey: 'unused',
    environment: {
      SIM_ARCHIVE_PRIMARY_ETHEREUM_01: 'http://127.0.0.1:1/primary-secret',
      SIM_ARCHIVE_PRIMARY_ETHEREUM_02: 'http://127.0.0.1:9/disabled-secret',
      SIM_ARCHIVE_SECONDARY_ETHEREUM_01: 'http://127.0.0.1:2/secondary-secret'
    },
    services: {
      apiClient,
      rpcHealthStore,
      startLiveForkProxy: async ({ slots, blockPolicy, chainId, healthPolicy }) => {
        assert.equal(chainId, 1);
        assert.deepEqual(slots.map(({ id, pool }) => ({ id, pool })), [
          { id: 'primary-01', pool: 'primary' },
          { id: 'secondary-01', pool: 'secondary' }
        ]);
        assert.deepEqual(blockPolicy, { mode: 'latest-at-start' });
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
            rpc: {
              slots: [{
                id: 'secondary-01', pool: 'secondary', requests: 8,
                successes: 8, failures: 0, quarantined: false,
                lastFailureClass: null
              }]
            }
          },
          async close() { proxyClosed = true; }
        };
      },
      startForkEngine: async ({ mode, forkUrl, forkControl, block }) => {
        assert.equal(mode, 'hardhat-edr');
        assert.equal(forkUrl, 'http://127.0.0.1:8547');
        assert.equal(forkControl.blockNumber, 123);
        assert.equal(block, 123);
        return {
          name: 'hardhat-edr',
          version: '3.12.0',
          aliases: { account0: '0x0000000000000000000000000000000000000001' },
          runtime: { async execute(step) { return { blocks: step.blocks }; } },
          async getEvidence() { return { finalBlockNumber: 124, finalBlockTimestamp: 112 }; },
          async close() { engineClosed = true; }
        };
      }
    }
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.resolvedBlock, 123);
  assert.equal(result.resolvedBlockHash, `0x${'ab'.repeat(32)}`);
  assert.equal(result.engine.name, 'hardhat-edr');
  assert.equal(result.engine.runtime.finalBlockNumber, 124);
  assert.equal(result.forkTransport.assurance, 'continuous-archive-backed-local-fork');
  assert.equal(result.rpcHealth.load.status, 'loaded');
  assert.equal(result.rpcHealth.persist.status, 'recorded');
  assert.equal(result.steps.length, 1);
  assert.equal(healthEvents.length, 1);
  assert.equal(healthEvents[0].runId, 'cloudflare-live-fork-test');
  assert.equal(proxyClosed, true);
  assert.equal(engineClosed, true);
  assert.equal(published.result.status, 'completed');
  assert.match(published.report, /cloudflare-live-fork-test/);
  assert.ok(statuses.some((status) => status.stage === 'starting_fork'));
});
