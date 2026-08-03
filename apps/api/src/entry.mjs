import { CHAINS } from '../../../packages/protocol/src/index.mjs';
import apiWorker from './index.mjs';

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
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/v1/setup') {
      return json(setupReadiness(env), env);
    }

    const activeChains = enabledChainMap(env);
    if (request.method === 'GET' && url.pathname === '/api/v1/chains') {
      const response = await apiWorker.fetch(request, env, context);
      if (response.status !== 200 || !env.ENABLED_CHAINS) return response;
      if (!activeChains) {
        return json({ error: {
          code: 'invalid_enabled_chains',
          message: 'The production chain allowlist is invalid'
        } }, env, 503);
      }
      return new Response(JSON.stringify({ chains: activeChains }), {
        status: response.status,
        headers: response.headers
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/jobs' && env.ENABLED_CHAINS) {
      const candidate = await parseJobCandidate(request);
      const requestedChain = typeof candidate?.chain === 'string'
        ? candidate.chain.trim().toLowerCase()
        : null;
      if (!activeChains || (requestedChain && !Object.hasOwn(activeChains, requestedChain))) {
        const authorization = await clientAuthorizationProbe(request, env, context);
        if (authorization.status !== 200) return authorization;
        if (!activeChains) {
          return json({ error: {
            code: 'invalid_enabled_chains',
            message: 'The production chain allowlist is invalid'
          } }, env, 503);
        }
        return json({ error: {
          code: 'chain_not_enabled',
          message: 'The requested chain is not enabled for production testing'
        } }, env, 400);
      }
    }

    return apiWorker.fetch(request, env, context);
  }
};
