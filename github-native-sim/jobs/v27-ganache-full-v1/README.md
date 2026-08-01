# CurveYield V27 Ganache Full Simulation v1

This temporary GitHub-native job converts the uploaded V27 remote trace/state-journal packet into an ephemeral Ganache live-fork execution.

## Execution boundary

- dRPC supplies read-only Ethereum state through the repository's fail-closed fork proxy.
- Every deployment, transfer, deposit, harvest, withdrawal, delayed change, migration, and negative test executes only inside local Ganache.
- No private key is read and no transaction is broadcast to Ethereum.
- `trace_callMany` and `debug_traceCall` are not used.

## Trace-data replacement

Every write produces a call record containing:

- deterministic simulation call ID and call index;
- sender, target, value, calldata, calldata hash, gas limit, and block context;
- transaction hash, receipt status, gas used, effective gas price, deployment address, and logs;
- decoded contract events and raw logs;
- local `debug_traceTransaction` output, with call-tracer and struct-logger fallback evidence;
- complete entity snapshots immediately before and after the operation;
- deterministic state-diff and cumulative-journal hashes;
- revert data and error metadata for expected and unexpected failures.

## Artifact

The workflow uploads `CurveYield-V27-Ganache-Full-Data-Report-v1-<run-id>`, including:

- `data-report.json`
- `summary.md`
- `calls/*.json`
- `snapshots/*.json`
- `branches/*`
- compiler input, output, diagnostics, and normalized artifacts

The execution is one-shot and uploads partial evidence if any required operation fails.
