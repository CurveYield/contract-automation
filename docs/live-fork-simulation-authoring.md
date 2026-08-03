# Live-Fork Simulation Authoring Guide

## Purpose

Contract Automation simulations execute transactions only inside an ephemeral local fork engine while continuously loading untouched canonical state from trusted archive RPC pools. The local fork is mutable; the public chain is never mutated and no submitted workflow can broadcast a transaction to it.

Both execution pathways use the same implementation:

- GitHub-native committed jobs;
- Cloudflare-authenticated PreflightSim jobs.

Hardhat 3 EDR is the preferred engine. Ganache remains available for compatibility testing.

## Security boundary

A simulation manifest cannot contain RPC URLs, credentials, private keys, mnemonics, signed transactions, shell commands, package scripts, or broadcast instructions. Repository secrets supply archive endpoints. Transaction actions are sent only to the local fork engine.

## Minimal simulation configuration

```json
{
  "mode": "simulate",
  "chain": "ethereum",
  "block": "latest",
  "simulation": {
    "engine": { "mode": "hardhat-edr" },
    "fork": { "start": { "mode": "latest-at-start" } },
    "rpc": { "allowLegacyRpcFallback": true }
  },
  "workflow": {
    "steps": [
      { "action": "mine", "blocks": 1 }
    ]
  }
}
```

`latest-at-start` resolves one exact upstream block and pins the entire session to it. The result contains the resolved block number, hash, timestamp, EDR metadata, and provider-slot diagnostics.

## Engine selection

### Hardhat EDR

```json
{
  "engine": {
    "mode": "hardhat-edr",
    "options": {
      "hardfork": "osaka",
      "blockGasLimit": 60000000,
      "transactionGasCap": 16777216,
      "startupTimeoutMs": 60000
    }
  }
}
```

Use EDR for current Ethereum bytecode and normal assurance work.

### Ganache compatibility mode

```json
{
  "engine": {
    "mode": "ganache"
  }
}
```

Use Ganache only when testing compatibility with older runtimes or comparing behavior. Modern bytecode may require EDR.

### Automatic fallback

```json
{
  "engine": {
    "mode": "auto",
    "preference": ["hardhat-edr", "ganache"],
    "fallbackOn": ["engine_dependency_missing", "startup_failure"]
  }
}
```

Fallback occurs only for explicitly listed reasons. The report records the engine actually used.

### Differential mode

The configuration schema reserves `differential` mode for running the same deterministic workflow through multiple engines. Until the dedicated differential orchestrator is enabled, requesting this mode fails explicitly; it never silently substitutes one engine.

## Fork start modes

### Explicit block

```json
{
  "fork": {
    "start": {
      "mode": "explicit",
      "blockNumber": 21000000
    }
  }
}
```

Best for reproducible audits.

### Resolve latest once

```json
{
  "fork": {
    "start": { "mode": "latest-at-start" }
  }
}
```

The latest block is resolved once and then pinned.

### Safe or finalized tag

```json
{
  "fork": {
    "start": {
      "mode": "tag",
      "tag": "safe"
    }
  }
}
```

Allowed tags are `latest`, `safe`, and `finalized`.

## Local block and time progression

Local progression preserves every simulated deployment and transaction.

### Mine blocks

```json
{ "action": "mine", "blocks": 100 }
```

### Mine with timestamps

```json
{
  "action": "mine",
  "blocks": 100,
  "intervalSeconds": 12
}
```

### Increase time and mine

```json
{ "action": "increaseTime", "seconds": 604800 }
```

### Set the next timestamp

```json
{
  "action": "setNextBlockTimestamp",
  "timestamp": 1800000000
}
```

### Mine at a timestamp

```json
{
  "action": "mineAtTimestamp",
  "timestamp": 1800000012
}
```

### Mine until a timestamp

```json
{
  "action": "mineUntilTimestamp",
  "timestamp": 1800086400,
  "intervalSeconds": 12
}
```

### Advance to a local block

```json
{
  "action": "advanceToBlock",
  "blockNumber": 22000000,
  "intervalSeconds": 12
}
```

A target behind the current local block fails. Use `refork` to move the upstream base backward.

### Mining modes

```json
{ "action": "setAutomine", "enabled": false }
```

```json
{ "action": "setIntervalMining", "intervalMilliseconds": 1000 }
```

## Snapshots

```json
{ "action": "snapshot", "alias": "before-upgrade" }
```

```json
{ "action": "revertSnapshot", "snapshot": "$before-upgrade" }
```

Snapshots are local fork checkpoints inside one engine process.

## Reforking

Reforking changes the canonical upstream base. It is different from mining local blocks.

### Discard local state

```json
{
  "action": "refork",
  "target": {
    "mode": "explicit",
    "blockNumber": 22000000
  },
  "stateStrategy": "discard"
}
```

### Resolve latest at the action

```json
{
  "action": "refork",
  "target": { "mode": "latest-at-action" },
  "stateStrategy": "replay-workflow"
}
```

### Replay selected steps

```json
{
  "action": "refork",
  "target": {
    "mode": "tag",
    "tag": "safe"
  },
  "stateStrategy": "replay-selected-steps",
  "replay": {
    "fromStep": 0,
    "throughStep": 12,
    "verifyOutputs": true
  }
}
```

### Replay from a checkpoint

```json
{
  "action": "refork",
  "target": { "mode": "latest-at-action" },
  "stateStrategy": "replay-from-checkpoint",
  "replay": { "checkpoint": "after-deploy" }
}
```

Supported strategies are:

- `discard`;
- `replay-workflow`;
- `replay-from-checkpoint`;
- `replay-selected-steps`;
- `transaction-journal`;
- `state-overlay` when an engine can prove complete capture and application;
- `custom-handler` supplied only by trusted runner code.

An unsupported strategy fails before reset. There is no implicit downgrade.

## Contract workflow actions

### Deploy

```json
{
  "action": "deploy",
  "alias": "vault",
  "contract": "Vault",
  "source": "src/Vault.sol",
  "args": [],
  "from": "$account0",
  "value": "0"
}
```

### State-changing call

```json
{
  "action": "call",
  "target": "$vault",
  "function": "deposit(uint256)",
  "args": ["1000000000000000000"],
  "from": "$account0",
  "saveAs": "depositTx"
}
```

### Static call

```json
{
  "action": "staticCall",
  "target": "$vault",
  "function": "totalAssets() view returns (uint256)",
  "args": [],
  "saveAs": "assets"
}
```

### Expected revert

```json
{
  "action": "expectRevert",
  "target": "$vault",
  "function": "withdraw(uint256)",
  "args": ["1"],
  "from": "$account1",
  "reason": "Unauthorized"
}
```

### Native balances and transfers

```json
{
  "action": "setBalance",
  "account": "$account0",
  "amount": "100000000000000000000"
}
```

```json
{
  "action": "transferNative",
  "from": "$account0",
  "to": "$account1",
  "amount": "1000000000000000000"
}
```

### Assertions

```json
{
  "action": "assertBalance",
  "account": "$account1",
  "min": "1000000000000000000"
}
```

```json
{
  "action": "assertCall",
  "target": "$vault",
  "function": "totalAssets() view returns (uint256)",
  "args": [],
  "equals": "1000000000000000000"
}
```

## RPC routing configuration

```json
{
  "rpc": {
    "allowLegacyRpcFallback": true,
    "distribution": {
      "strategy": "round-robin",
      "rotateEveryRequests": 1
    },
    "methodRoutes": {
      "debug_*": "primary",
      "trace_*": "primary",
      "eth_getCode": "secondary",
      "eth_getStorageAt": "secondary",
      "eth_call": "secondary",
      "eth_getLogs": "secondary"
    },
    "allowPrimaryForSecondaryFailure": true,
    "allowSecondaryForPrimaryFailure": false,
    "retryDelaysMs": [0, 250, 1000, 2500],
    "requestTimeoutMs": 30000,
    "health": {
      "sessionFailureThreshold": 3,
      "crossSessionFailureThreshold": 4
    },
    "consistency": {
      "requireChainIdMatch": true,
      "requireForkBlockHashMatch": true,
      "crossCheckProviders": 1,
      "onDisagreement": "fail"
    }
  }
}
```

Route values are `primary`, `primary-only`, `secondary`, `secondary-only`, and `any`.

Primary endpoints are normally trace-capable BlockPI-class archive endpoints. Secondary endpoints are normally high-volume dRPC-class archive endpoints. Names describe capabilities, not mandatory vendors.

## External RPC methods permitted by policy

The proxy validates the entire request or batch before forwarding anything. Only these external methods are permitted:

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

`eth_sendRawTransaction` exists in the engine-facing allowlist because a fork engine may use it as part of its internal protocol. Submitted simulation scripts cannot supply raw or signed transactions, and the architecture does not route user-authored broadcasts to a public chain.

## Core external methods for most simulations

The methods most commonly required to hydrate and observe a fork are:

- `eth_chainId`;
- `eth_blockNumber`;
- `eth_getBlockByNumber`;
- `eth_getBalance`;
- `eth_getCode`;
- `eth_getStorageAt`;
- `eth_getProof`;
- `eth_call`;
- `eth_getLogs`;
- `eth_getTransactionCount`;
- `eth_getTransactionReceipt`;
- `eth_feeHistory`;
- `eth_gasPrice`;
- `eth_estimateGas`.

High-assurance diagnostics commonly add:

- `debug_traceCall`;
- `debug_traceTransaction`;
- `trace_call`;
- `trace_transaction`;
- `trace_block`;
- replay methods when supported by the selected primary tier.

A provider does not need to implement every permitted method. It must implement the subset requested by the selected engine and workflow. Unsupported methods are recorded by endpoint and excluded from later routing for that session.

## Local-only EVM methods

These methods are sent to the local fork engine, never to archive endpoints:

- `evm_mine`;
- `evm_increaseTime`;
- `evm_setNextBlockTimestamp`;
- `evm_setTime` fallback;
- `evm_snapshot`;
- `evm_revert`;
- `evm_setAccountBalance`;
- `evm_setAutomine`;
- `evm_setIntervalMining`;
- `hardhat_impersonateAccount`;
- `hardhat_reset`;
- `hardhat_metadata`.

## Error and endpoint behavior

- An endpoint is retried according to `retryDelaysMs`.
- Three qualifying failures in one session quarantine that endpoint for the rest of the session.
- A method-not-supported response may disable only that method route.
- Four consecutive failed sessions persistently disable the slot.
- Unused slots do not gain failed sessions.
- A later successful selected session resets the consecutive failure streak unless administrator policy says otherwise.
- Persistently disabled endpoints are removed before the proxy starts.
- URLs and credentials are never included in reports or health issues.

## Report checks

A high-assurance result should show:

- `assurance: continuous-archive-backed-local-fork`;
- exact resolved block number, hash, and timestamp;
- EDR `forkedNetwork.forkBlockNumber` and `forkBlockHash` equal to the proxy identity;
- engine name and version;
- local final block and timestamp;
- provider slot IDs and request counts;
- retries, failures, quarantines, and persistent health status;
- every workflow step and assertion;
- `broadcastTransactions: false` where the specialized report includes it.
