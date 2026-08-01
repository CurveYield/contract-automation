# Fork RPC Method Policy v2

Both PreflightSim execution paths enforce this fail-closed policy at the external fork-RPC boundary:

- the Cloudflare-backed PreflightSim runner; and
- the GitHub-native contract simulation runner.

Local Ganache methods such as `evm_mine`, `evm_snapshot`, `evm_revert`, `evm_increaseTime`, and `evm_setAccountBalance` remain local. They are not forwarded to repository RPC secrets and are not restricted by this external allowlist.

## Allowed external methods

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

`eth_getBlockByHash#full`, `eth_getBlockByNumber#full`, `trace_replayBlockTransactions#vmTrace`, and `trace_replayTransaction#vmTrace` are documentation labels, not literal JSON-RPC methods. Their base methods are allowed and their variants are selected through parameters. Literal method names containing `#` are rejected.

## Unsupported-call response and termination

An unsupported method returns:

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

The request is never forwarded. Retries stop, in-flight external requests are aborted, the proxy closes, and the complete simulation attempt fails even when a workflow step used `continueOnFailure`.

## Batch behavior

A full batch is validated before any local response, cache read, retry, or upstream forwarding. If one entry is unsupported, no entry executes externally. Every request ID receives the same `CALL_NOT_SUPPORTED` error naming the first unsupported method, and the simulation terminates.

## Provider requirements

An RPC provider need not support every allowed method. It must support the subset requested by Ganache and the job. A provider-tier failure for an allowed method remains an upstream RPC failure rather than a policy violation.