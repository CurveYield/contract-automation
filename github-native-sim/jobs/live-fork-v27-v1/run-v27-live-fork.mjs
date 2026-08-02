import crypto from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const SOURCE_CHAIN_ID = 1;
const SLOT_SECRET = 'RPC_ANVIL_ETHEREUM1';
const rpcUrl = process.env[SLOT_SECRET];
const jobRoot = path.resolve(process.env.V27_JOB_ROOT ?? 'github-native-sim/jobs/live-fork-v27-v1');
const resultRoot = path.resolve(process.env.RESULT_ROOT ?? path.join(jobRoot, 'result'));
const lifecycle = path.join(jobRoot, 'scripts/run-v27-hardhat-lifecycle.mjs');
const reviewedHarnessPatch = path.join(jobRoot, 'patch-reviewed-v27-harness.py');
const startedAt = new Date().toISOString();
await fs.mkdir(resultRoot, { recursive: true });

if (!rpcUrl) throw new Error(`${SLOT_SECRET} is required`);

function json(value) {
  return `${JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2)}\n`;
}

function redact(value) {
  if (typeof value !== 'string') return value;
  return value.replaceAll(rpcUrl, `[redacted:${SLOT_SECRET}]`);
}

function childResult(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

function closeWriteStream(stream) {
  return new Promise((resolve, reject) => {
    stream.once('error', reject);
    stream.end(resolve);
  });
}

function progressSummary(report) {
  const cycles = Array.isArray(report?.cycles) ? report.cycles : [];
  const postMigrationCycles = Array.isArray(report?.postMigrationCycles) ? report.postMigrationCycles : [];
  const allCycles = [...cycles, ...postMigrationCycles];
  const latestCycle = allCycles.at(-1);
  const latestHarvest = latestCycle?.reconciliations?.harvestEvents?.at(-1) ?? null;
  const assertions = Array.isArray(report?.assertions) ? report.assertions : [];
  const calls = Array.isArray(report?.calls) ? report.calls : [];
  return {
    status: report?.status ?? 'running',
    calls: calls.length,
    successfulTransactions: calls.filter((entry) => entry?.method === 'eth_sendTransaction' && entry?.receiptStatus === 1).length,
    assertionsPassed: assertions.filter((entry) => entry?.passed === true).length,
    assertionCount: assertions.length,
    harvestCycles: cycles.length,
    postMigrationCycles: postMigrationCycles.length,
    latestCycle: latestCycle?.cycle ?? null,
    latestHarvest: latestHarvest && {
      grossSdYB: latestHarvest.grossSdYB ?? '0',
      feeSdYB: latestHarvest.feeSdYB ?? '0',
      retainedSdYB: latestHarvest.retainedSdYB ?? '0',
      complete: latestHarvest.complete === true
    }
  };
}

function startProgressReporter(reportPath) {
  let stopped = false;
  let lastSummary = '';
  const check = async () => {
    if (stopped) return;
    try {
      const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
      const summary = JSON.stringify(progressSummary(report));
      if (summary !== lastSummary) {
        process.stdout.write(`[v27-progress] ${summary}\n`);
        lastSummary = summary;
      }
    } catch (error) {
      if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
        process.stderr.write(`[v27-progress] report read warning: ${redact(error?.message ?? String(error))}\n`);
      }
    }
  };
  const timer = setInterval(check, 10_000);
  void check();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await check();
  };
}

let requestId = 0;
async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params })
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${method} returned invalid JSON`);
  }
  if (!response.ok || payload.error) {
    const code = payload.error?.code ?? response.status;
    const message = payload.error?.message ?? response.statusText;
    throw new Error(`${method} failed (${code}): ${message}`);
  }
  return payload.result;
}

let snapshotId;
let baseline;
let childExit;
let failure;
let wrapperReport = {
  version: 'v27-persistent-remote-anvil-wrapper/v1',
  status: 'running',
  startedAt,
  assurance: 'persistent-remote-anvil-fork',
  sourceChainId: SOURCE_CHAIN_ID,
  transport: {
    type: 'authenticated-remote-json-rpc',
    slotSecret: SLOT_SECRET,
    stickyForWholeRun: true,
    localExecutionEngine: false
  },
  broadcastTransactions: false
};

try {
  await execFileAsync('python', [reviewedHarnessPatch, lifecycle], {
    cwd: process.cwd(),
    maxBuffer: 1_000_000
  });
  const effectiveLifecycle = await fs.readFile(lifecycle);
  await fs.writeFile(
    path.join(resultRoot, 'effective-lifecycle-sha256.txt'),
    `${crypto.createHash('sha256').update(effectiveLifecycle).digest('hex')}  ${lifecycle}\n`
  );
  await fs.copyFile(lifecycle, path.join(resultRoot, 'effective-lifecycle.mjs'));

  const clientVersion = await rpc('web3_clientVersion');
  const rpcChainId = Number(BigInt(await rpc('eth_chainId')));
  const baselineBlockHex = await rpc('eth_blockNumber');
  const baselineBlock = await rpc('eth_getBlockByNumber', [baselineBlockHex, false]);
  if (!baselineBlock?.hash) throw new Error('Remote Anvil did not return a baseline block hash');

  const wethCode = await rpc('eth_getCode', [WETH, 'latest']);
  if (wethCode === '0x') throw new Error('Canonical Ethereum WETH code is absent from the remote fork');

  baseline = {
    blockNumber: Number(BigInt(baselineBlockHex)),
    blockHash: baselineBlock.hash,
    blockTimestamp: Number(BigInt(baselineBlock.timestamp))
  };
  wrapperReport.rpcChainId = rpcChainId;
  wrapperReport.clientVersion = clientVersion;
  wrapperReport.forkIdentity = {
    sourceChain: 'ethereum',
    sourceChainId: SOURCE_CHAIN_ID,
    ...baseline,
    canonicalWethPresent: true,
    canonicalWethCodeBytes: (wethCode.length - 2) / 2
  };

  snapshotId = await rpc('evm_snapshot');
  if (snapshotId == null) throw new Error('Remote Anvil did not create the outer simulation snapshot');

  const stdoutFile = path.join(resultRoot, 'workflow-stdout.log');
  const stderrFile = path.join(resultRoot, 'workflow-stderr.log');
  const stdoutStream = createWriteStream(stdoutFile, { flags: 'w' });
  const stderrStream = createWriteStream(stderrFile, { flags: 'w' });
  const stopProgressReporter = startProgressReporter(path.join(resultRoot, 'data-report.json'));
  process.stdout.write(`[v27-progress] ${JSON.stringify({
    status: 'starting',
    rpcChainId,
    sourceChainId: SOURCE_CHAIN_ID,
    forkBlock: baseline.blockNumber
  })}\n`);

  try {
    const child = spawn(process.execPath, [lifecycle], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HARDHAT_RPC_URL: rpcUrl,
        RPC_ETHEREUM: rpcUrl,
        RESULT_ROOT: resultRoot,
        V27_SHARED_PROXY_BLOCK: String(baseline.blockNumber),
        V27_SHARED_PROXY_HASH: baseline.blockHash,
        V27_REMOTE_ANVIL_CHAIN_ID: String(rpcChainId),
        V27_SOURCE_CHAIN_ID: String(SOURCE_CHAIN_ID)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', (chunk) => {
      stdoutStream.write(chunk);
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderrStream.write(chunk);
      process.stderr.write(chunk);
    });
    childExit = await childResult(child);
  } finally {
    await stopProgressReporter();
    await Promise.all([closeWriteStream(stdoutStream), closeWriteStream(stderrStream)]);
  }

  wrapperReport.childExit = childExit;
  wrapperReport.status = childExit.code === 0 ? 'completed' : 'failed';
  if (childExit.code !== 0) {
    throw new Error(`V27 lifecycle exited with code ${childExit.code ?? 'null'}${childExit.signal ? ` signal ${childExit.signal}` : ''}`);
  }
} catch (error) {
  failure = error;
  wrapperReport.status = 'failed';
  wrapperReport.error = {
    name: error?.name ?? 'Error',
    message: redact(error?.message ?? String(error)),
    code: error?.code
  };
} finally {
  if (snapshotId != null && baseline) {
    try {
      const reverted = await rpc('evm_revert', [snapshotId]);
      const restoredBlockHex = await rpc('eth_blockNumber');
      const restoredBlock = await rpc('eth_getBlockByNumber', [restoredBlockHex, false]);
      const cleanup = {
        reverted: reverted === true,
        restoredBlockNumber: Number(BigInt(restoredBlockHex)),
        restoredBlockHash: restoredBlock?.hash ?? null,
        blockNumberMatchesBaseline: Number(BigInt(restoredBlockHex)) === baseline.blockNumber,
        blockHashMatchesBaseline: String(restoredBlock?.hash ?? '').toLowerCase() === baseline.blockHash.toLowerCase()
      };
      cleanup.baselineFullyRestored = cleanup.reverted
        && cleanup.blockNumberMatchesBaseline
        && cleanup.blockHashMatchesBaseline;
      wrapperReport.cleanup = cleanup;
      if (!cleanup.baselineFullyRestored && !failure) {
        failure = new Error(`Remote Anvil cleanup verification failed: ${JSON.stringify(cleanup)}`);
        wrapperReport.status = 'failed';
        wrapperReport.error = { name: failure.name, message: failure.message };
      }
    } catch (cleanupError) {
      wrapperReport.cleanup = {
        reverted: false,
        baselineFullyRestored: false,
        error: redact(cleanupError?.message ?? String(cleanupError))
      };
      if (!failure) failure = cleanupError;
      wrapperReport.status = 'failed';
      wrapperReport.error ??= {
        name: cleanupError?.name ?? 'Error',
        message: redact(cleanupError?.message ?? String(cleanupError))
      };
    }
  }

  wrapperReport.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(resultRoot, 'live-fork-wrapper-report.json'), json(wrapperReport));
  process.stdout.write(json(wrapperReport));
}

if (failure) throw failure;
