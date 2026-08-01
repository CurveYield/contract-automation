# Fork RPC Method Policy v1

Both PreflightSim execution paths enforce the same fail-closed method policy at the external fork-RPC boundary:

- the original Cloudflare-backed PreflightSim runner; and
- the GitHub-native contract simulation runner.

The restriction applies only to calls forwarded from local Ganache to the configured repository RPC secret. Local simulation-control calls such as `evm_mine`, `evm_snapshot`, `evm_revert`, `evm_increaseTime`, and `evm_setAccountBalance` remain local and are not forwarded to the chain RPC.

## Allowed external JSON-RPC methods

```text
eth_accounts
eth_getBalance
eth_getCode
eth_getProof
eth_getStorageAt
eth_blockNumber
eth_getBlockByHash
eth_getBlockByNumber
eth_newBlockFilter
eth_getBlockReceipts
eth_getBlockTransactionCountByHash
eth_getBlockTransactionCountByNumber
eth_chainId
eth_protocolVersion
net_listening
net_version
net_peerCount
eth_syncing
eth_hashrate
trace_filter
trace_rawTransaction
trace_block
trace_replayBlockTransactions
debug_traceBlockByHash
debug_traceBlockByNumber
trace_transaction
debug_traceTransaction
trace_replayTransaction
trace_callMany
trace_get
trace_call
debug_traceCall
eth_getLogs
eth_newFilter
eth_getFilterChanges
eth_uninstallFilter
eth_getFilterLogs
eth_call
eth_sendRawTransaction
eth_feeHistory
eth_estimateGas
eth_gasPrice
eth_createAccessList
eth_maxPriorityFeePerGas
eth_getUncleByBlockHashAndIndex
eth_getUncleByBlockNumberAndIndex
eth_getUncleCountByBlockHash
eth_getUncleCountByBlockNumber
eth_coinbase
eth_mining
eth_subscribe
eth_unsubscribe
eth_getTransactionByHash
eth_getTransactionCount
eth_getTransactionReceipt
eth_newPendingTransactionFilter
eth_getTransactionByBlockHashAndIndex
eth_getTransactionByBlockNumberAndIndex
txpool_content
web3_clientVersion
web3_sha3
```

No other external method is allowed.

## Parameter variants

The following documentation labels are not literal JSON-RPC methods:

- `eth_getBlockByHash#full`
- `eth_getBlockByNumber#full`
- `trace_replayBlockTransactions#vmTrace`
- `trace_replayTransaction#vmTrace`

They are represented by their base method plus parameters. The base methods are allowed; literal method strings containing `#` are rejected.

## Unsupported-call response

The simulator returns:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Call not supported: eth_sendTransaction",
    "data": {
      "code": "CALL_NOT_SUPPORTED",
      "method": "eth_sendTransaction",
      "simulationTerminated": true
    }
  }
}
```

Immediately after this response:

1. the external request is not forwarded;
2. retries are disabled for that call;
3. the external RPC proxy stops accepting requests;
4. in-flight external requests are aborted;
5. the complete simulation attempt fails, even when the triggering workflow step used `continueOnFailure`; and
6. the existing failure-report path records the rejected method and error code.

## Batch behavior

Every batch is validated before any local, cached, or upstream processing. When one batch entry uses an unsupported method:

- no entry in the batch executes or reaches the external RPC;
- every request ID receives the same `CALL_NOT_SUPPORTED` error identifying the first unsupported method; and
- the full simulation attempt terminates.

## Provider requirements

An RPC secret does not need to support every allowed method. It must support the subset actually requested by Ganache and the simulation. Provider-tier or provider-specific failures for otherwise allowed methods remain normal upstream RPC failures. The method policy prevents the simulator from attempting any method outside the list above.