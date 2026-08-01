# Fail-Closed Fork RPC Method Policy Design v1

## Goal

Apply one explicit external fork-RPC method allowlist to both PreflightSim execution paths:

1. the original Cloudflare-backed PreflightSim runner; and
2. the GitHub-native simulation runner.

Any external fork-RPC request whose JSON-RPC `method` is not in the allowlist must receive a `Call not supported` JSON-RPC error and immediately terminate the entire simulation attempt. The rejected request must never reach the configured upstream RPC provider.

## Boundary

The policy applies only where the simulator forwards requests from local Ganache to the external chain RPC endpoint. It does not restrict calls made by the workflow executor to the local Ganache node, including `evm_mine`, `evm_snapshot`, `evm_revert`, `evm_increaseTime`, `evm_setAccountBalance`, or local transaction submission.

This distinction preserves stateful local simulation while strictly limiting the methods that can leave the GitHub runner and reach a repository RPC secret.

## Canonical allowlist

The following literal JSON-RPC method names are allowed:

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

Documentation labels containing `#full` or `#vmTrace` are parameter variants, not literal JSON-RPC method names. Therefore:

- `eth_getBlockByHash#full` maps to `eth_getBlockByHash` with its full-transaction boolean parameter;
- `eth_getBlockByNumber#full` maps to `eth_getBlockByNumber` with its full-transaction boolean parameter;
- `trace_replayBlockTransactions#vmTrace` maps to `trace_replayBlockTransactions` with the requested trace type in parameters; and
- `trace_replayTransaction#vmTrace` maps to `trace_replayTransaction` with the requested trace type in parameters.

Literal methods containing `#` are not allowed.

## Error contract

An unsupported method produces a JSON-RPC error with:

```json
{
  "code": -32601,
  "message": "Call not supported: <method>",
  "data": {
    "code": "CALL_NOT_SUPPORTED",
    "method": "<method>",
    "simulationTerminated": true
  }
}
```

The thrown runner error uses:

- `name`: `RpcCallNotSupportedError`;
- `code`: `CALL_NOT_SUPPORTED`;
- `rpcCode`: `-32601`;
- `method`: the rejected method.

The error is persisted through each suite's existing failure-report path.

## Batch behavior

A JSON-RPC batch is validated before any entry is served locally, read from cache, or forwarded upstream. If one entry is unsupported:

1. no entry in the batch is executed or forwarded;
2. each request ID in the batch receives the same `CALL_NOT_SUPPORTED` error identifying the first unsupported method; and
3. the simulation termination signal is fired exactly once.

This avoids partial batch execution and prevents callers from waiting indefinitely for IDs that were silently skipped.

## Components

### Shared policy module

`packages/runner/src/rpc-method-policy.mjs` owns:

- the immutable allowlist;
- allowlist lookup;
- `RpcCallNotSupportedError`;
- JSON-RPC error serialization;
- full-payload prevalidation;
- a one-shot termination controller; and
- a helper that races engine/workflow operations against policy termination and safely closes a late-resolving engine.

### Cloudflare-backed runner

`packages/runner/src/fork-rpc-guard.mjs` is a minimal local HTTP proxy between Ganache and the external RPC URL. It validates a complete request or batch before forwarding it unchanged. On an unsupported method it responds with the policy error, signals termination, and closes its listener after the response is flushed.

`packages/runner/src/run-job.mjs` starts the guard before Ganache, passes only the guard URL to the engine, races engine startup and workflow execution against the guard termination signal, records transport diagnostics, and closes both engine and guard in `finally`.

### GitHub-native runner

`packages/github-native-sim/src/fork-rpc-proxy.mjs` retains its pinned-block prefetch, retries, cache, and deterministic local-account overlay. It imports the same policy module and validates an incoming request or complete batch before any local/cache/upstream processing. It exposes the same termination signal.

`packages/github-native-sim/src/run-job-file.mjs` races engine startup and workflow execution against that termination signal and preserves the existing failure artifact behavior.

## Security and lifecycle properties

- The external RPC URL remains secret and is never returned in errors.
- Unsupported calls are never retried.
- Unsupported calls are never forwarded.
- A mixed batch cannot partially execute.
- `continueOnFailure` cannot suppress a policy termination because the runner-level termination race sits outside workflow-step handling.
- Engine and proxy resources are closed after termination.
- Compilation behavior, submitted-source handling, chain allowlisting, and local workflow actions remain unchanged.

## Verification

Tests must prove:

1. every canonical method is accepted;
2. unlisted and literal `#` methods are rejected;
3. error fields are stable;
4. the Cloudflare guard forwards allowed calls;
5. the Cloudflare guard rejects single and mixed-batch unsupported calls without touching upstream;
6. the GitHub-native proxy has identical fail-closed behavior;
7. runner-level termination wins over a later workflow failure; and
8. resources close after termination.

No dependency installation or Solidity compilation is required for the focused policy and proxy tests.