import fs from 'node:fs';
import http from 'node:http';
import { performance } from 'node:perf_hooks';

import { getDeterministicGanacheAccounts } from '../packages/github-native-sim/src/ganache-accounts.mjs';
import { startForkRpcProxy } from '../packages/github-native-sim/src/fork-rpc-proxy.mjs';

const rpcUrl = process.env.RPC_ETHEREUM;
const pinnedBlock = 25_660_886;
const holder = '0x624Fc0A7B29002D7E06d35b9D7E0fc690a4FeBB6';
const staking = '0xA6730b33203f005cab6c80a2fF1d8B73E1947F2C';
const summary = { startedAt: new Date().toISOString(), calls: [], proxy: null, ganache: null };

function safeError(error) {
  return {
    name: error?.name ?? 'Error',
    message: String(error?.message ?? error).replaceAll(rpcUrl ?? '', '[REDACTED_RPC]'),
    code: error?.code,
    shortMessage: error?.shortMessage,
    data: error?.data,
    cause: error?.cause ? safeError(error.cause) : undefined
  };
}

if (!rpcUrl) throw new Error('RPC_ETHEREUM is missing');

const upstreamLogger = http.createServer(async (request, response) => {
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
    const decodedEntries = Array.isArray(decoded) ? decoded : [decoded];
    const row = {
      methods,
      elapsedMs: Math.round(performance.now() - started),
      status: upstream.status,
      responseBytes: Buffer.byteLength(text),
      errors: decodedEntries.filter(Boolean).map((entry) => entry.error).filter(Boolean),
      resultSummaries: decodedEntries.filter(Boolean).map((entry) => {
        if (entry.error) return null;
        if (typeof entry.result === 'string') return entry.result.slice(0, 130);
        if (entry.result && typeof entry.result === 'object') return Object.keys(entry.result).sort();
        return entry.result;
      })
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
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload?.id ?? null, error: { code: -32000, message: error?.message ?? String(error) } }));
  }
});

await new Promise((resolve) => upstreamLogger.listen(0, '127.0.0.1', resolve));
const upstreamAddress = upstreamLogger.address();
const loggedUpstreamUrl = `http://127.0.0.1:${upstreamAddress.port}`;

let forkProxy;
let ganacheServer;
let provider;
try {
  const localAccounts = await getDeterministicGanacheAccounts(20);
  forkProxy = await startForkRpcProxy({
    upstreamUrl: loggedUpstreamUrl,
    block: pinnedBlock,
    localAccounts
  });
  summary.proxy = forkProxy.diagnostics;
  console.log(JSON.stringify({ event: 'fork-proxy-started', ...summary.proxy }));

  const ganacheModule = await import('ganache');
  const ethers = await import('ethers');
  const ganache = ganacheModule.default ?? ganacheModule;
  ganacheServer = ganache.server({
    logging: { quiet: true },
    chain: { chainId: 1, allowUnlimitedContractSize: false },
    wallet: { deterministic: true, totalAccounts: 20, unlockedAccounts: [holder] },
    fork: { url: forkProxy.url, blockNumber: forkProxy.blockNumber }
  });
  await ganacheServer.listen(0, '127.0.0.1');
  const address = ganacheServer.address();
  provider = new ethers.JsonRpcProvider(`http://127.0.0.1:${address.port}`, 1, { staticNetwork: true });
  const contract = new ethers.Contract(staking, ['function lp_token() view returns (address)'], provider);
  summary.ganache = {
    accounts: (await provider.send('eth_accounts', [])).length,
    blockNumber: await provider.getBlockNumber(),
    holderBalance: (await provider.getBalance(holder)).toString(),
    holderNonce: await provider.getTransactionCount(holder),
    holderCodeBytes: Math.max(0, ((await provider.getCode(holder)).length - 2) / 2),
    stakingCodeBytes: Math.max(0, ((await provider.getCode(staking)).length - 2) / 2),
    stakingLpToken: await contract.lp_token()
  };
  summary.proxy = forkProxy.diagnostics;
  console.log(JSON.stringify({ event: 'ganache-success', ...summary.ganache, proxy: summary.proxy }));
} catch (error) {
  summary.proxy = forkProxy?.diagnostics ?? summary.proxy;
  summary.ganache = { error: safeError(error) };
  console.log(JSON.stringify({ event: 'ganache-failed', ...summary.ganache, proxy: summary.proxy }));
} finally {
  try { await provider?.destroy(); } catch {}
  try { await ganacheServer?.close(); } catch {}
  try { await forkProxy?.close(); } catch {}
  await new Promise((resolve) => upstreamLogger.close(resolve));
}

summary.finishedAt = new Date().toISOString();
fs.writeFileSync('rpc-unlocked-diagnostic.json', JSON.stringify(summary, null, 2));
