import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import { performance } from 'node:perf_hooks';

const rpcUrl = process.env.RPC_ETHEREUM;
const pinnedBlock = 25_660_886;
const targetAddress = '0xA6730b33203f005cab6c80a2fF1d8B73E1947F2C';
const summary = {
  startedAt: new Date().toISOString(),
  environment: {},
  direct: [],
  ethers: [],
  proxy: [],
  ganache: null
};

function redact(value) {
  const text = String(value ?? '');
  return rpcUrl ? text.split(rpcUrl).join('[REDACTED_RPC]') : text;
}

function errorJson(error) {
  return {
    name: error?.name ?? 'Error',
    message: redact(error?.message ?? error),
    code: error?.code,
    shortMessage: redact(error?.shortMessage ?? ''),
    cause: error?.cause ? errorJson(error.cause) : undefined
  };
}

function log(event, details = {}) {
  const row = { at: new Date().toISOString(), event, ...details };
  console.log(JSON.stringify(row));
}

if (!rpcUrl) {
  summary.environment.rpcConfigured = false;
  fs.writeFileSync('rpc-diagnostic.json', JSON.stringify(summary, null, 2));
  console.error('RPC_ETHEREUM is not configured');
  process.exit(0);
}

const parsed = new URL(rpcUrl);
summary.environment = {
  rpcConfigured: true,
  protocol: parsed.protocol,
  hostname: parsed.hostname,
  port: parsed.port || null,
  pathSegmentCount: parsed.pathname.split('/').filter(Boolean).length,
  queryKeys: [...parsed.searchParams.keys()].sort(),
  valueLength: rpcUrl.length,
  sha256Prefix: crypto.createHash('sha256').update(rpcUrl).digest('hex').slice(0, 16),
  node: process.version,
  runner: process.env.RUNNER_ENVIRONMENT ?? null
};
log('environment', summary.environment);

let nextId = 1;
async function directRpc(method, params, timeoutMs = 30_000) {
  const id = nextId++;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: controller.signal
    });
    const text = await response.text();
    let decoded;
    try { decoded = JSON.parse(text); } catch { decoded = null; }
    const result = {
      method,
      elapsedMs: Math.round(performance.now() - started),
      httpStatus: response.status,
      ok: response.ok && !decoded?.error,
      rpcError: decoded?.error ?? null,
      responseBytes: Buffer.byteLength(text),
      resultSummary: decoded?.result === undefined
        ? null
        : typeof decoded.result === 'string'
          ? decoded.result.slice(0, 130)
          : Array.isArray(decoded.result)
            ? `array(${decoded.result.length})`
            : typeof decoded.result
    };
    summary.direct.push(result);
    log('direct-rpc', result);
    return decoded?.result;
  } catch (error) {
    const result = {
      method,
      elapsedMs: Math.round(performance.now() - started),
      ok: false,
      error: errorJson(error)
    };
    summary.direct.push(result);
    log('direct-rpc', result);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

await directRpc('eth_chainId', []);
await directRpc('eth_blockNumber', []);
await directRpc('eth_getBlockByNumber', [`0x${pinnedBlock.toString(16)}`, false]);
await directRpc('eth_getCode', [targetAddress, `0x${pinnedBlock.toString(16)}`]);

try {
  const ethers = await import('ethers');
  const provider = new ethers.JsonRpcProvider(rpcUrl, 1, { staticNetwork: true });
  for (const [label, operation] of [
    ['eth_chainId', () => provider.send('eth_chainId', [])],
    ['getBlockNumber', () => provider.getBlockNumber()],
    ['getCodePinned', () => provider.getCode(targetAddress, pinnedBlock)]
  ]) {
    const started = performance.now();
    try {
      const value = await operation();
      const result = {
        operation: label,
        ok: true,
        elapsedMs: Math.round(performance.now() - started),
        resultSummary: typeof value === 'string' ? value.slice(0, 130) : value
      };
      summary.ethers.push(result);
      log('ethers', result);
    } catch (error) {
      const result = {
        operation: label,
        ok: false,
        elapsedMs: Math.round(performance.now() - started),
        error: errorJson(error)
      };
      summary.ethers.push(result);
      log('ethers', result);
    }
  }
  await provider.destroy();
} catch (error) {
  summary.ethers.push({ operation: 'provider-setup', ok: false, error: errorJson(error) });
  log('ethers-setup-failed', { error: errorJson(error) });
}

const proxyServer = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');
  let payload;
  try { payload = JSON.parse(body); } catch { payload = null; }
  const requests = Array.isArray(payload) ? payload : [payload];
  const methods = requests.filter(Boolean).map((entry) => entry.method ?? 'unknown');
  const started = performance.now();
  try {
    const upstream = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body
    });
    const upstreamText = await upstream.text();
    let upstreamJson;
    try { upstreamJson = JSON.parse(upstreamText); } catch { upstreamJson = null; }
    const errors = (Array.isArray(upstreamJson) ? upstreamJson : [upstreamJson])
      .filter(Boolean)
      .map((entry) => entry.error)
      .filter(Boolean);
    const result = {
      methods,
      requestBytes: Buffer.byteLength(body),
      elapsedMs: Math.round(performance.now() - started),
      httpStatus: upstream.status,
      responseBytes: Buffer.byteLength(upstreamText),
      errors
    };
    summary.proxy.push(result);
    log('ganache-upstream', result);
    response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' });
    response.end(upstreamText);
  } catch (error) {
    const result = {
      methods,
      requestBytes: Buffer.byteLength(body),
      elapsedMs: Math.round(performance.now() - started),
      error: errorJson(error)
    };
    summary.proxy.push(result);
    log('ganache-upstream-failed', result);
    response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload?.id ?? null, error: { code: -32000, message: 'diagnostic proxy upstream failure' } }));
  }
});

await new Promise((resolve) => proxyServer.listen(0, '127.0.0.1', resolve));
const proxyAddress = proxyServer.address();
const proxyUrl = `http://127.0.0.1:${proxyAddress.port}`;

let ganacheServer;
let localProvider;
try {
  const ganacheModule = await import('ganache');
  const ethers = await import('ethers');
  const ganache = ganacheModule.default ?? ganacheModule;
  const started = performance.now();
  ganacheServer = ganache.server({
    logging: { quiet: true },
    chain: { chainId: 1, allowUnlimitedContractSize: false },
    wallet: { deterministic: true, totalAccounts: 2 },
    fork: { url: proxyUrl, blockNumber: pinnedBlock }
  });
  await ganacheServer.listen(0, '127.0.0.1');
  const address = ganacheServer.address();
  localProvider = new ethers.JsonRpcProvider(`http://127.0.0.1:${address.port}`, 1, { staticNetwork: true });
  const accounts = await localProvider.send('eth_accounts', []);
  const blockNumber = await localProvider.getBlockNumber();
  const code = await localProvider.getCode(targetAddress);
  summary.ganache = {
    ok: true,
    elapsedMs: Math.round(performance.now() - started),
    accounts: accounts.length,
    blockNumber,
    targetCodeBytes: Math.max(0, (code.length - 2) / 2)
  };
  log('ganache', summary.ganache);
} catch (error) {
  summary.ganache = { ok: false, error: errorJson(error) };
  log('ganache-failed', summary.ganache);
} finally {
  try { await localProvider?.destroy(); } catch {}
  try { await ganacheServer?.close(); } catch {}
  await new Promise((resolve) => proxyServer.close(resolve));
}

summary.finishedAt = new Date().toISOString();
fs.writeFileSync('rpc-diagnostic.json', JSON.stringify(summary, null, 2));
log('complete', {
  directPassed: summary.direct.filter((entry) => entry.ok).length,
  directTotal: summary.direct.length,
  ethersPassed: summary.ethers.filter((entry) => entry.ok).length,
  ethersTotal: summary.ethers.length,
  upstreamCalls: summary.proxy.length,
  ganacheOk: summary.ganache?.ok ?? false
});
