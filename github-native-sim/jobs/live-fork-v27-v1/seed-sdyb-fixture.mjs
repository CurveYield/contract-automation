import { concat, keccak256, toBeHex, zeroPadValue } from 'ethers';

const rpcUrl = process.env.RPC_ANVIL_ETHEREUM1;
if (!rpcUrl) throw new Error('RPC_ANVIL_ETHEREUM1 is required');

const SDYB = '0x0c057598dcE1891688829581f890DD2a3685a43f';
const BALANCE_OF_SELECTOR = '0x70a08231';
const fixtures = [
  {
    address: '0x1B82850E491e6176170b32eC3f29AF48Eb2Fe372',
    balance: 11776362760115312948870n
  },
  {
    address: '0x624Fc0A7B29002D7E06d35b9D7E0fc690a4FeBB6',
    balance: 6827033240920558171026n
  }
];

let requestId = 0;
async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params })
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(`${method} failed: ${payload.error?.message ?? response.statusText}`);
  }
  return payload.result;
}

function mappingKey(address, slot) {
  return keccak256(concat([
    zeroPadValue(address, 32),
    zeroPadValue(toBeHex(slot), 32)
  ]));
}

function storageWord(value) {
  return zeroPadValue(toBeHex(value), 32);
}

async function balanceOf(address) {
  const calldata = `${BALANCE_OF_SELECTOR}${zeroPadValue(address, 32).slice(2)}`;
  return BigInt(await rpc('eth_call', [{ to: SDYB, data: calldata }, 'latest']));
}

async function findBalanceSlot() {
  const probeAddress = fixtures[0].address;
  const originalBalance = await balanceOf(probeAddress);
  const probeBalance = originalBalance + 123456789n;

  for (let slot = 0; slot < 256; slot += 1) {
    const key = mappingKey(probeAddress, slot);
    const stored = BigInt(await rpc('eth_getStorageAt', [SDYB, key, 'latest']));
    if (stored !== originalBalance) continue;

    const snapshot = await rpc('evm_snapshot');
    try {
      await rpc('anvil_setStorageAt', [SDYB, key, storageWord(probeBalance)]);
      if (await balanceOf(probeAddress) === probeBalance) return slot;
    } finally {
      const reverted = await rpc('evm_revert', [snapshot]);
      if (reverted !== true) throw new Error('Failed to revert sdYB storage-slot probe');
    }
  }

  throw new Error('Unable to locate sdYB balance mapping slot');
}

const balanceSlot = await findBalanceSlot();
const seeded = [];
for (const fixture of fixtures) {
  const key = mappingKey(fixture.address, balanceSlot);
  const before = await balanceOf(fixture.address);
  await rpc('anvil_setStorageAt', [SDYB, key, storageWord(fixture.balance)]);
  const after = await balanceOf(fixture.address);
  if (after !== fixture.balance) {
    throw new Error(`sdYB fixture seed failed for ${fixture.address}`);
  }
  seeded.push({
    address: fixture.address,
    before: before.toString(),
    after: after.toString()
  });
}

process.stdout.write(`${JSON.stringify({
  token: SDYB,
  balanceSlot,
  method: 'anvil_setStorageAt',
  purpose: 'deterministic test-fixture funding restored to reviewed reference balances',
  seeded
}, null, 2)}\n`);
