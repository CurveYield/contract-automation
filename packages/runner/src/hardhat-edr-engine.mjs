import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { LiveForkWorkflowRuntime } from './live-fork-runtime.mjs';
import { latestBlock } from './live-fork-time.mjs';

function literalActors(workflow) {
  const actors = new Set();
  for (const step of workflow.steps) {
    const value = step.from;
    if (typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)) actors.add(value);
  }
  return [...actors];
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function hardhatExecutable() {
  const name = process.platform === 'win32' ? 'hardhat.cmd' : 'hardhat';
  return path.join(process.cwd(), 'node_modules', '.bin', name);
}

function configSource({ chainId, hardfork, blockGasLimit, transactionGasCap, blockNumber }) {
  return `import { defineConfig } from 'hardhat/config';
const forkUrl = process.env.CURVEYIELD_FORK_RPC_URL;
if (!forkUrl) throw new Error('CURVEYIELD_FORK_RPC_URL is required');
export default defineConfig({
  solidity: '0.8.30',
  networks: {
    liveFork: {
      type: 'edr-simulated',
      chainType: 'l1',
      chainId: ${chainId},
      hardfork: ${JSON.stringify(hardfork)},
      blockGasLimit: ${blockGasLimit},
      transactionGasCap: ${transactionGasCap},
      forking: { url: forkUrl, blockNumber: ${blockNumber} }
    }
  }
});
`;
}

async function waitForNode(provider, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Hardhat EDR exited before readiness with code ${child.exitCode}`);
    try {
      const clientVersion = await provider.send('web3_clientVersion', []);
      const metadata = await provider.send('hardhat_metadata', []);
      return { clientVersion, metadata };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Hardhat EDR node did not become ready: ${lastError?.message ?? lastError}`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000))
  ]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000))
    ]);
  }
  child.unref();
}

async function destroyProvider(provider) {
  try {
    await Promise.resolve(provider?.destroy?.());
  } catch {}
}

async function resolveReforkTarget(step, forkControl) {
  if (step.target.mode === 'explicit') return { blockNumber: step.target.blockNumber };
  if (!forkControl?.resolveBlock) {
    throw new Error(`Refork target ${step.target.mode} requires fork-control resolution`);
  }
  return forkControl.resolveBlock(step.target);
}

export async function startHardhatEdrEngine({
  artifacts,
  workflow,
  chainId,
  forkUrl,
  block,
  forkControl,
  options = {}
}) {
  if (!Number.isSafeInteger(block) || block < 0) throw new Error('Hardhat EDR requires an exact safe fork block');
  const ethers = await import('ethers');
  const executable = hardhatExecutable();
  try {
    await fs.access(executable);
  } catch {
    const error = new Error('Hardhat 3.12.0 is not installed in trusted runner dependencies');
    error.code = 'engine_dependency_missing';
    throw error;
  }

  const port = await reservePort();
  const configPath = path.join(process.cwd(), `.curveyield-live-fork-${randomUUID()}.config.mjs`);
  const logPath = path.join(process.cwd(), `.curveyield-live-fork-${randomUUID()}.log`);
  const hardfork = options.hardfork ?? 'osaka';
  const blockGasLimit = options.blockGasLimit ?? 60_000_000;
  const transactionGasCap = options.transactionGasCap ?? 16_777_216;
  await fs.writeFile(
    configPath,
    configSource({ chainId, hardfork, blockGasLimit, transactionGasCap, blockNumber: block }),
    'utf8'
  );
  const logHandle = await fs.open(logPath, 'w');
  const child = spawn(executable, [
    'node',
    '--config', configPath,
    '--network', 'liveFork',
    '--hostname', '127.0.0.1',
    '--port', String(port)
  ], {
    cwd: process.cwd(),
    env: { ...process.env, CURVEYIELD_FORK_RPC_URL: forkUrl },
    stdio: ['ignore', logHandle.fd, logHandle.fd]
  });

  const url = `http://127.0.0.1:${port}`;
  const provider = new ethers.JsonRpcProvider(url, chainId, { staticNetwork: true });
  let metadata;
  let clientVersion;
  const actors = literalActors(workflow);
  try {
    ({ metadata, clientVersion } = await waitForNode(provider, child, options.startupTimeoutMs ?? 60_000));
    if (!/hardhat/i.test(String(clientVersion))) throw new Error(`Unexpected local EVM client: ${clientVersion}`);
    const actualForkBlock = Number(metadata?.forkedNetwork?.forkBlockNumber);
    if (actualForkBlock !== block) {
      throw new Error(`Hardhat EDR fork block mismatch: requested ${block}, received ${actualForkBlock}`);
    }
    for (const actor of actors) await provider.send('hardhat_impersonateAccount', [actor]);
    const accounts = await provider.send('eth_accounts', []);
    const aliases = Object.fromEntries(accounts.map((account, index) => [`account${index}`, account]));

    let runtime;
    const reforkHandler = async (step, context) => {
      const target = await resolveReforkTarget(step, forkControl);
      const stateStrategy = step.stateStrategy ?? 'discard';
      if (stateStrategy === 'state-overlay') {
        throw new Error('Hardhat EDR cannot capture a complete state overlay');
      }
      if (stateStrategy === 'custom-handler') {
        if (typeof options.customReforkHandler !== 'function') {
          throw new Error('custom-handler requires a trusted customReforkHandler');
        }
        return options.customReforkHandler({ step, context, provider, target });
      }

      const previousHistory = [...(context.history ?? [])];
      const previousCheckpointSteps = { ...(context.checkpointSteps ?? {}) };
      const baseAliases = Object.fromEntries(Object.entries(context.aliases).filter(([key]) => /^account\d+$/.test(key)));
      await provider.send('hardhat_reset', [{
        forking: { jsonRpcUrl: forkUrl, blockNumber: target.blockNumber }
      }]);
      for (const actor of actors) await provider.send('hardhat_impersonateAccount', [actor]);
      context.aliases = { ...baseAliases };
      context.values = {};
      context.snapshots = {};
      context.deployments = {};
      context.history = [];
      context.checkpointSteps = {};

      let replaySteps = [];
      if (stateStrategy === 'replay-workflow' || stateStrategy === 'transaction-journal') replaySteps = previousHistory;
      if (stateStrategy === 'replay-selected-steps') {
        const from = step.replay?.fromStep ?? 0;
        const through = step.replay?.throughStep ?? previousHistory.length - 1;
        replaySteps = previousHistory.slice(from, through + 1);
      }
      if (stateStrategy === 'replay-from-checkpoint') {
        const checkpoint = step.replay?.checkpoint;
        const from = checkpoint === undefined ? 0 : previousCheckpointSteps[checkpoint];
        if (!Number.isInteger(from)) throw new Error(`Unknown replay checkpoint: ${checkpoint}`);
        replaySteps = previousHistory.slice(from);
      }
      for (const replayStep of replaySteps) {
        const output = await runtime.execute(replayStep, context);
        context.history.push(replayStep);
        if (replayStep.action === 'snapshot' && replayStep.alias) {
          context.checkpointSteps[replayStep.alias] = context.history.length;
        }
        if (step.replay?.verifyOutputs && output === undefined) {
          throw new Error(`Replay produced no output for ${replayStep.action}`);
        }
      }
      const localHead = await latestBlock(provider);
      return {
        blockNumber: localHead.number,
        blockTimestamp: localHead.timestamp,
        stateStrategy,
        replayedSteps: replaySteps.length
      };
    };

    runtime = new LiveForkWorkflowRuntime({
      provider,
      artifacts,
      ethers,
      reforkHandler,
      engineName: 'hardhat-edr'
    });
    return {
      provider,
      runtime,
      aliases,
      url,
      metadata,
      clientVersion,
      processId: child.pid,
      async getEvidence() {
        const localHead = await latestBlock(provider);
        const currentMetadata = await provider.send('hardhat_metadata', []);
        return {
          clientVersion,
          metadata: currentMetadata,
          finalBlockNumber: localHead.number,
          finalBlockTimestamp: localHead.timestamp
        };
      },
      async close() {
        await destroyProvider(provider);
        await stopChild(child);
        await logHandle.close().catch(() => {});
        await fs.rm(configPath, { force: true });
        await fs.rm(logPath, { force: true });
      }
    };
  } catch (error) {
    await destroyProvider(provider);
    await stopChild(child);
    await logHandle.close().catch(() => {});
    let logTail = '';
    try {
      const log = await fs.readFile(logPath, 'utf8');
      logTail = log.slice(-4_000);
    } catch {}
    await fs.rm(configPath, { force: true });
    await fs.rm(logPath, { force: true });
    if (logTail) error.hardhatLogTail = logTail;
    throw error;
  }
}
