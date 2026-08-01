import fs from 'node:fs';
import http from 'node:http';
import { performance } from 'node:perf_hooks';

const rpcUrl = process.env.RPC_ETHEREUM;
const pinnedBlock = 25_660_886;
const holder = '0x624Fc0A7B29002D7E06d35b9D7E0fc690a4FeBB6';
const summary = { startedAt: new Date().toISOString(), calls: [], ganache: null };

function safeError(error) {
  return {
    name: error?.name ?? 'Error',
    message: String(error?.message ?? error).replaceAll(rpcUrl ?? '', '[REDACTED_RPC]'),
    code: error?.code,
    cause: error?.cause ? safeError(error.cause) : undefined
  };
}

if (!rpcUrl) throw new Error('RPC_ETHEREUM is missing');

const proxy = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');
  let payload;
  try { payload = JSON.parse(body); } catch { payload = null; }
  const entries = Array.isArray(payload) ? payload : [payload];
  const methods = entries.filter(Boolean).map((entry) => ({ method: entry.method, params: entry.params }));
  const started = performance.now();
  try {
    const upstream = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', connection: 'close' },
      body
    });
    const text = await upstream.text();
    let decoded;
    try { decoded = JSON.parse(text); } catch { decoded = null; }
    const row = {
      methods,
      elapsedMs: Math.round(performance.now() - started),
      status: upstream.status,
      responseBytes: Buffer.byteLength(text),
      errors: (Array.isArray(decoded) ? decoded : [decoded]).filter(Boolean).map((entry) => entry.error).filter(Boolean)
    };
    summary.calls.push(row);
    console.log(JSON.stringify({ event: 'upstream', ...row }));
    response.writeHead(upstream.status, { 'content-type': 'application/json' });
    response.end(text);
  } catch (error) {
    const row = { methods, elapsedMs: Math.round(performance.now() - started), error: safeError(error) };
    summary.calls.push(row);
    console.log(JSON.stringify({ event: 'upstream-failed', ...row }));
    response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload?.id ?? null, error: { code: -32000, message: 'upstream failure' } }));
  }
});

await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
const proxyAddress = proxy.address();
const proxyUrl = `http://127.0.0.1:${proxyAddress.port}`;

let ganacheServer;
let provider;
try {
  const ganacheModule = await import('ganache');
  const ethers = await import('ethers');
  const ganache = ganacheModule.default ?? ganacheModule;
  ganacheServer = ganache.server({
    logging: { quiet: true },
    chain: { chainId: 1, allowUnlimitedContractSize: false },
    wallet: { deterministic: true, totalAccounts: 20, unlockedAccounts: [holder] },
    fork: { url: proxyUrl, blockNumber: pinnedBlock }
  });
  await ganacheServer.listen(0, '127.0.0.1');
  const address = ganacheServer.address();
  provider = new ethers.JsonRpcProvider(`http://127.0.0.1:${address.port}`, 1, { staticNetwork: true });
  summary.ganache = {
    accounts: (await provider.send('eth_accounts', [])).length,
    blockNumber: await provider.getBlockNumber(),
    holderBalance: (await provider.getBalance(holder)).toString(),
    holderNonce: await provider.getTransactionCount(holder),
    holderCodeBytes: Math.max(0, ((await provider.getCode(holder)).length - 2) / 2)
  };
  console.log(JSON.stringify({ event: 'ganache-success', ...summary.ganache }));
} catch (error) {
  summary.ganache = { error: safeError(error) };
  console.log(JSON.stringify({ event: 'ganache-failed', ...summary.ganache }));
} finally {
  try { await provider?.destroy(); } catch {}
  try { await ganacheServer?.close(); } catch {}
  await new Promise((resolve) => proxy.close(resolve));
}

summary.finishedAt = new Date().toISOString();
fs.writeFileSync('rpc-unlocked-diagnostic.json', JSON.stringify(summary, null, 2));
