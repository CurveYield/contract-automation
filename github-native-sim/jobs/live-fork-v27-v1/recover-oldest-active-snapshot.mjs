import fs from 'node:fs/promises';
import path from 'node:path';

const slotSecret = process.argv[2] ?? process.env.V27_RPC_SLOT_SECRET;
const rpcUrl = slotSecret ? process.env[slotSecret] : null;
const reportRoot = path.resolve(process.env.V27_RECOVERY_ROOT ?? '/tmp/v27-remote-anvil-recovery');

if (!slotSecret) throw new Error('usage: recover-oldest-active-snapshot.mjs <RPC_SECRET_NAME>');
if (!rpcUrl) throw new Error(`${slotSecret} is required`);
await fs.mkdir(reportRoot, { recursive: true });

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

const before = await blockIdentity();
const nodeInfo = await rpc('anvil_nodeInfo');
const snapshots = Object.entries(nodeInfo?.snapshots ?? {}).map(([id, identity]) => ({
  id,
  numericId: BigInt(id),
  number: Number(identity?.[0]),
  hash: String(identity?.[1] ?? '')
})).sort((a, b) => a.numericId < b.numericId ? -1 : a.numericId > b.numericId ? 1 : 0);

let selected = null;
let reverted = null;
let after = before;

if (snapshots.length > 0) {
  selected = snapshots[0];
  reverted = await rpc('evm_revert', [selected.id]);
  after = await blockIdentity();
}

const report = {
  version: 'v27-interrupted-fork-recovery/v1',
  slotSecret,
  before,
  activeSnapshotCount: snapshots.length,
  activeSnapshots: snapshots.map(({ id, number, hash }) => ({ id, number, hash })),
  selected: selected && { id: selected.id, number: selected.number, hash: selected.hash },
  reverted,
  after,
  restoredToSelectedSnapshot: selected
    ? reverted === true
      && after.number === selected.number
      && after.hash.toLowerCase() === selected.hash.toLowerCase()
    : true,
  finishedAt: new Date().toISOString()
};

const reportPath = path.join(reportRoot, `${slotSecret}.json`);
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (!report.restoredToSelectedSnapshot) {
  throw new Error(`Failed to restore ${slotSecret} to its oldest active snapshot`);
}
