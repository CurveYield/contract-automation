import http from 'node:http';

import { createArchiveRpcRouter } from './archive-rpc-pool.mjs';
import {
  createRpcPolicyTermination,
  rpcCallNotSupportedResponse,
  unsupportedForkRpcMethod
} from './rpc-method-policy.mjs';

const ZERO_STORAGE = `0x${'00'.repeat(32)}`;
const BLOCK_TAG_POSITIONS = Object.freeze({
  eth_getBalance: [1],
  eth_getCode: [1],
  eth_getProof: [2],
  eth_getStorageAt: [2],
  eth_getBlockByNumber: [0],
  eth_getBlockTransactionCountByNumber: [0],
  eth_getUncleByBlockNumberAndIndex: [0],
  eth_getUncleCountByBlockNumber: [0],
  eth_getTransactionByBlockNumberAndIndex: [0],
  eth_call: [1],
  eth_estimateGas: [1],
  eth_createAccessList: [1],
  debug_traceCall: [1],
  trace_call: [2],
  trace_callMany: [1]
});

function blockTag(block) {
  if (Number.isSafeInteger(block) && block >= 0) return `0x${block.toString(16)}`;
  if (typeof block === 'string' && /^0x[0-9a-f]+$/i.test(block)) return block.toLowerCase();
  throw new Error('Fork block must be a non-negative integer or hex block tag');
}

function parseBlockNumber(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) {
    throw new Error('Fork RPC returned an invalid block number');
  }
  const number = Number.parseInt(value.slice(2), 16);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('Fork block exceeds the safe integer range');
  return number;
}

function cacheKey(method, params) {
  return JSON.stringify([method, params]);
}

function isMovingTag(value) {
  return value === 'latest' || value === 'safe' || value === 'finalized';
}

function normalizeBlockParameters(entry, resolvedTag) {
  const params = Array.isArray(entry.params) ? structuredClone(entry.params) : [];
  for (const index of BLOCK_TAG_POSITIONS[entry.method] ?? []) {
    if (isMovingTag(params[index])) params[index] = resolvedTag;
  }
  if (entry.method === 'eth_getLogs' && params[0] && typeof params[0] === 'object') {
    for (const key of ['fromBlock', 'toBlock']) {
      if (isMovingTag(params[0][key])) params[0][key] = resolvedTag;
    }
  }
  if (entry.method === 'eth_getBlockByNumber' && params[0] === 'earliest') params[0] = '0x0';
  return { ...entry, params };
}

function responseForId(response, id) {
  if (response.error) return { jsonrpc: '2.0', id, error: response.error };
  return { jsonrpc: '2.0', id, result: response.result };
}

function localAccountResponse(entry, localAccounts) {
  const account = typeof entry.params?.[0] === 'string' ? entry.params[0].toLowerCase() : null;
  if (!account || !localAccounts.has(account)) return null;
  switch (entry.method) {
    case 'eth_getTransactionCount':
    case 'eth_getBalance':
      return { jsonrpc: '2.0', id: entry.id ?? null, result: '0x0' };
    case 'eth_getCode':
      return { jsonrpc: '2.0', id: entry.id ?? null, result: '0x' };
    case 'eth_getStorageAt':
      return { jsonrpc: '2.0', id: entry.id ?? null, result: ZERO_STORAGE };
    default:
      return null;
  }
}

function localMetadataResponse(entry, { chainId, resolvedTag, genesisBlock }) {
  switch (entry.method) {
    case 'eth_chainId':
      return { jsonrpc: '2.0', id: entry.id ?? null, result: `0x${chainId.toString(16)}` };
    case 'net_version':
      return { jsonrpc: '2.0', id: entry.id ?? null, result: String(chainId) };
    case 'eth_blockNumber':
      return { jsonrpc: '2.0', id: entry.id ?? null, result: resolvedTag };
    case 'eth_getBlockByNumber': {
      const tag = entry.params?.[0];
      if (!genesisBlock || (tag !== 'earliest' && tag !== '0x0')) return null;
      return { jsonrpc: '2.0', id: entry.id ?? null, result: genesisBlock };
    }
    default:
      return null;
  }
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  if (!server.listening) return;
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function closeAfterResponse(server, response) {
  response.once('finish', () => {
    setImmediate(() => {
      void closeServer(server).catch(() => {});
    });
  });
}

async function resolveForkBlock(router, blockPolicy) {
  const policy = blockPolicy ?? { mode: 'latest-at-start' };
  if (policy.mode === 'explicit') return blockTag(policy.blockNumber);
  if (policy.mode === 'legacy-block') {
    if (policy.block === 'latest' || policy.block === undefined) {
      const latest = await router.request({ jsonrpc: '2.0', id: 'resolve-block', method: 'eth_blockNumber', params: [] });
      return blockTag(latest.result);
    }
    return blockTag(policy.block);
  }
  if (policy.mode === 'latest-at-start' || policy.mode === 'latest-at-action') {
    const latest = await router.request({ jsonrpc: '2.0', id: 'resolve-block', method: 'eth_blockNumber', params: [] });
    return blockTag(latest.result);
  }
  if (policy.mode === 'tag') {
    const tag = policy.tag ?? 'safe';
    const block = await router.request({
      jsonrpc: '2.0',
      id: 'resolve-tag',
      method: 'eth_getBlockByNumber',
      params: [tag, false]
    });
    if (!block.result?.number) throw new Error(`Fork RPC did not resolve ${tag}`);
    return blockTag(block.result.number);
  }
  throw new Error(`Unsupported fork start mode: ${policy.mode}`);
}

async function blockDescriptor(router, policy) {
  const tag = await resolveForkBlock(router, policy);
  const response = await router.request({
    jsonrpc: '2.0',
    id: 'describe-block',
    method: 'eth_getBlockByNumber',
    params: [tag, false]
  });
  const block = response.result;
  if (!block || block.number?.toLowerCase() !== tag.toLowerCase()) {
    throw new Error('Archive RPC returned the wrong refork block');
  }
  if (!/^0x[0-9a-f]{64}$/i.test(block.hash ?? '')) throw new Error('Archive RPC returned an invalid refork block hash');
  return {
    blockNumber: parseBlockNumber(block.number),
    blockHash: block.hash,
    blockTimestamp: parseBlockNumber(block.timestamp),
    blockTag: tag
  };
}

export async function startLiveForkProxy({
  slots,
  chainId,
  blockPolicy,
  routing = {},
  healthPolicy = {},
  consistency = {},
  genesisBlock,
  localAccounts = [],
  fetchImpl = globalThis.fetch
}) {
  if (!Number.isSafeInteger(chainId) || chainId < 1) throw new Error('chainId must be a positive safe integer');
  if (!Array.isArray(localAccounts)) throw new Error('localAccounts must be an array');
  const router = createArchiveRpcRouter({
    slots,
    routing,
    healthPolicy,
    fetchImpl,
    retryDelaysMs: routing.retryDelaysMs,
    requestTimeoutMs: routing.requestTimeoutMs
  });
  const policy = createRpcPolicyTermination();
  const resolvedTag = await resolveForkBlock(router, blockPolicy);
  const resolvedBlock = parseBlockNumber(resolvedTag);

  if (consistency.requireChainIdMatch ?? true) {
    const upstreamChain = await router.request({ jsonrpc: '2.0', id: 'resolve-chain', method: 'eth_chainId', params: [] });
    if (parseBlockNumber(upstreamChain.result) !== chainId) {
      throw new Error(`Archive RPC chain ID mismatch: expected ${chainId}`);
    }
  }

  const fullBlockPayload = {
    jsonrpc: '2.0',
    id: 'prefetch-block',
    method: 'eth_getBlockByNumber',
    params: [resolvedTag, true]
  };
  const prefetched = await router.request(fullBlockPayload);
  const block = prefetched.result;
  if (!block || block.number?.toLowerCase() !== resolvedTag.toLowerCase()) {
    throw new Error('Archive RPC returned the wrong fork block');
  }
  if ((consistency.requireForkBlockHashMatch ?? true) && !/^0x[0-9a-f]{64}$/i.test(block.hash ?? '')) {
    throw new Error('Archive RPC returned an invalid fork block hash');
  }

  const cache = new Map([[cacheKey('eth_getBlockByNumber', [resolvedTag, true]), prefetched]]);
  const localAccountSet = new Set(localAccounts.map((account) => String(account).toLowerCase()));
  const diagnostics = {
    assurance: 'continuous-archive-backed-local-fork',
    resolvedBlock,
    resolvedTag,
    blockHash: block.hash ?? null,
    blockTimestamp: block.timestamp ? parseBlockNumber(block.timestamp) : null,
    localMetadataHits: 0,
    localAccountHits: 0,
    cacheHits: 0,
    forwardedRequests: 0,
    terminated: false,
    unsupportedMethod: null,
    reforkResolutions: [],
    get rpc() {
      return router.diagnostics;
    }
  };

  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
      return;
    }

    const unsupportedMethod = policy.error?.method ?? unsupportedForkRpcMethod(payload);
    if (unsupportedMethod) {
      const error = policy.terminate(unsupportedMethod);
      diagnostics.terminated = true;
      diagnostics.unsupportedMethod = error.method;
      closeAfterResponse(server, response);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(rpcCallNotSupportedResponse(payload, error)));
      return;
    }

    try {
      const requests = Array.isArray(payload) ? payload : [payload];
      const outputs = [];
      for (const entry of requests) {
        const metadata = localMetadataResponse(entry, { chainId, resolvedTag, genesisBlock });
        if (metadata) {
          diagnostics.localMetadataHits += 1;
          outputs.push(metadata);
          continue;
        }
        const local = localAccountResponse(entry, localAccountSet);
        if (local) {
          diagnostics.localAccountHits += 1;
          outputs.push(local);
          continue;
        }
        const upstreamEntry = normalizeBlockParameters(entry, resolvedTag);
        const cached = cache.get(cacheKey(upstreamEntry.method, upstreamEntry.params ?? []));
        if (cached) {
          diagnostics.cacheHits += 1;
          outputs.push(responseForId(cached, entry.id ?? null));
          continue;
        }
        diagnostics.forwardedRequests += 1;
        const forwarded = await router.request(upstreamEntry);
        outputs.push(responseForId(forwarded, entry.id ?? null));
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(Array.isArray(payload) ? outputs : outputs[0]));
    } catch (error) {
      const cause = policy.error ?? error;
      let publicResponse;
      if (cause?.code === 'CALL_NOT_SUPPORTED') {
        publicResponse = rpcCallNotSupportedResponse(payload, cause);
      } else if (cause?.code === 'ARCHIVE_RPC_UNAVAILABLE') {
        publicResponse = router.jsonError(payload, cause);
      } else {
        publicResponse = {
          jsonrpc: '2.0',
          id: Array.isArray(payload) ? null : payload.id ?? null,
          error: {
            code: -32000,
            message: 'Simulation request failed',
            data: { code: 'SIMULATION_REQUEST_FAILED' }
          }
        };
      }
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify(publicResponse));
    }
  });

  const url = await listen(server);
  return {
    url,
    blockNumber: resolvedBlock,
    blockHash: diagnostics.blockHash,
    blockTimestamp: diagnostics.blockTimestamp,
    diagnostics,
    termination: policy.termination,
    signal: policy.signal,
    async resolveBlock(target) {
      const descriptor = await blockDescriptor(router, target);
      diagnostics.reforkResolutions.push({ ...descriptor, requested: structuredClone(target) });
      return descriptor;
    },
    close: () => closeServer(server)
  };
}