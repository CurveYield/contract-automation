import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { startForkRpcProxy } from '../src/fork-rpc-proxy.mjs';

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function rpc(url, id, method, params) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  });
  return response.json();
}

test('serves chain metadata, fork height, and genesis without upstream reads', async () => {
  const upstreamMethods = [];
  const upstream = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    upstreamMethods.push([payload.method, payload.params]);
    const result = payload.method === 'eth_getBlockByNumber'
      ? { number: '0x7b', hash: '0xabc', transactions: [] }
      : 'unexpected';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
  });

  const genesis = {
    number: '0x0',
    hash: '0xd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3',
    transactions: []
  };
  const upstreamUrl = await listen(upstream);
  let proxy;
  try {
    proxy = await startForkRpcProxy({
      upstreamUrl,
      block: 123,
      chainId: 1,
      genesisBlock: genesis,
      retryDelaysMs: [0]
    });

    assert.deepEqual(await rpc(proxy.url, 1, 'eth_chainId', []), {
      jsonrpc: '2.0', id: 1, result: '0x1'
    });
    assert.deepEqual(await rpc(proxy.url, 2, 'net_version', []), {
      jsonrpc: '2.0', id: 2, result: '1'
    });
    assert.deepEqual(await rpc(proxy.url, 3, 'eth_blockNumber', []), {
      jsonrpc: '2.0', id: 3, result: '0x7b'
    });
    assert.deepEqual(await rpc(proxy.url, 4, 'eth_getBlockByNumber', ['earliest', false]), {
      jsonrpc: '2.0', id: 4, result: genesis
    });
    assert.deepEqual(await rpc(proxy.url, 5, 'eth_getBlockByNumber', ['0x0', true]), {
      jsonrpc: '2.0', id: 5, result: genesis
    });

    assert.deepEqual(upstreamMethods, [
      ['eth_getBlockByNumber', ['0x7b', true]]
    ]);
    assert.equal(proxy.diagnostics.localMetadataHits, 5);
  } finally {
    await proxy?.close();
    await close(upstream);
  }
});
