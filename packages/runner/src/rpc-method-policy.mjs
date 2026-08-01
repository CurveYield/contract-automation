export const ALLOWED_FORK_RPC_METHODS = Object.freeze([
  'eth_accounts',
  'eth_getBalance',
  'eth_getCode',
  'eth_getProof',
  'eth_getStorageAt',
  'eth_blockNumber',
  'eth_getBlockByHash',
  'eth_getBlockByNumber',
  'eth_newBlockFilter',
  'eth_getBlockReceipts',
  'eth_getBlockTransactionCountByHash',
  'eth_getBlockTransactionCountByNumber',
  'eth_chainId',
  'eth_protocolVersion',
  'net_listening',
  'net_version',
  'net_peerCount',
  'eth_syncing',
  'eth_hashrate',
  'trace_filter',
  'trace_rawTransaction',
  'trace_block',
  'trace_replayBlockTransactions',
  'debug_traceBlockByHash',
  'debug_traceBlockByNumber',
  'trace_transaction',
  'debug_traceTransaction',
  'trace_replayTransaction',
  'trace_callMany',
  'trace_get',
  'trace_call',
  'debug_traceCall',
  'eth_getLogs',
  'eth_newFilter',
  'eth_getFilterChanges',
  'eth_uninstallFilter',
  'eth_getFilterLogs',
  'eth_call',
  'eth_sendRawTransaction',
  'eth_feeHistory',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_createAccessList',
  'eth_maxPriorityFeePerGas',
  'eth_getUncleByBlockHashAndIndex',
  'eth_getUncleByBlockNumberAndIndex',
  'eth_getUncleCountByBlockHash',
  'eth_getUncleCountByBlockNumber',
  'eth_coinbase',
  'eth_mining',
  'eth_subscribe',
  'eth_unsubscribe',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_newPendingTransactionFilter',
  'eth_getTransactionByBlockHashAndIndex',
  'eth_getTransactionByBlockNumberAndIndex',
  'txpool_content',
  'web3_clientVersion',
  'web3_sha3'
]);

const ALLOWED_METHOD_SET = new Set(ALLOWED_FORK_RPC_METHODS);

export function isForkRpcMethodAllowed(method) {
  return typeof method === 'string' && ALLOWED_METHOD_SET.has(method);
}

function normalizedMethod(method) {
  return typeof method === 'string' && method.length > 0 ? method : '<invalid>';
}

export function unsupportedForkRpcMethod(payload) {
  const requests = Array.isArray(payload) ? payload : [payload];
  for (const entry of requests) {
    const method = entry && typeof entry === 'object' ? entry.method : undefined;
    if (!isForkRpcMethodAllowed(method)) return normalizedMethod(method);
  }
  return null;
}

export class RpcCallNotSupportedError extends Error {
  constructor(method) {
    const normalized = normalizedMethod(method);
    super(`Call not supported: ${normalized}`);
    this.name = 'RpcCallNotSupportedError';
    this.code = 'CALL_NOT_SUPPORTED';
    this.rpcCode = -32601;
    this.method = normalized;
  }
}

function errorBody(error) {
  return {
    code: error.rpcCode,
    message: error.message,
    data: {
      code: error.code,
      method: error.method,
      simulationTerminated: true
    }
  };
}

function responseId(entry) {
  return entry && typeof entry === 'object' && Object.hasOwn(entry, 'id') ? entry.id : null;
}

function responseForEntry(entry, error) {
  return {
    jsonrpc: '2.0',
    id: responseId(entry),
    error: errorBody(error)
  };
}

export function rpcCallNotSupportedResponse(payload, error) {
  if (!(error instanceof RpcCallNotSupportedError)) {
    throw new TypeError('error must be a RpcCallNotSupportedError');
  }
  if (Array.isArray(payload)) {
    return payload.length > 0
      ? payload.map((entry) => responseForEntry(entry, error))
      : [responseForEntry(null, error)];
  }
  return responseForEntry(payload, error);
}

export function createRpcPolicyTermination() {
  const abortController = new AbortController();
  let resolveTermination;
  let currentError = null;
  const termination = new Promise((resolve) => {
    resolveTermination = resolve;
  });

  return {
    termination,
    signal: abortController.signal,
    terminate(methodOrError) {
      if (currentError) return currentError;
      currentError = methodOrError instanceof RpcCallNotSupportedError
        ? methodOrError
        : new RpcCallNotSupportedError(methodOrError);
      abortController.abort(currentError);
      resolveTermination(currentError);
      return currentError;
    },
    get error() {
      return currentError;
    }
  };
}

export async function raceWithRpcPolicyTermination(operation, termination, options = {}) {
  const operationPromise = Promise.resolve(operation);
  if (!termination || typeof termination.then !== 'function') return operationPromise;

  let terminated = false;
  operationPromise.then(
    (value) => {
      if (terminated && typeof options.onLateValue === 'function') {
        Promise.resolve(options.onLateValue(value)).catch(() => {});
      }
    },
    () => {}
  );

  const outcome = await Promise.race([
    Promise.resolve(termination).then((error) => ({ kind: 'termination', error })),
    operationPromise.then(
      (value) => ({ kind: 'value', value }),
      (error) => ({ kind: 'error', error })
    )
  ]);

  if (outcome.kind === 'termination') {
    terminated = true;
    throw outcome.error;
  }
  if (outcome.kind === 'error') throw outcome.error;
  return outcome.value;
}
