import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { loadArchiveRpcSlots } from '../../../packages/runner/src/archive-rpc-pool.mjs';
import { startForkEngine } from '../../../packages/runner/src/fork-engine.mjs';
import { startLiveForkProxy } from '../../../packages/runner/src/live-fork-proxy.mjs';
import {
  closeRpcHealthSession,
  filterDisabledRpcSlots,
  openRpcHealthSession
} from '../../../packages/runner/src/rpc-health-session.mjs';

const jobRoot = path.resolve(process.env.V27_JOB_ROOT ?? 'github-native-sim/jobs/live-fork-v27-v1');
const resultRoot = path.resolve(process.env.RESULT_ROOT ?? path.join(jobRoot, 'result'));
const lifecycle = path.join(jobRoot, 'scripts/run-v27-hardhat-lifecycle.mjs');
const startedAt = new Date().toISOString();
await fs.mkdir(resultRoot, { recursive: true });

function json(value) {
  return `${JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2)}\n`;
}

function childResult(child, stdout, stderr) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

let proxy;
let engine;
let healthSession;
let healthPersist;
let childExit;
try {
  healthSession = await openRpcHealthSession({
    environment: process.env,
    chain: 'ethereum',
    crossSessionFailureThreshold: 4
  });
  const configuredSlots = loadArchiveRpcSlots({
    chainName: 'ethereum',
    legacyEnv: 'RPC_ETHEREUM',
    environment: process.env,
    allowLegacyFallback: true
  });
  const slots = filterDisabledRpcSlots(configuredSlots, healthSession.disabledSlotIds);
  if (slots.length === 0) throw new Error('No healthy Ethereum archive RPC slots are configured');

  proxy = await startLiveForkProxy({
    slots,
    chainId: 1,
    blockPolicy: { mode: 'latest-at-start' },
    routing: {
      distribution: { strategy: 'round-robin' },
      methodRoutes: {
        'debug_*': 'primary',
        'trace_*': 'primary',
        eth_getCode: 'secondary',
        eth_getStorageAt: 'secondary',
        eth_getBalance: 'secondary',
        eth_call: 'secondary',
        eth_getLogs: 'secondary'
      },
      allowPrimaryForSecondaryFailure: true,
      allowSecondaryForPrimaryFailure: false,
      retryDelaysMs: [0, 250, 1_000, 2_500],
      requestTimeoutMs: 30_000
    },
    healthPolicy: {
      sessionFailureThreshold: 3,
      crossSessionFailureThreshold: 4
    },
    consistency: {
      requireChainIdMatch: true,
      requireForkBlockHashMatch: true,
      crossCheckProviders: 1,
      onDisagreement: 'fail'
    }
  });

  engine = await startForkEngine({
    mode: 'hardhat-edr',
    artifacts: { get() { throw new Error('V27 lifecycle owns its compiled artifacts'); } },
    workflow: { steps: [] },
    chainId: 1,
    forkUrl: proxy.url,
    forkControl: proxy,
    block: proxy.blockNumber,
    configuration: {
      engine: { mode: 'hardhat-edr' },
      fork: { start: { mode: 'latest-at-start' } }
    },
    options: { startupTimeoutMs: 60_000 }
  });

  const stdoutFile = path.join(resultRoot, 'workflow-stdout.log');
  const stderrFile = path.join(resultRoot, 'workflow-stderr.log');
  const stdoutHandle = await fs.open(stdoutFile, 'w');
  const stderrHandle = await fs.open(stderrFile, 'w');
  try {
    const child = spawn(process.execPath, [lifecycle], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HARDHAT_RPC_URL: engine.url,
        RPC_ETHEREUM: proxy.url,
        RESULT_ROOT: resultRoot,
        V27_SHARED_PROXY_BLOCK: String(proxy.blockNumber),
        V27_SHARED_PROXY_HASH: proxy.blockHash
      },
      stdio: ['ignore', stdoutHandle.fd, stderrHandle.fd]
    });
    childExit = await childResult(child, stdoutFile, stderrFile);
  } finally {
    await stdoutHandle.close();
    await stderrHandle.close();
  }

  const engineEvidence = await engine.getEvidence();
  healthPersist = await closeRpcHealthSession({
    session: healthSession,
    environment: process.env,
    diagnostics: proxy.diagnostics.rpc,
    runId: process.env.GITHUB_RUN_ID ?? 'v27-live-fork'
  });
  const equality = {
    proxyBlockNumber: proxy.blockNumber,
    proxyBlockHash: proxy.blockHash,
    edrForkBlockNumber: Number(engineEvidence.metadata?.forkedNetwork?.forkBlockNumber),
    edrForkBlockHash: engineEvidence.metadata?.forkedNetwork?.forkBlockHash,
    numberMatches: Number(engineEvidence.metadata?.forkedNetwork?.forkBlockNumber) === proxy.blockNumber,
    hashMatches: String(engineEvidence.metadata?.forkedNetwork?.forkBlockHash).toLowerCase() === String(proxy.blockHash).toLowerCase()
  };
  if (!equality.numberMatches || !equality.hashMatches) {
    throw new Error(`V27 fork identity mismatch: ${JSON.stringify(equality)}`);
  }
  const wrapperReport = {
    version: 'v27-shared-live-fork-wrapper/v1',
    status: 'completed',
    startedAt,
    finishedAt: new Date().toISOString(),
    childExit,
    assurance: proxy.diagnostics.assurance,
    forkIdentity: equality,
    engine: { name: engine.name, version: engine.version, evidence: engineEvidence },
    transport: proxy.diagnostics,
    rpcHealth: { load: healthSession.load, persist: healthPersist },
    broadcastTransactions: false
  };
  await fs.writeFile(path.join(resultRoot, 'live-fork-wrapper-report.json'), json(wrapperReport));
  process.stdout.write(json(wrapperReport));
  process.exitCode = childExit.code ?? 1;
} catch (error) {
  try {
    if (healthSession && !healthPersist) {
      healthPersist = await closeRpcHealthSession({
        session: healthSession,
        environment: process.env,
        diagnostics: proxy?.diagnostics?.rpc,
        runId: process.env.GITHUB_RUN_ID ?? 'v27-live-fork'
      });
    }
  } catch {}
  const failure = {
    version: 'v27-shared-live-fork-wrapper/v1',
    status: 'failed',
    startedAt,
    finishedAt: new Date().toISOString(),
    error: {
      name: error?.name ?? 'Error',
      message: error?.message ?? String(error),
      code: error?.code,
      hardhatLogTail: error?.hardhatLogTail
    },
    childExit,
    transport: proxy?.diagnostics,
    rpcHealth: healthSession ? { load: healthSession.load, persist: healthPersist } : undefined
  };
  await fs.writeFile(path.join(resultRoot, 'live-fork-wrapper-report.json'), json(failure));
  throw error;
} finally {
  await Promise.resolve(engine?.close?.()).catch(() => {});
  await Promise.resolve(proxy?.close?.()).catch(() => {});
}
