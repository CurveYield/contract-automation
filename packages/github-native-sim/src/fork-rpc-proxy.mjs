import http from 'node:http';

const DEFAULT_RETRY_DELAYS_MS = Object.freeze([0, 250, 1_000, 2_500]);
const TRANSIENT_MESSAGE = /(?:timeout|timed out|temporar|try again|gateway|too many requests|rate limit|free plan|socket hang up|connection reset|fetch failed)/i;
const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET'
]);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function blockTag(block) {
  if (Number.isSafeInteger(block) && block >= 0) return `0x${block.toString(16)}`;
  if (block === 'latest') return 'latest';
  throw new Error('Fork block must be latest or a non-negative safe integer');
}

function cacheKey(method, params) {
  return JSON.stringify([method, params]);
}

function isTransientHttpStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isTransientRpcError(error) {
  return Boolean(error && TRANSIENT_MESSAGE.test(String(error.message ?? error)));
}

function isTransientNetworkError(error) {
  let current = error;
  const visited = new Set();
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);
    if (current.name === 'AbortError') return true;
    if (TRANSIENT_NETWORK_CODES.has(current.code)) return true;
    if (TRANSIENT_MESSAGE.test(String(current.message ?? ''))) return true;
    current = current.cause;
  }
  return false;
}

function responseForId(response, id) {
  if (response.error) return { jsonrpc: '2.0', id, error: response.error };
  return { jsonrpc: '2.0', id, result: response.result };
}

async function requestRpc({
  upstreamUrl,
  payload,
  retryDelaysMs,
  requestTimeoutMs,
  fetchImpl
}) {
  let lastFailure;
  for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
    const delay = retryDelaysMs[attempt];
    if (delay > 0) await sleep(delay);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl(upstreamUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
          'accept-encoding': 'gzip, deflate, br'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const text = await response.text();
      let decoded;
      try {
        decoded = JSON.parse(text);
      } catch {
        decoded = null;
      }

      const transient = isTransientHttpStatus(response.status)
        || !decoded
        || isTransientRpcError(decoded?.error);
      if (response.ok && decoded && !decoded.error) {
        return { decoded, attempts: attempt + 1 };
      }

      lastFailure = new Error(
        decoded?.error?.message
          ?? `Fork RPC returned HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`
      );
      if (!transient || attempt === retryDelaysMs.length - 1) throw lastFailure;
    } catch (error) {
      lastFailure = error;
      if (!isTransientNetworkError(error) || attempt === retryDelaysMs.length - 1) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastFailure ?? new Error('Fork RPC request failed');
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
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

export async function startForkRpcProxy({
  upstreamUrl,
  block = 'latest',
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  requestTimeoutMs = 30_000,
  fetchImpl = globalThis.fetch
}) {
  if (typeof upstreamUrl !== 'string' || upstreamUrl.length === 0) throw new Error('upstreamUrl is required');
  if (!Array.isArray(retryDelaysMs) || retryDelaysMs.length === 0) throw new Error('retryDelaysMs is required');
  if (typeof fetchImpl !== 'function') throw new Error('fetchImpl must be a function');

  let resolvedTag = blockTag(block);
  let blockNumberAttempts = 0;
  if (resolvedTag === 'latest') {
    const latest = await requestRpc({
      upstreamUrl,
      payload: { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] },
      retryDelaysMs,
      requestTimeoutMs,
      fetchImpl
    });
    blockNumberAttempts = latest.attempts;
    resolvedTag = latest.decoded.result;
    if (typeof resolvedTag !== 'string' || !/^0x[0-9a-f]+$/i.test(resolvedTag)) {
      throw new Error('Fork RPC returned an invalid block number');
    }
  }

  const fullBlockPayload = {
    jsonrpc: '2.0',
    id: 2,
    method: 'eth_getBlockByNumber',
    params: [resolvedTag, true]
  };
  const prefetched = await requestRpc({
    upstreamUrl,
    payload: fullBlockPayload,
    retryDelaysMs,
    requestTimeoutMs,
    fetchImpl
  });
  const cache = new Map([
    [cacheKey('eth_getBlockByNumber', [resolvedTag, true]), prefetched.decoded]
  ]);
  if (block === 'latest') {
    cache.set(cacheKey('eth_blockNumber', []), { jsonrpc: '2.0', id: 1, result: resolvedTag });
  }

  const diagnostics = {
    resolvedBlock: Number.parseInt(resolvedTag.slice(2), 16),
    blockNumberAttempts,
    prefetchAttempts: prefetched.attempts,
    cacheHits: 0,
    forwardedRequests: 0
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

    try {
      const requests = Array.isArray(payload) ? payload : [payload];
      const outputs = [];
      for (const entry of requests) {
        const cached = cache.get(cacheKey(entry.method, entry.params ?? []));
        if (cached) {
          diagnostics.cacheHits += 1;
          outputs.push(responseForId(cached, entry.id ?? null));
          continue;
        }
        diagnostics.forwardedRequests += 1;
        const forwarded = await requestRpc({
          upstreamUrl,
          payload: entry,
          retryDelaysMs,
          requestTimeoutMs,
          fetchImpl
        });
        outputs.push(forwarded.decoded);
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(Array.isArray(payload) ? outputs : outputs[0]));
    } catch (error) {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        jsonrpc: '2.0',
        id: Array.isArray(payload) ? null : payload.id ?? null,
        error: { code: -32000, message: error?.message ?? String(error) }
      }));
    }
  });

  const url = await listen(server);
  return {
    url,
    blockNumber: diagnostics.resolvedBlock,
    diagnostics,
    close: () => closeServer(server)
  };
}
