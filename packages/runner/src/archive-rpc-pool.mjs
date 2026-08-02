const TRACE_METHOD = /^(?:debug_|trace_)/;
const QUOTA_MESSAGE = /(?:quota|rate limit|too many requests|monthly limit|usage limit|free plan|credits? exhausted)/i;
const TRANSIENT_MESSAGE = /(?:timeout|timed out|temporar|try again|gateway|socket hang up|connection reset|fetch failed|unavailable)/i;
const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_RETRY_DELAYS_MS = Object.freeze([0, 250, 1_000, 2_500]);
const PUBLIC_ERROR_MESSAGE = 'Archive RPC request failed';
const PUBLIC_FAILURE_CLASSES = new Set([
  'quota_or_rate_limit',
  'transient_http',
  'method_unsupported',
  'network_or_timeout',
  'rpc_error',
  'invalid_response',
  'unknown',
  'no_eligible_slot'
]);
const PUBLIC_METHOD = /^[A-Za-z][A-Za-z0-9_]{0,127}$/;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function hiddenUrlSlot({ id, pool, url, legacy = false }) {
  const slot = { id, pool, legacy };
  Object.defineProperty(slot, 'url', {
    value: url,
    enumerable: false,
    configurable: false,
    writable: false
  });
  return slot;
}

function normalizeChainName(chainName) {
  if (typeof chainName !== 'string' || !/^[a-z0-9_-]+$/i.test(chainName)) {
    throw new Error('chainName must contain only alphanumerics, underscore, or hyphen');
  }
  return chainName.replaceAll('-', '_').toUpperCase();
}

export function loadArchiveRpcSlots({
  chainName,
  legacyEnv,
  environment = process.env,
  allowLegacyFallback = true
}) {
  const chain = normalizeChainName(chainName);
  const slots = [];
  for (let index = 1; index <= 7; index += 1) {
    const suffix = String(index).padStart(2, '0');
    const value = environment[`SIM_ARCHIVE_PRIMARY_${chain}_${suffix}`];
    if (typeof value === 'string' && value.length > 0) {
      slots.push(hiddenUrlSlot({ id: `primary-${suffix}`, pool: 'primary', url: value }));
    }
  }
  for (let index = 1; index <= 3; index += 1) {
    const suffix = String(index).padStart(2, '0');
    const value = environment[`SIM_ARCHIVE_SECONDARY_${chain}_${suffix}`];
    if (typeof value === 'string' && value.length > 0) {
      slots.push(hiddenUrlSlot({ id: `secondary-${suffix}`, pool: 'secondary', url: value }));
    }
  }
  if (allowLegacyFallback && legacyEnv) {
    const value = environment[legacyEnv];
    if (typeof value === 'string' && value.length > 0) {
      slots.push(hiddenUrlSlot({ id: 'legacy-01', pool: 'secondary', url: value, legacy: true }));
    }
  }
  return slots;
}

function normalizeSlot(slot) {
  if (!slot || typeof slot !== 'object') throw new Error('RPC slot must be an object');
  if (typeof slot.id !== 'string' || !/^[a-z]+-[0-9]{2}$/.test(slot.id)) throw new Error('RPC slot id is invalid');
  if (!['primary', 'secondary'].includes(slot.pool)) throw new Error('RPC slot pool is invalid');
  const url = slot.url;
  if (typeof url !== 'string' || url.length === 0) throw new Error(`RPC slot ${slot.id} has no URL`);
  return hiddenUrlSlot({ id: slot.id, pool: slot.pool, url, legacy: Boolean(slot.legacy) });
}

function methodRoute(method, configuration) {
  const explicit = configuration.methodRoutes?.[method];
  if (explicit) return explicit;
  for (const [pattern, route] of Object.entries(configuration.methodRoutes ?? {})) {
    if (!pattern.endsWith('*')) continue;
    if (method.startsWith(pattern.slice(0, -1))) return route;
  }
  return TRACE_METHOD.test(method) ? 'primary' : 'secondary';
}

function eligiblePools(route, configuration) {
  switch (route) {
    case 'primary-only': return ['primary'];
    case 'secondary-only': return ['secondary'];
    case 'primary': return configuration.allowSecondaryForPrimaryFailure ? ['primary', 'secondary'] : ['primary'];
    case 'secondary': return configuration.allowPrimaryForSecondaryFailure ? ['secondary', 'primary'] : ['secondary'];
    case 'any': return ['primary', 'secondary'];
    default: return ['primary', 'secondary'];
  }
}

function classifyFailure({ status, decoded, error }) {
  const message = String(decoded?.error?.message ?? error?.message ?? 'RPC request failed');
  if (status === 429 || QUOTA_MESSAGE.test(message)) return { class: 'quota_or_rate_limit', qualifying: true };
  if (status && TRANSIENT_STATUS.has(status)) return { class: 'transient_http', qualifying: true };
  if (decoded?.error?.code === -32601 || /method not found|not supported/i.test(message)) {
    return { class: 'method_unsupported', qualifying: true };
  }
  if (error || TRANSIENT_MESSAGE.test(message)) return { class: 'network_or_timeout', qualifying: true };
  if (decoded?.error) return { class: 'rpc_error', qualifying: true };
  return { class: 'invalid_response', qualifying: true };
}

function publicFailureClass(value) {
  return typeof value === 'string' && PUBLIC_FAILURE_CLASSES.has(value) ? value : 'unknown';
}

function publicMethod(value) {
  return typeof value === 'string' && PUBLIC_METHOD.test(value) ? value : null;
}

function responseId(payload) {
  return Array.isArray(payload) ? null : payload?.id ?? null;
}

async function requestOne({ slot, payload, fetchImpl, requestTimeoutMs, retryDelaysMs }) {
  let lastFailure;
  for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
    const delay = retryDelaysMs[attempt];
    if (delay > 0) await sleep(delay);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl(slot.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
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
      if (response.ok && decoded && !decoded.error) {
        return { decoded, attempts: attempt + 1 };
      }
      lastFailure = classifyFailure({ status: response.status, decoded });
      const canRetry = TRANSIENT_STATUS.has(response.status)
        || lastFailure.class === 'quota_or_rate_limit'
        || lastFailure.class === 'network_or_timeout';
      if (!canRetry || attempt === retryDelaysMs.length - 1) break;
    } catch (error) {
      lastFailure = classifyFailure({ error });
      if (attempt === retryDelaysMs.length - 1) break;
    } finally {
      clearTimeout(timeout);
    }
  }
  return { failure: lastFailure ?? { class: 'unknown', qualifying: true } };
}

function createSlotState(slot) {
  return {
    slot,
    failures: 0,
    successes: 0,
    requests: 0,
    retries: 0,
    quarantined: false,
    unsupportedMethods: new Set(),
    lastFailureClass: null
  };
}

function diagnosticsFor(states, requestCount, failureCount) {
  return {
    requests: requestCount,
    failures: failureCount,
    slots: states.map((state) => ({
      id: state.slot.id,
      pool: state.slot.pool,
      legacy: state.slot.legacy,
      requests: state.requests,
      successes: state.successes,
      failures: state.failures,
      retries: state.retries,
      quarantined: state.quarantined,
      unsupportedMethods: [...state.unsupportedMethods].sort(),
      lastFailureClass: state.lastFailureClass
    }))
  };
}

export function createArchiveRpcRouter({
  slots,
  routing = {},
  healthPolicy = {},
  fetchImpl = globalThis.fetch,
  retryDelaysMs = routing.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS,
  requestTimeoutMs = routing.requestTimeoutMs ?? 30_000
}) {
  if (!Array.isArray(slots) || slots.length === 0) throw new Error('At least one archive RPC slot is required');
  if (typeof fetchImpl !== 'function') throw new Error('fetchImpl must be a function');
  if (!Array.isArray(retryDelaysMs) || retryDelaysMs.length === 0) throw new Error('retryDelaysMs must be non-empty');
  const threshold = healthPolicy.sessionFailureThreshold ?? 3;
  if (!Number.isSafeInteger(threshold) || threshold < 1) throw new Error('sessionFailureThreshold must be positive');

  const configuration = {
    methodRoutes: routing.methodRoutes ?? {},
    allowPrimaryForSecondaryFailure: routing.allowPrimaryForSecondaryFailure ?? true,
    allowSecondaryForPrimaryFailure: routing.allowSecondaryForPrimaryFailure ?? false,
    distribution: routing.distribution ?? { strategy: 'round-robin' }
  };
  const states = slots.map((slot) => createSlotState(normalizeSlot(slot)));
  const cursors = { primary: 0, secondary: 0 };
  let requestCount = 0;
  let failureCount = 0;

  function available(pool, method) {
    return states.filter((state) => (
      state.slot.pool === pool
      && !state.quarantined
      && !state.unsupportedMethods.has(method)
    ));
  }

  function orderedCandidates(pool, method) {
    const candidates = available(pool, method);
    if (candidates.length <= 1) return candidates;
    const strategy = configuration.distribution.strategy ?? 'round-robin';
    if (strategy === 'least-used') {
      return [...candidates].sort((a, b) => a.requests - b.requests || a.slot.id.localeCompare(b.slot.id));
    }
    if (strategy === 'random') {
      return [...candidates].sort(() => Math.random() - 0.5);
    }
    const start = cursors[pool] % candidates.length;
    return [...candidates.slice(start), ...candidates.slice(0, start)];
  }

  function advanceAfterSuccess(pool, state) {
    const candidates = available(pool, '');
    const index = candidates.findIndex((candidate) => candidate === state);
    if (index >= 0) cursors[pool] = index + 1;
    else cursors[pool] += 1;
  }

  async function requestSingle(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.method !== 'string') {
      throw new Error('Single JSON-RPC payload is required');
    }
    requestCount += 1;
    const route = methodRoute(payload.method, configuration);
    const pools = eligiblePools(route, configuration);
    let lastFailure;
    for (const pool of pools) {
      const candidates = orderedCandidates(pool, payload.method);
      for (const state of candidates) {
        state.requests += 1;
        const result = await requestOne({
          slot: state.slot,
          payload,
          fetchImpl,
          requestTimeoutMs,
          retryDelaysMs
        });
        if (result.decoded) {
          state.successes += 1;
          state.retries += Math.max(0, result.attempts - 1);
          advanceAfterSuccess(pool, state);
          return result.decoded;
        }
        failureCount += 1;
        state.failures += 1;
        state.lastFailureClass = result.failure.class;
        lastFailure = result.failure;
        if (result.failure.class === 'method_unsupported') state.unsupportedMethods.add(payload.method);
        if (result.failure.qualifying && state.failures >= threshold) state.quarantined = true;
      }
    }
    const error = new Error(PUBLIC_ERROR_MESSAGE);
    error.code = 'ARCHIVE_RPC_UNAVAILABLE';
    error.failureClass = publicFailureClass(lastFailure?.class ?? 'no_eligible_slot');
    const method = publicMethod(payload.method);
    if (method) error.method = method;
    throw error;
  }

  return {
    async request(payload) {
      if (Array.isArray(payload)) {
        const outputs = [];
        for (const entry of payload) outputs.push(await requestSingle(entry));
        return outputs;
      }
      return requestSingle(payload);
    },
    get diagnostics() {
      return diagnosticsFor(states, requestCount, failureCount);
    },
    get sessionSummary() {
      return diagnosticsFor(states, requestCount, failureCount);
    },
    jsonError(payload, error) {
      const failureClass = publicFailureClass(error?.failureClass);
      const method = publicMethod(error?.method);
      return {
        jsonrpc: '2.0',
        id: responseId(payload),
        error: {
          code: -32000,
          message: PUBLIC_ERROR_MESSAGE,
          data: {
            code: 'ARCHIVE_RPC_UNAVAILABLE',
            failureClass,
            ...(method ? { method } : {})
          }
        }
      };
    }
  };
}