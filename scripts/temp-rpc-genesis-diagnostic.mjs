import fs from 'node:fs';
import { performance } from 'node:perf_hooks';

const rpcUrl = process.env.RPC_ETHEREUM;
if (!rpcUrl) throw new Error('RPC_ETHEREUM is missing');

const results = [];
let id = 1;
for (const tag of ['earliest', '0x0']) {
  const started = performance.now();
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', connection: 'close' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: id++,
        method: 'eth_getBlockByNumber',
        params: [tag, false]
      })
    });
    const text = await response.text();
    let decoded;
    try { decoded = JSON.parse(text); } catch { decoded = null; }
    results.push({
      tag,
      elapsedMs: Math.round(performance.now() - started),
      status: response.status,
      responseBytes: Buffer.byteLength(text),
      error: decoded?.error ?? null,
      blockNumber: decoded?.result?.number ?? null,
      blockHash: decoded?.result?.hash ?? null,
      fields: decoded?.result ? Object.keys(decoded.result).sort() : []
    });
  } catch (error) {
    results.push({
      tag,
      elapsedMs: Math.round(performance.now() - started),
      error: {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        cause: error?.cause ? {
          name: error.cause.name,
          message: error.cause.message,
          code: error.cause.code
        } : null
      }
    });
  }
}

console.log(JSON.stringify(results, null, 2));
fs.writeFileSync('rpc-genesis-diagnostic.json', JSON.stringify(results, null, 2));
