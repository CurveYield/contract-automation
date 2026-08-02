import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';

import { startRemoteRpcEngine } from '../src/remote-rpc-engine.mjs';

const ACCOUNT = '0x1000000000000000000000000000000000000001';
const PROOF = '0x2000000000000000000000000000000000000002';

function startFakeAnvil() {
  let nextSnapshot = 1;
  let balances = new Map([[ACCOUNT.toLowerCase(), 10n], [PROOF.toLowerCase(), 20n]]);
  const snapshots = new Map();
  const calls = [];

  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    calls.push(payload.method);
    let result;
    switch (payload.method) {
      case 'eth_chainId': result = '0x1'; break;
      case 'eth_accounts': result = [ACCOUNT]; break;
      case 'eth_blockNumber': result = '0x64'; break;
      case 'eth_getBlockByNumber': result = {
        number: '0x64', hash: `0x${'ab'.repeat(32)}`, parentHash: `0x${'cd'.repeat(32)}`,
        timestamp: '0x65', nonce: '0x0000000000000000', difficulty: '0x0', gasLimit: '0x1c9c380',
        gasUsed: '0x0', miner: '0x0000000000000000000000000000000000000000',
        extraData: '0x', transactions: [], baseFeePerGas: '0x1', mixHash: `0x${'00'.repeat(32)}`,
        receiptsRoot: `0x${'00'.repeat(32)}`, stateRoot: `0x${'00'.repeat(32)}`,
        transactionsRoot: `0x${'00'.repeat(32)}`, logsBloom: `0x${'00'.repeat(256)}`,
        sha3Uncles: `0x${'00'.repeat(32)}`, size: '0x0', totalDifficulty: '0x0', uncles: []
      }; break;
      case 'eth_getBalance': result = `0x${(balances.get(String(payload.params[0]).toLowerCase()) ?? 0n).toString(16)}`; break;
      case 'evm_snapshot': {
        const id = `0x${nextSnapshot++.toString(16)}`;
        snapshots.set(id, new Map(balances));
        result = id;
        break;
      }
      case 'evm_revert': {
        const snapshot = snapshots.get(payload.params[0]);
        if (snapshot) balances = new Map(snapshot);
        result = Boolean(snapshot);
        break;
      }
      case 'anvil_setBalance':
        balances.set(String(payload.params[0]).toLowerCase(), BigInt(payload.params[1]));
        result = true;
        break;
      case 'anvil_impersonateAccount': result = true; break;
      case 'anvil_stopImpersonatingAccount': result = true; break;
      default:
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, error: { code: -32601, message: `unsupported ${payload.method}` } }));
        return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
  });

  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    resolve({
      url: `http://127.0.0.1:${port}`,
      calls,
      balance(address) { return balances.get(address.toLowerCase()) ?? 0n; },
      close() { return new Promise((done) => server.close(done)); }
    });
  }));
}

test('remote RPC engine proves provider-side mutation and restores the persistent fork on close', async () => {
  const fake = await startFakeAnvil();
  const initialProofBalance = fake.balance(PROOF);
  const engine = await startRemoteRpcEngine({
    rpcUrl: fake.url,
    chainId: 1,
    workflow: { steps: [{ action: 'call', from: ACCOUNT }] },
    artifacts: { get() { throw new Error('not used'); } },
    proofAccount: PROOF
  });

  try {
    assert.equal(engine.name, 'remote-rpc');
    assert.equal(engine.url, fake.url);
    assert.equal(engine.aliases.account0.toLowerCase(), ACCOUNT.toLowerCase());
    const evidence = await engine.getEvidence();
    assert.equal(evidence.assurance, 'remote-mutable-rpc');
    assert.equal(evidence.capabilityProof.remoteMutationReadBack, true);
    assert.equal(evidence.capabilityProof.revertedAfterProof, true);
    assert.equal(fake.balance(PROOF), initialProofBalance);
    assert.ok(fake.calls.includes('anvil_impersonateAccount'));
  } finally {
    await engine.close();
    assert.equal(fake.balance(PROOF), initialProofBalance);
    await fake.close();
  }
});
