# Round 1 Audit Integration Acceptance Checklist v1

## Base and lineage

- [ ] Confirm `main` HEAD immediately before first transplant.
- [ ] If `main` differs from `49a606ef35e9e0f253e20c689e64c0f8945f8cb2`, reset the still-empty `audit-round1/integration-v1` branch to the newly reviewed main HEAD and update the control gate.
- [ ] Preserve every latest-main GitHub-native simulation file and post-merge fix.
- [ ] Transplant only Audit-owned paths from each accepted source; never merge stale worker ancestry wholesale.
- [ ] Record source blob SHA and destination blob SHA for every transplanted file.

## Phase 1–3 reconstruction

- [ ] Reconstruct the accepted Audit delta from `f0a1dd46551fc867778a295eef525262efb51b00..2a6b9ced81f7729b48cf8b82e82dc3e6ccbcf35c` onto latest main.
- [ ] Verify API, web, R2 store, workspace, profile, campaign, evidence, specification, infra and test files against the source manifest.
- [ ] Verify production deployment workflows remain untriggered.
- [ ] Verify `AUDIT_EXECUTION_ENABLED=false` and no submitted execution path exists.

## Phase 4

- [ ] Transplant profile contracts, inert adapter plans, parsers and fixtures from `d90099c201d3012c090b6f73dda604bd5b143c95` by owned path only.
- [ ] Transplant result-contract v2 paths from `8beb17a3f4a9df0a32a07caf19fc17fb633d4d75`.
- [ ] Pin Worker 1 issue #72 final SHA and transplant its accepted catalog/API paths.
- [ ] Resolve `entry.mjs` composition against reconstructed Phase 3 rather than copying the stale full file.
- [ ] Prove exactly six profile IDs and exact parser-version identity.
- [ ] Prove read authentication accepts only approved persistent identities and does not parse request bodies.
- [ ] Prove capability flags derive from exact package identity, not array lengths or request data.

## Phase 5

- [ ] Transplant all Phase 5 owned paths from `2982614879f1f6d252a7630eb5331031d5934b4e`.
- [ ] Prove all four profiles use `exitCode:null` for timeout, cancelled and resource exhaustion.
- [ ] Prove parser/result/catalog/profile identities are congruent.
- [ ] Replay all inert Phase 5 fixtures and mutation vectors.

## Phase 6

- [ ] Transplant all Phase 6 owned paths from `1b20f634b6d3c5f1261d490e545415c81d7488f2`.
- [ ] Prove SMT, symbolic and formal profile/parser/result/catalog identities are congruent.
- [ ] Replay proof, counterexample, malformed, timeout, cancellation, resource-exhaustion and truncation fixtures.

## Phase 7

- [ ] Pin issue #80 final SHA after independent review.
- [ ] Confirm destructive deletion transitions to `deleting` before deleting checkpoint/export objects.
- [ ] Confirm deletion is idempotent and partial-write retry-safe.
- [ ] Confirm tenant index updates derive tenant identity from immutable request/current state.
- [ ] Prove no `list`, `copy`, network, process, RPC, wallet, signer, transaction, broadcast or execution capability.
- [ ] Prove active and exported checkpoint quotas, retention and operation traces.

## Phase 8

- [ ] Pin issue #91 final SHA and all four checkpoint comment IDs.
- [ ] Prove tenant/workspace/campaign default-deny authorization.
- [ ] Prove hidden absent and hidden existing resources yield byte-identical observable responses within the deterministic model.
- [ ] Prove no hidden counts, indexes, search facets, notifications, signed-resource plans, cache metadata or relation hints leak.
- [ ] Prove duplicate/conflict maps preserve every original finding and evidence reference.
- [ ] Prove provenance referential integrity, deterministic ordering and hidden-resource-aware queries.
- [ ] Prove controlled merge uses exact approved campaign IDs and no prefix listing.

## Cross-phase acceptance

- [ ] Run all direct Node Audit tests without dependency download.
- [ ] Parse every JSON fixture, schema, manifest and package file.
- [ ] Run syntax checks for every changed `.mjs` file.
- [ ] Run changed-path allowlist and forbidden-capability scans.
- [ ] Verify all outputs are deterministic, bounded and recursively frozen where required.
- [ ] Verify no Cloudflare/GitHub Direct automatic fallback or cross-mode storage import exists.
- [ ] Verify CurveYield Lite and non-Audit contracts remain unchanged.
- [ ] Produce exact changed-file inventory, source/destination blob map, test counts, blocked checks, residual risks and final recommendation.
- [ ] Do not begin Phase 9 implementation until this checklist is accepted.
