import { CHAINS } from '../../../packages/protocol/src/index.mjs';
import apiWorker from './index.mjs';

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,96}$/;

export function normalizeCorrelationId(value) {
  const candidate = String(value ?? '').trim();
  if (CORRELATION_ID_PATTERN.test(candidate)) return candidate;
  return `corr_${crypto.randomUUID().replaceAll('-', '')}`;
}

function json(value, env, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': env.CORS_ORIGIN || '*',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

function withCorrelation(response, correlationId) {
  const headers = new Headers(response.headers);
  headers.set('x-correlation-id', correlationId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function correlatedRequest(request, correlationId) {
  const cloned = request.clone();
  cloned.headers.set('x-correlation-id', correlationId);
  return cloned;
}

function enabledChainMap(env) {
  const configured = String(env.ENABLED_CHAINS ?? '').trim();
  if (!configured) return CHAINS;
  const names = [...new Set(configured
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean))];
  if (names.length === 0 || names.some((name) => !Object.hasOwn(CHAINS, name))) return null;
  return Object.freeze(Object.fromEntries(names.sort().map((name) => [name, CHAINS[name]])));
}

async function clientAuthorizationProbe(request, env, context) {
  const url = new URL(request.url);
  url.pathname = '/api/v1/chains';
  url.search = '';
  return apiWorker.fetch(new Request(url, {
    method: 'GET',
    headers: request.headers
  }), env, context);
}

async function parseJobCandidate(request) {
  try {
    const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
    if (!contentType.startsWith('application/json')) return null;
    const body = await request.clone().json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export function setupReadiness(env) {
  const features = {
    storage: Boolean(env.JOBS),
    browserApiAuth: Boolean(env.CLIENT_API_KEY),
    customGptAuth: Boolean(env.GPT_API_KEY),
    githubBridgeAuth: Boolean(env.GITHUB_BRIDGE_API_KEY),
    runnerAuth: Boolean(env.RUNNER_API_KEY),
    githubDispatch: Boolean(env.GITHUB_TOKEN),
    largeUploads: Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY)
  };
  return {
    status: Object.values(features).every(Boolean) ? 'ready' : 'configuration_required',
    features
  };
}

export default {
  async fetch(request, env, context) {
    const correlationId = normalizeCorrelationId(request.headers.get('x-correlation-id'));
    const correlated = correlatedRequest(request, correlationId);
    const respond = (response) => withCorrelation(response, correlationId);
    const url = new URL(correlated.url);

    if (correlated.method === 'GET' && url.pathname === '/api/v1/setup') {
      return respond(json(setupReadiness(env), env));
    }

    const activeChains = enabledChainMap(env);
    if (correlated.method === 'GET' && url.pathname === '/api/v1/chains') {
      const response = await apiWorker.fetch(correlated, env, context);
      if (response.status !== 200 || !env.ENABLED_CHAINS) return respond(response);
      if (!activeChains) {
        return respond(json({ error: {
          code: 'invalid_enabled_chains',
          message: 'The production chain allowlist is invalid'
        } }, env, 503));
      }
      return respond(new Response(JSON.stringify({ chains: activeChains }), {
        status: response.status,
        headers: response.headers
      }));
    }

    if (correlated.method === 'POST' && url.pathname === '/api/v1/jobs' && env.ENABLED_CHAINS) {
      const candidate = await parseJobCandidate(correlated);
      const requestedChain = typeof candidate?.chain === 'string'
        ? candidate.chain.trim().toLowerCase()
        : null;
      if (!activeChains || (requestedChain && !Object.hasOwn(activeChains, requestedChain))) {
        const authorization = await clientAuthorizationProbe(correlated, env, context);
        if (authorization.status !== 200) return respond(authorization);
        if (!activeChains) {
          return respond(json({ error: {
            code: 'invalid_enabled_chains',
            message: 'The production chain allowlist is invalid'
          } }, env, 503));
        }
        return respond(json({ error: {
          code: 'chain_not_enabled',
          message: 'The requested chain is not enabled for production testing'
        } }, env, 400));
      }
    }

    return respond(await apiWorker.fetch(correlated, env, context));
  }
};