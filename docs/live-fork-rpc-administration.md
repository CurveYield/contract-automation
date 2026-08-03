# Live-Fork RPC Administration

## Secret naming

For each supported chain, configure zero through seven primary archive endpoints and zero through three secondary archive endpoints:

```text
SIM_ARCHIVE_PRIMARY_<CHAIN>_01
...
SIM_ARCHIVE_PRIMARY_<CHAIN>_07

SIM_ARCHIVE_SECONDARY_<CHAIN>_01
SIM_ARCHIVE_SECONDARY_<CHAIN>_02
SIM_ARCHIVE_SECONDARY_<CHAIN>_03
```

Supported chain suffixes are:

```text
ETHEREUM
BASE
KATANA
FRAXTAL
ARBITRUM
POLYGON
OPTIMISM
```

Existing `RPC_<CHAIN>` secrets are not changed. A simulation uses them only when its manifest permits `allowLegacyRpcFallback`.

Empty slots are ignored. Slot numbering may contain gaps.

## Recommended provider assignment

- Primary slots: trace-capable BlockPI-class archive endpoints.
- Secondary slots: high-volume dRPC-class archive endpoints.

The names are capability classes, not vendor locks. Any endpoint that passes the required probe may occupy a slot.

## GitHub health token

Persistent health needs a token with `issues: write` on the repository. In GitHub Actions set:

```yaml
env:
  SIM_RPC_HEALTH_GITHUB_TOKEN: ${{ github.token }}
```

The workflow must include:

```yaml
permissions:
  contents: read
  issues: write
```

The Cloudflare-orchestrated and GitHub-native runners use the same issue ledger.

## Health ledger

Each chain has one machine ledger issue:

```text
[RPC Health Ledger] ethereum
```

The issue body contains no endpoints. Each session appends one structured, redacted comment containing:

- slot ID;
- primary/secondary pool;
- whether the slot was selected;
- request, success, and failure counts;
- quarantine status;
- normalized failure class;
- unsupported methods;
- workflow run ID and timestamp.

The current state is derived by replaying the append-only event stream.

## Session quarantine

The default policy quarantines a slot after three qualifying failures during one simulation attempt. A quarantined endpoint receives no more requests in that session.

Qualifying failure classes include:

- quota or rate limit;
- timeout;
- connection failure;
- transient gateway or server error;
- invalid response;
- general RPC error;
- wrong chain or block identity;
- unavailable archive state;
- inconsistent provider data.

A method-not-supported response records the method and can exclude only that method from the endpoint.

## Persistent disablement

After four consecutive failed sessions, the slot becomes disabled before future routers are created. A session counts only when the endpoint was selected.

When a slot crosses the threshold, Contract Automation creates or reopens an incident issue:

```text
[RPC Incident] ethereum primary-03 disabled
```

The incident contains the slot ID, failure class, last run, disable timestamp, and repair instructions. It never contains the RPC URL.

## Failure persistence controls

Environment controls:

```text
SIM_RPC_HEALTH_DISABLED=1
```

Disables the persistent backend for an intentionally isolated run.

```text
SIM_RPC_HEALTH_LOAD_FAIL_OPEN=true
```

Allows a run to continue when the health ledger cannot be read. The default is fail-closed.

```text
SIM_RPC_HEALTH_RECORD_FAIL_OPEN=false
```

Makes failure to append the final session event fail the job. The default is report-and-continue so a completed audit is not destroyed by a post-run GitHub incident.

## Check status

```bash
SIM_RPC_HEALTH_GITHUB_TOKEN="$TOKEN" \
node scripts/rpc-health-admin.mjs status \
  --repository CurveYield/contract-automation \
  --chain ethereum
```

## Recover a repaired endpoint

First replace or repair the repository secret. Then probe the endpoint outside an untrusted simulation and confirm:

- correct chain ID;
- old-block `eth_getCode`;
- old-block `eth_getStorageAt`;
- `eth_call` at the pinned block;
- required debug or trace method for primary endpoints;
- no quota or account restriction error.

Append the recovery event:

```bash
SIM_RPC_HEALTH_GITHUB_TOKEN="$TOKEN" \
node scripts/rpc-health-admin.mjs recover \
  --repository CurveYield/contract-automation \
  --chain ethereum \
  --slot primary-03 \
  --actor James-Nexus
```

The next simulation may select the slot again.

## Manually disable a slot

Use a manual disable event when rotating credentials, performing provider maintenance, or investigating inconsistent data. A manual disable must identify only the slot ID. Never paste the URL into an issue or command output.

## Endpoint capability probe

A primary endpoint should be checked at an old pinned block with at least:

```text
eth_chainId
eth_getBlockByNumber
eth_getBalance
eth_getCode
eth_getStorageAt
eth_getProof
eth_call
debug_traceCall
debug_traceTransaction
trace_call
```

A secondary endpoint should be checked with:

```text
eth_chainId
eth_getBlockByNumber
eth_getBalance
eth_getCode
eth_getStorageAt
eth_getProof
eth_call
eth_getLogs
eth_getTransactionReceipt
eth_feeHistory
eth_estimateGas
```

`trace_callMany` should be treated as a separate capability; not every otherwise qualifying provider tier exposes it.

## Provider replacement

1. Put the new URL in the same repository secret slot.
2. Run the capability probe.
3. Append a recovery event.
4. Launch a contained smoke simulation.
5. Confirm the result shows the slot ID with successful requests and no quarantine.
6. Close the incident issue after the successful report is attached or referenced.

## Redaction verification

Before accepting a release, search generated reports and logs for known URL hostnames, API keys, and secret variable values. Expected evidence should contain only slot IDs such as `primary-01` and `secondary-02`.
