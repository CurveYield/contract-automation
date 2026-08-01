# Fail-Closed Fork RPC Method Policy Design v2

## Goal

Apply one canonical external JSON-RPC allowlist to both the Cloudflare-backed and GitHub-native fork-simulation paths. Any method outside the list in `docs/rpc-method-policy-v2.md` returns `Call not supported`, is never forwarded, and terminates the complete simulation attempt.

## Boundary

The restriction is enforced only where local Ganache traffic exits toward an `RPC_*` repository secret. Local simulation-control calls remain available inside Ganache.

## Architecture

`packages/runner/src/rpc-method-policy.mjs` owns the immutable method list, `RpcCallNotSupportedError`, JSON-RPC error serialization, full-payload validation, and one-shot termination coordination.

The Cloudflare-backed runner places `packages/runner/src/fork-rpc-guard.mjs` between Ganache and its external RPC. The GitHub-native runner applies the same policy inside its existing proxy while preserving pinned-block prefetch, retries, cache, deterministic account overlays, and the hash-locked Ethereum genesis/metadata fixture inherited from current `main`.

Both runners race engine startup and workflow execution against the proxy termination promise. Policy termination therefore cannot be suppressed by `continueOnFailure`.

## Error contract

Unsupported methods use JSON-RPC code `-32601`, application code `CALL_NOT_SUPPORTED`, the rejected method, and `simulationTerminated: true`.

A mixed batch is rejected before any entry is served locally, cached, retried, or forwarded. Every request ID receives the same error naming the first unsupported method.

## Lifecycle

On rejection, the response is flushed, the termination signal fires once, in-flight external fetches are aborted, retries cease, the proxy listener closes, the engine is closed, and the suite's existing failure-report path serializes the error.

## Verification

Dependency-free Node tests cover the exact allowlist, pseudo-method rejection, stable error fields, allowed forwarding, zero-upstream rejection, mixed-batch atomicity, termination priority, late-engine cleanup, and equivalent GitHub-native behavior. JavaScript syntax is checked without dependency installation or Solidity compilation.