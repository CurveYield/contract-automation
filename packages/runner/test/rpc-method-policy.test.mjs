import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALLOWED_FORK_RPC_METHODS,
  RpcCallNotSupportedError,
  createRpcPolicyTermination,
  isForkRpcMethodAllowed,
  rpcCallNotSupportedResponse,
  unsupportedForkRpcMethod
} from '../src/rpc-method-policy.mjs';

const expectedMethods = [
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
];

test('canonical external fork RPC allowlist is exact and immutable', () => {
  assert.deepEqual(ALLOWED_FORK_RPC_METHODS, expectedMethods);
  assert.equal(Object.isFrozen(ALLOWED_FORK_RPC_METHODS), true);
  for (const method of expectedMethods) assert.equal(isForkRpcMethodAllowed(method), true, method);
});

test('documentation variants and unlisted methods are not literal allowed methods', () => {
  for (const method of [
    'eth_getBlockByHash#full',
    'eth_getBlockByNumber#full',
    'trace_replayBlockTransactions#vmTrace',
    'trace_replayTransaction#vmTrace',
    'eth_sendTransaction',
    'evm_mine',
    '',
    null
  ]) {
    assert.equal(isForkRpcMethodAllowed(method), false, String(method));
  }
});

test('payload validation identifies the first unsupported method before batch execution', () => {
  assert.equal(unsupportedForkRpcMethod({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_getCode',
    params: []
  }), null);

  assert.equal(unsupportedForkRpcMethod([
    { jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [] },
    { jsonrpc: '2.0', id: 2, method: 'eth_sendTransaction', params: [] },
    { jsonrpc: '2.0', id: 3, method: 'personal_unlockAccount', params: [] }
  ]), 'eth_sendTransaction');
});

test('unsupported-call error and JSON-RPC response use the stable termination contract', () => {
  const error = new RpcCallNotSupportedError('eth_sendTransaction');
  assert.equal(error.name, 'RpcCallNotSupportedError');
  assert.equal(error.code, 'CALL_NOT_SUPPORTED');
  assert.equal(error.rpcCode, -32601);
  assert.equal(error.method, 'eth_sendTransaction');
  assert.equal(error.message, 'Call not supported: eth_sendTransaction');

  const response = rpcCallNotSupportedResponse({
    jsonrpc: '2.0',
    id: 7,
    method: 'eth_sendTransaction',
    params: []
  }, error);
  assert.deepEqual(response, {
    jsonrpc: '2.0',
    id: 7,
    error: {
      code: -32601,
      message: 'Call not supported: eth_sendTransaction',
      data: {
        code: 'CALL_NOT_SUPPORTED',
        method: 'eth_sendTransaction',
        simulationTerminated: true
      }
    }
  });
});

test('mixed batch receives an error for every request ID and termination fires once', async () => {
  const controller = createRpcPolicyTermination();
  const first = controller.terminate('eth_sendTransaction');
  const second = controller.terminate('personal_unlockAccount');
  assert.equal(second, first);
  assert.equal(controller.signal.aborted, true);
  assert.equal(controller.signal.reason, first);
  assert.equal(await controller.termination, first);

  const response = rpcCallNotSupportedResponse([
    { jsonrpc: '2.0', id: 10, method: 'eth_getCode', params: [] },
    { jsonrpc: '2.0', id: 11, method: 'eth_sendTransaction', params: [] }
  ], first);
  assert.deepEqual(response.map((entry) => entry.id), [10, 11]);
  for (const entry of response) {
    assert.equal(entry.error.code, -32601);
    assert.equal(entry.error.data.code, 'CALL_NOT_SUPPORTED');
    assert.equal(entry.error.data.method, 'eth_sendTransaction');
    assert.equal(entry.error.data.simulationTerminated, true);
  }
});
