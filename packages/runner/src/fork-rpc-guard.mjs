import http from 'node:http';

import {
  createRpcPolicyTermination,
  rpcCallNotSupportedResponse,
  unsupportedForkRpcMethod
} from './rpc-method-policy.mjs';

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

function closeAfterResponse(server, response) {
  response.once('finish', () => {
    setImmediate(() => {
      void closeServer(server).catch(() => {});
    });
  });
}

function requestCount(payload) {
  return Array.isArray(payload) ? payload.length : 1;
}

function jsonError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

export async function startForkRpcGuard({
  upstreamUrl,
  requestTimeoutMs = 30_000,
  fetchImpl = globalThis.fetch
}) {
  if (typeof upstreamUrl !== 'string' || upstreamUrl.length === 0) throw new Error('upstreamUrl is required');
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1) {
    throw new Error('requestTimeoutMs must be a positive safe integer');
  }
  if (typeof fetchImpl !== 'function') throw new Error('fetchImpl must be a function');

  const policy = createRpcPolicyTermination();
  const diagnostics = {
    forwardedPayloads: 0,
    forwardedRequests: 0,
    terminated: false,
    unsupportedMethod: null
  };

  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);

    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify(jsonError(null, -32700, 'Parse error')));
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

    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), requestTimeoutMs);
    try {
      diagnostics.forwardedPayloads += 1;
      diagnostics.forwardedRequests += requestCount(payload);
      const upstream = await fetchImpl(upstreamUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
          'accept-encoding': 'gzip, deflate, br'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.any([timeoutController.signal, policy.signal])
      });
      const body = await upstream.text();
      response.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') ?? 'application/json'
      });
      response.end(body);
    } catch (error) {
      const cause = policy.error ?? error;
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify(jsonError(
        Array.isArray(payload) ? null : payload?.id ?? null,
        cause?.rpcCode ?? -32000,
        cause?.message ?? String(cause)
      )));
    } finally {
      clearTimeout(timeout);
    }
  });

  const url = await listen(server);
  return {
    url,
    diagnostics,
    termination: policy.termination,
    signal: policy.signal,
    close: () => closeServer(server)
  };
}
