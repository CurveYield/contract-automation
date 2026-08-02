# Live-Fork Multi-RPC Simulation Design

## Status

Approved for immediate implementation on 2026-08-02.

## Goal

Upgrade both the GitHub-native and Cloudflare-orchestrated simulation pathways from a single-RPC Ganache-only design to a shared, continuously archive-backed live-fork system. The system must use BlockPI-class primary archive endpoints for methods that dRPC free endpoints do not serve, use dRPC-class secondary endpoints for high-volume standard archive reads, rotate traffic across optional endpoint slots, quarantine failing endpoints, persist repeated failures across sessions, and expose a maximally configurable simulation script surface.

## Non-goals and fixed safety boundaries

The system does not broadcast transactions to public chains. Submitted jobs cannot provide RPC URLs, credentials, private keys, shell commands, package scripts, signed transactions, or arbitrary executable code. Secret values never enter artifacts, logs, health records, issue bodies, workflow summaries, or reports. Unsupported combinations fail explicitly; the system does not silently downgrade a requested assurance property.

## Shared architecture

Both pathways use the same trusted modules:

1. configuration validator and resolver;
2. optional secret-slot loader;
3. capability-aware RPC router;
4. per-session health tracker;
5. cross-session health backend;
6. fork-engine adapter;
7. structured workflow runtime;
8. normalized evidence and report renderer.

The GitHub-native pathway continues to select one contained committed job. The Cloudflare pathway continues to authenticate and materialize a stored job. After job resolution, both call the same simulation service.

## Engines

Supported engine modes are:

- `hardhat-edr`: preferred modern engine;
- `ganache`: retained for compatibility with older EVM targets and existing workflows;
- `auto`: ordered engine preference with configured fallback reasons;
- `differential`: execute the same deterministic workflow through selected engines and compare normalized results.

Every engine that claims live-fork operation must remain connected to the shared archive router for untouched remote state. A one-time preload is not live-fork evidence and must not be reported as such.

## RPC secret slots

Existing `RPC_<CHAIN>` secrets remain unchanged and are legacy-only fallbacks.

Each supported chain gains ten optional, separate simulation secrets:

- `SIM_ARCHIVE_PRIMARY_<CHAIN>_01` through `_07`;
- `SIM_ARCHIVE_SECONDARY_<CHAIN>_01` through `_03`.

No slot is mandatory. Empty slots are ignored. Slot identifiers, never URLs, appear in diagnostics.

## Routing model

The default policy routes `debug_*`, `trace_*`, replay, VM-trace, and methods shown by capability probing to be unsupported by secondary providers to the primary pool. Standard archive reads, blocks, receipts, logs, fee data, estimates, proofs, code, balances, storage, and ordinary `eth_call` requests use the secondary pool. Scripts may override routes per exact method or method family, subject to the repository RPC allowlist.

Supported distribution modes include round-robin, weighted round-robin, least-used, random, sticky session, sticky method, sticky block, failover-only, and custom weights. The default is equal weighted round-robin within each eligible pool.

The router validates chain identity and can validate fork-block hashes across providers. Optional cross-provider consistency checks support fail, majority, quarantine-minority, prefer-primary, prefer-secondary, record-only, or an administrator-defined policy.

## Fork and block configuration

A job can select:

- explicit block number;
- latest resolved once at session start;
- safe or finalized tag resolved once;
- scripted upstream progression;
- follow-latest, follow-safe, or follow-finalized through explicit controlled reforks.

The report records requested mode, resolved block number, hash, timestamp, provider observations, and every later refork.

## Local progression

Structured workflow actions include:

- mine one or many blocks;
- mine with a constant or scripted timestamp interval;
- increase time;
- set next-block timestamp;
- mine at or until a timestamp;
- advance to a local block number;
- configure automine or interval mining;
- snapshot and revert;
- set balance and impersonate approved actors;
- configure supported local block fields.

Local progression preserves the simulated overlay. It is distinct from changing the canonical upstream fork block.

## Reforking

A refork action may target an explicit block, latest-at-action, safe, finalized, or scripted sequence. State handling is configurable:

- discard;
- replay entire workflow;
- replay from checkpoint;
- replay selected steps;
- deterministic transaction journal replay;
- state overlay where the selected engine can accurately apply balances, nonces, code, and storage;
- approved custom trusted handler.

The default is discard. A requested strategy unsupported by the chosen engine fails before state mutation.

## Endpoint health

Each endpoint has method capabilities and health state.

Within one simulation session, the default threshold is three qualifying failures for the same endpoint. The endpoint is then quarantined for the rest of the session. Qualifying classes include quota exhaustion, rate limiting, timeouts, connection failures, invalid responses, provider internal failures, wrong chain, wrong block, archive unavailability, and inconsistent data. Method-not-supported can disable only that route unless configured otherwise.

Across sessions, four consecutive failed sessions disable the endpoint until an administrator or developer explicitly re-probes and re-enables it. A session counts only when the endpoint was selected. An endpoint that later succeeds can reset its consecutive-session count according to policy.

The durable default backend is an append-only GitHub issue event ledger. Trusted runner code reads structured health events, derives current status, appends the current session result, and creates or updates a prominent incident issue when a slot crosses the disable threshold. The ledger contains chain, pool, slot ID, method capabilities, timestamps, run identifiers, redacted error classes, and administrator recovery events. It never stores URLs.

## Configuration hierarchy

Resolved policy order is:

1. fixed security invariants;
2. administrator-enforced policy;
3. repository defaults;
4. chain defaults;
5. job configuration;
6. step-level override.

All technically safe behavior is configurable. Fixed restrictions cover secret exposure, arbitrary user endpoints, public broadcasting, untrusted code execution, evidence falsification, and resource isolation.

## Reporting

Every result records:

- engine and version;
- live-fork assurance mode;
- requested and resolved fork policy;
- block hashes and timestamps;
- local mining and time changes;
- reforks and state strategy;
- provider slot request counts by method class;
- retries, fallbacks, quarantines, persistent disables, and recoveries;
- capability-probe and consistency results;
- final local block and timestamp;
- reproducibility classification;
- differential-engine mismatches when requested.

## Migration

The shared router replaces both `packages/github-native-sim/src/fork-rpc-proxy.mjs` and `packages/runner/src/fork-rpc-guard.mjs` as the upstream transport implementation. Thin compatibility exports may remain so existing imports do not break. Both workflows receive the optional secret slots and a narrowly scoped token for the health ledger. Existing single-RPC secrets are used only when the script explicitly allows legacy fallback.

Ganache remains available but is no longer the only or default engine. Hardhat EDR becomes the preferred engine after exact CI acceptance. Existing structured actions remain backward compatible, and new configuration is versioned.

## Acceptance

The implementation is ready for the first launch only after:

- schema and routing tests pass;
- all empty/partial/full slot combinations are accepted;
- trace methods route to primary and standard methods to secondary;
- equal rotation is demonstrated;
- three failures quarantine a slot for the session;
- four failed session events disable a slot until recovery;
- URLs are absent from reports;
- arbitrary block/time progression works;
- explicit refork policies validate;
- both GitHub-native and Cloudflare runners call the shared service;
- Hardhat EDR starts a continuously archive-backed fork;
- Ganache remains an explicit compatibility option;
- a contained first-simulation manifest and operating guide are committed;
- repository tests, lint, syntax checks, and the dedicated acceptance workflow pass.
