import fs from 'node:fs/promises';
import path from 'node:path';

const mode = process.argv[2];
const slotSecret = process.env.V27_RPC_SLOT_SECRET ?? 'RPC_ANVIL_ETHEREUM1';
const rpcUrl = process.env[slotSecret];
const resultRoot = path.resolve(process.env.RESULT_ROOT ?? 'github-native-sim/jobs/live-fork-v27-v1/result');
const controlRoot = path.resolve(process.env.V27_CONTROL_ROOT ?? '/tmp/v27-remote-anvil-control');
const statePath = path.join(controlRoot, 'workflow-outer-snapshot.json');
const cleanupPath = path.join(controlRoot, 'workflow-outer-cleanup.json');
const publishedCleanupPath = path.join(resultRoot, 'workflow-outer-cleanup.json');

if (!['begin', 'revert'].includes(mode)) {
  throw new Error('usage: remote-snapshot-guard.mjs <begin|revert>');
}
if (!rpcUrl) throw new Error(`${slotSecret} is required`);
await fs.mkdir(controlRoot, { recursive: true });

let requestId = 0;
async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
    signal: AbortSignal.timeout(30_000)
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(`${method} failed (${payload.error?.code ?? response.status}): ${payload.error?.message ?? response.statusText}`);
  }
  return payload.result;
}

async function blockIdentity() {
  const numberHex = await rpc('eth_blockNumber');
  const block = await rpc('eth_getBlockByNumber', [numberHex, false]);
  if (!block?.hash) throw new Error('Remote Anvil did not return a block hash');
  return {
    number: Number(BigInt(numberHex)),
    hash: block.hash,
    timestamp: Number(BigInt(block.timestamp))
  };
}

if (mode === 'begin') {
  const baseline = await blockIdentity();
  const snapshotId = await rpc('evm_snapshot');
  if (snapshotId == null) throw new Error('Remote Anvil did not create the workflow-level snapshot');
  const state = {
    version: 'v27-workflow-outer-snapshot/v2',
    slotSecret,
    snapshotId,
    baseline,
    createdAt: new Date().toISOString()
  };
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: 'created', slotSecret, baseline }, null, 2)}\n`);
} else {
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  if (state.slotSecret !== slotSecret) {
    throw new Error(`Snapshot belongs to ${state.slotSecret}, not ${slotSecret}`);
  }
  const reverted = await rpc('evm_revert', [state.snapshotId]);
  const restored = await blockIdentity();
  const cleanup = {
    version: 'v27-workflow-outer-cleanup/v2',
    slotSecret,
    reverted: reverted === true,
    baseline: state.baseline,
    restored,
    blockNumberMatches: restored.number === state.baseline.number,
    blockHashMatches: restored.hash.toLowerCase() === state.baseline.hash.toLowerCase(),
    finishedAt: new Date().toISOString()
  };
  cleanup.baselineFullyRestored = cleanup.reverted
    && cleanup.blockNumberMatches
    && cleanup.blockHashMatches;
  const serialized = `${JSON.stringify(cleanup, null, 2)}\n`;
  await fs.writeFile(cleanupPath, serialized);
  await fs.mkdir(resultRoot, { recursive: true });
  await fs.writeFile(publishedCleanupPath, serialized);
  process.stdout.write(serialized);
  if (!cleanup.baselineFullyRestored) {
    throw new Error(`Workflow-level remote snapshot cleanup failed: ${JSON.stringify(cleanup)}`);
  }
}
