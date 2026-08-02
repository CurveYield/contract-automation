import fs from 'node:fs/promises';
import path from 'node:path';

import { loadArchiveRpcSlots } from '../packages/runner/src/archive-rpc-pool.mjs';
import { startForkEngine } from '../packages/runner/src/fork-engine.mjs';
import { startLiveForkProxy } from '../packages/runner/src/live-fork-proxy.mjs';
import { executeWorkflow } from '../packages/runner/src/workflow.mjs';

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const outputDirectory = path.resolve(process.env.LIVE_FORK_SMOKE_OUTPUT ?? 'live-fork-smoke-output');
const progressFile = path.join(outputDirectory, 'progress.log');
await fs.mkdir(outputDirectory, { recursive: true });

async function mark(name, detail = {}) {
  const entry = { at: new Date().toISOString(), name, ...detail };
  await fs.appendFile(progressFile, `${JSON.stringify(entry)}\n`, 'utf8');
  process.stdout.write(`[live-fork-smoke] ${name}\n`);
}

let proxy;
let engine;
let completed = false;
const startedAt = new Date().toISOString();
const watchdog = setTimeout(async () => {
  await mark('watchdog-timeout').catch(() => {});
  process.exit(124);
}, 90_000);

try {
  await mark('starting');
  const slots = loadArchiveRpcSlots({
    chainName: 'ethereum',
    legacyEnv: 'RPC_ETHEREUM',
    environment: process.env,
    allowLegacyFallback: true
  });
  if (slots.length === 0) throw new Error('No Ethereum archive RPC slots are configured');
  await mark('slots-loaded', { slots: slots.map(({ id, pool }) => ({ id, pool })) });
  proxy = await startLiveForkProxy({
    slots,
    chainId: 1,
    blockPolicy: { mode: 'latest-at-start' },
    routing: {
      distribution: { strategy: 'round-robin' },
      retryDelaysMs: [0, 250, 1_000, 2_500],
      requestTimeoutMs: 30_000,
      allowPrimaryForSecondaryFailure: true,
      allowSecondaryForPrimaryFailure: false
    },
    healthPolicy: { sessionFailureThreshold: 3 },
    consistency: { requireChainIdMatch: true, requireForkBlockHashMatch: true }
  });
  await mark('proxy-started', { blockNumber: proxy.blockNumber, blockHash: proxy.blockHash });

  const workflow = {
    steps: [
      { action: 'snapshot', alias: 'before-time' },
      { action: 'increaseTime', seconds: 3_600 },
      { action: 'mine', blocks: 3, intervalSeconds: 12 },
      { action: 'revertSnapshot', snapshot: '$before-time' }
    ]
  };
  engine = await startForkEngine({
    mode: 'hardhat-edr',
    artifacts: { get() { throw new Error('No contract artifacts are used by the smoke'); } },
    workflow,
    chainId: 1,
    forkUrl: proxy.url,
    block: proxy.blockNumber,
    configuration: {
      engine: { mode: 'hardhat-edr' },
      fork: { start: { mode: 'latest-at-start' } }
    },
    forkControl: proxy,
    options: { startupTimeoutMs: 60_000 }
  });
  await mark('engine-started', { engine: engine.name, version: engine.version });

  const code = await engine.provider.getCode(WETH);
  if (code === '0x' || code.length < 100) throw new Error('WETH runtime code was not loaded from the live Ethereum fork');
  await mark('upstream-code-loaded', { runtimeBytes: (code.length - 2) / 2 });
  const before = await engine.provider.getBlock('latest');
  const execution = await executeWorkflow(workflow, engine.runtime, { aliases: engine.aliases });
  await mark('workflow-completed', { steps: execution.steps.length });
  const after = await engine.provider.getBlock('latest');
  const evidence = await engine.getEvidence();
  const result = {
    status: 'completed',
    assurance: proxy.diagnostics.assurance,
    chainId: 1,
    forkBlockNumber: proxy.blockNumber,
    forkBlockHash: proxy.blockHash,
    forkBlockTimestamp: proxy.blockTimestamp,
    engine: { name: engine.name, version: engine.version },
    upstreamCodeCheck: { address: WETH, runtimeBytes: (code.length - 2) / 2 },
    before: { number: Number(before.number), hash: before.hash, timestamp: Number(before.timestamp) },
    after: { number: Number(after.number), hash: after.hash, timestamp: Number(after.timestamp) },
    steps: execution.steps,
    transport: proxy.diagnostics,
    engineEvidence: evidence,
    startedAt,
    finishedAt: new Date().toISOString()
  };
  await fs.writeFile(path.join(outputDirectory, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  await mark('result-written');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  completed = true;
} catch (error) {
  const result = {
    status: 'failed',
    error: {
      name: error?.name ?? 'Error',
      message: error?.message ?? String(error),
      code: error?.code,
      hardhatLogTail: error?.hardhatLogTail
    },
    transport: proxy?.diagnostics,
    startedAt,
    finishedAt: new Date().toISOString()
  };
  await fs.writeFile(path.join(outputDirectory, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  await mark('failed', { message: result.error.message });
  throw error;
} finally {
  await mark('engine-close-start').catch(() => {});
  await engine?.close().catch(async (error) => mark('engine-close-error', { message: error?.message ?? String(error) }));
  await mark('engine-close-finished').catch(() => {});
  await mark('proxy-close-start').catch(() => {});
  await proxy?.close().catch(async (error) => mark('proxy-close-error', { message: error?.message ?? String(error) }));
  await mark('proxy-close-finished').catch(() => {});
  clearTimeout(watchdog);
  if (completed) await mark('finished').catch(() => {});
}
