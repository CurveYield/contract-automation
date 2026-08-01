# V27 Ganache State-Journal Replacement Design

## Goal

Replace the packet's remote `trace_callMany`/`debug_traceCall` state machine with a Ganache-local fork state machine while preserving every required observation and running the complete V27 lifecycle through GitHub Actions.

## Architecture

Ganache is the authoritative EVM and persistent state journal. dRPC is used only by the existing fail-closed fork proxy for permitted Ethereum state reads. Real holder and operator addresses are unlocked only inside the ephemeral local fork; no private key is read and no transaction is broadcast to Ethereum.

Each authoritative write is sent as a local Ganache transaction. The runner records a deterministic simulation call ID, call index, sender, target, calldata and hash, value, gas limit, transaction hash, receipt status, gas used, effective gas price, contract address, return/revert data when available, decoded logs, raw logs, a local `debug_traceTransaction` result when supported, a hash of that trace, full before/after entity snapshots, a deterministic entity-state diff and hash, and a cumulative journal hash. This replaces the remote prestate state-diff journal without losing the requested data categories.

Time advances use local `evm_increaseTime` followed by `evm_mine`. Supplemental negative branches use `evm_snapshot` and `evm_revert`, so failed or alternative branches do not mutate the canonical lifecycle.

## Data coverage

The runner must capture:

- pinned chain ID, block number, block hash, timestamp, base fee, and client version;
- code and integration-routing assertions for sdYB, YB, crvUSD, both Curve pools, Yearn, and BoostHub staking;
- holder, operator, fee-recipient, keeper, and admin-fee-receiver balances;
- funding transfers and exact 18,500 sdYB operator increase;
- deployment addresses and constructor outcomes for converter, vault, Strategy 1, and Strategy 2;
- vault total supply, depositor shares, total assets/backing, PPS, pending yield, yield metrics, APY, retained-token state, fee configuration, pending configuration queues, and active strategy;
- per-strategy destination/configuration, total balance/backing, retired state, retained-token state, BoostHub receipt balance, Yearn share balance, loose LP, loose sdYB, and supported reward balances;
- Curve LP balances, Yearn PPS/share balances, BoostHub receipt balances and claimable reward where callable;
- pre/post snapshots around every funding, deployment, configuration, deposit, time advance, harvest, withdrawal, queue, early execution, mature execution, and strategy migration operation;
- performance-fee, withdrawal-fee, retained-share, backing, PPS, destination-allocation, venue withdrawal-order, loss, migration, and final-zero-state reconciliations;
- all packet supplemental tests from cloned snapshots, including authorization, fee caps, invalid destination, vault-only implementation endpoints, delayed configuration queue/cancel/execute, stale queue targeting, protected deposit/withdrawal failures, donation/sync, destination migration, retained invariants, and retired-strategy behavior.

## Failure behavior

The run is one-shot. Any missing external state, unsupported required local Ganache method, failed source hash, compiler failure, unexpected revert, missing observation, or failed reconciliation terminates the run and uploads the partial report. Expected negative tests execute from snapshots and pass only when the expected revert is observed.

## Testing

Pure report/journal helpers are developed test-first. Tests prove deterministic call IDs and hashes, entity-state diff generation, cumulative journal hashing, receipt/trace normalization, and required-field validation. The GitHub workflow first runs the focused tests and syntax checks, then reconstructs and verifies the exact V27 sources, and finally runs the complete Ganache lifecycle once.

## Repository scope

The execution remains on a temporary branch and draft PR and is never merged into `main` unless explicitly requested. Solidity source files are copied byte-for-byte from the uploaded packet; no smart-contract source is modified.
