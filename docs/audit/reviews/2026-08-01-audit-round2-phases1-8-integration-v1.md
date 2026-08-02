# Audit Round 2 — Phases 1–8 Integration Review v1

## Decision

**Recommendation: ACCEPT WITH DOCUMENTED ADAPTATIONS**

This review covers the reconstructed Phase 1–8 Audit subsystem on branch `audit-round2/phases1-8-integration-v1`.

- Assigned starting SHA: `3f68cc1b12cc7f9a84e4cb04b768c049138814c6`
- Source provenance manifest: `docs/audit/integration/2026-08-01-audit-round2-phases1-8-provenance-v1.json`
- Reviewed implementation head: the parent of this review commit.
- Exact post-review 40-character branch SHA: pinned in issue #103, Worker 2 completed status, and the immutable completion event after this review commit is published and re-fetched. A Git commit cannot contain its own final SHA without changing that SHA.

## Accepted source registry

| Component | Accepted source SHA | Source issue | Integrated scope |
|---|---|---:|---|
| Phases 1–3 | `2a6b9ced81f7729b48cf8b82e82dc3e6ccbcf35c` | #70 | Protocol, conditional store, profile registry, workspace, campaign/job, evidence/report services |
| Phase 4 | `8beb17a3f4a9df0a32a07caf19fc17fb633d4d75` | #74 | Profile, parser, invocation-plan, result-contract, compatibility packages |
| Phase 5 | `dd78a76f9546c85e79357a617b219067704c1616` | #76 | Profile, parser, result, catalog packages with lifecycle repair |
| Phase 6 | `1b20f634b6d3c5f1261d490e545415c81d7488f2` | #77 | Formal profile/parser/result/catalog packages |
| Phases 7–8 | `4c875bb9291d3e714af9cd0013ee5d460f576a2b` | #97 | Fork, checkpoint, clean-room, controlled merge, provenance packages |

## Explicit exclusions

- Phase 9 / GitHub Direct / issue #98.
- `packages/github-native-sim/**`.
- `.github/workflows/github-native-simulate.yml`.
- current-main runner RPC method policy, fork RPC guard, and run-job implementation.
- `apps/audit-web`, CurveYield Lite, deployment and infrastructure configuration.
- new or modified workflows, secrets, production credentials, and cloud integration.
- incomplete Phase 4 catalog/API issue #72.
- temporary repair and verification workflows.

## Changed files and ownership

### Integration documentation

- `docs/audit/integration/2026-08-01-audit-round2-phases1-8-provenance-v1.json`
- `docs/audit/reviews/2026-08-01-audit-round2-phases1-8-integration-v1.md`

### Phases 1–3

- `packages/audit-protocol/package.json`
- `packages/audit-protocol/src/index.mjs`
- `packages/audit-r2-store/package.json`
- `packages/audit-r2-store/src/index.mjs`
- `packages/audit-profile-registry/src/index.mjs`
- `packages/audit-workspace-protocol/src/index.mjs`
- `packages/audit-workspaces/src/index.mjs`
- `packages/audit-campaign-protocol/src/index.mjs`
- `packages/audit-campaigns/src/index.mjs`
- `packages/audit-evidence/src/index.mjs`

### Phase 4

- `packages/audit-tool-profile-contracts/src/index.mjs`
- `packages/audit-tool-parsers/src/core.mjs`
- `packages/audit-tool-parsers/src/profiles.mjs`
- `packages/audit-tool-parsers/src/index.mjs`
- `packages/audit-executor-adapters/src/index.mjs`
- `packages/audit-tool-result-contracts/src/result-primitives-v1.mjs`
- `packages/audit-tool-result-contracts/src/result-evidence-v1.mjs`
- `packages/audit-tool-result-contracts/src/result-contract-v1.mjs`
- `packages/audit-tool-result-contracts/src/compatibility-v1.mjs`
- `packages/audit-tool-result-contracts/src/contract-documentation-v2.mjs`
- `packages/audit-tool-result-contracts/src/index.mjs`

### Phase 5

- `packages/audit-phase5-profile-contracts/src/templates.mjs`
- `packages/audit-phase5-profile-contracts/src/validation.mjs`
- `packages/audit-phase5-profile-contracts/src/publication.mjs`
- `packages/audit-phase5-profile-contracts/src/index.mjs`
- `packages/audit-phase5-parsers/src/index.mjs`
- `packages/audit-phase5-result-contracts/src/contracts.mjs`
- `packages/audit-phase5-result-contracts/src/index.mjs`
- `packages/audit-phase5-tool-catalog/src/index.mjs`

### Phase 6

- `packages/audit-phase6-profile-contracts/src/index.mjs`
- `packages/audit-phase6-parsers/src/index.mjs`
- `packages/audit-phase6-result-contracts/src/primitives.mjs`
- `packages/audit-phase6-result-contracts/src/identities.mjs`
- `packages/audit-phase6-result-contracts/src/result-contract.mjs`
- `packages/audit-phase6-result-contracts/src/documentation.mjs`
- `packages/audit-phase6-result-contracts/src/index.mjs`
- `packages/audit-phase6-tool-catalog/src/catalog.mjs`
- `packages/audit-phase6-tool-catalog/src/compatibility.mjs`
- `packages/audit-phase6-tool-catalog/src/index.mjs`

### Phase 7

- `packages/audit-fork-protocol/src/base-primitives.mjs`
- `packages/audit-fork-protocol/src/digest.mjs`
- `packages/audit-fork-protocol/src/constants.mjs`
- `packages/audit-fork-protocol/src/internals.mjs`
- `packages/audit-fork-protocol/src/fork-contracts.mjs`
- `packages/audit-fork-protocol/src/checkpoint-contracts.mjs`
- `packages/audit-fork-protocol/src/mock-contracts.mjs`
- `packages/audit-fork-protocol/src/transition.mjs`
- `packages/audit-fork-protocol/src/keys.mjs`
- `packages/audit-fork-protocol/src/index.mjs`
- `packages/audit-fork-mock-adapter/src/index.mjs`
- `packages/audit-forks/src/storage.mjs`
- `packages/audit-forks/src/checkpoint-operations.mjs`
- `packages/audit-forks/src/service.mjs`
- `packages/audit-forks/src/index.mjs`

### Phase 8

- `packages/audit-clean-room-protocol/src/digest.mjs`
- `packages/audit-clean-room-protocol/src/boundary.mjs`
- `packages/audit-clean-room-protocol/src/constants.mjs`
- `packages/audit-clean-room-protocol/src/policy.mjs`
- `packages/audit-clean-room-protocol/src/access-context.mjs`
- `packages/audit-clean-room-protocol/src/grants.mjs`
- `packages/audit-clean-room-protocol/src/references.mjs`
- `packages/audit-clean-room-protocol/src/index.mjs`
- `packages/audit-clean-room-access/src/index.mjs`
- `packages/audit-clean-room-campaigns/src/index.mjs`
- `packages/audit-controlled-merge/src/index.mjs`
- `packages/audit-provenance/src/index.mjs`

### Focused acceptance fixtures/tests

- `test/fixtures/audit-round2-phases1-8/canonical-v1.json`
- `test/audit-round2-phases1-8-identity.test.mjs`
- `test/audit-round2-phases1-8-adversarial.test.mjs`
- `test/audit-round2-phases1-8-static-boundary.test.mjs`
- `test/audit-round2-phases1-8-e2e.test.mjs`
- `test/audit-round2-phases1-8-mutation.test.mjs`

Every changed path belongs to the assigned Phase 1–8 integration packages, focused tests/fixtures, or integration review/provenance documentation.

## Preservation gate

The focused static suite computes Git blob SHA-1 values from actual checkout bytes and proves these current-main files remain exact:

| Protected file | Required Git blob SHA |
|---|---|
| `.github/workflows/github-native-simulate.yml` | `54e446d4a715ca9678ed4d7434f7ba90b2c67c96` |
| `packages/runner/src/rpc-method-policy.mjs` | `59dfa72f41a697d533720a4d8f939a81aeba6736` |
| `packages/runner/src/fork-rpc-guard.mjs` | `73690f16b506baa50ca471ce5b5566ccb601e765` |
| `packages/runner/src/run-job.mjs` | `e6489c756d43a2f294120ac3c84687030fb919db` |
| `packages/github-native-sim/src/fork-rpc-proxy.mjs` | `4d7e2bd1114f5a37914b26447c9c79a1e40a58e6` |
| `packages/github-native-sim/src/run-job-file.mjs` | `8c4c82d76e249b74efc630c8cbf0d7707d25b5f2` |

Result: **6/6 byte-identical**.

## Functional truth table

| Phase | Accepted identity/result | Execution state | Verified behavior |
|---|---|---|---|
| 1 | Audit IDs, roles, scopes, capabilities | no executor | strict IDs and recursive forbidden-field rejection |
| 2 | immutable profile/workspace/source/layer identity | no executor | ETag-conditional writes, digest-bound workspace layers |
| 3 | campaign/job/evidence/report identity | disabled | admission, trusted-fixture gate, append-only evidence, report acceptance |
| 4 | six profile/parser/result identities | unavailable | deterministic parsing, plan recording, lifecycle/evidence congruence |
| 5 | four profile/parser/result/catalog identities | unavailable | deterministic results/catalog; resource-exhaustion exit code repaired to null |
| 6 | three trusted-producer formal identities | unavailable | redaction, duplicate/conflict handling, referential integrity, formal outcome envelopes |
| 7 | fork request/state/action/checkpoint identity | external create awaits executor | deterministic inert mock, checkpoint/export/restore/delete/tombstone |
| 8 | policy/access/campaign/merge/provenance identity | disabled | blinded isolation, grant-gated access, one-source controlled merge, chained provenance |

## Test-first and verification evidence

### Initial RED

At the assigned starting SHA, representative required package probes returned `404`, including Phase 4 and Phase 6 production paths. The selected Phase 1–8 destination packages were not present on current main.

### Focused final GREEN

Command:

```text
node --test \
  test/audit-round2-phases1-8-identity.test.mjs \
  test/audit-round2-phases1-8-adversarial.test.mjs \
  test/audit-round2-phases1-8-static-boundary.test.mjs \
  test/audit-round2-phases1-8-e2e.test.mjs \
  test/audit-round2-phases1-8-mutation.test.mjs
```

Result: **26 tests, 26 pass, 0 fail**.

### Mutation/adversarial corpus

- 55 one-field invalid mutations.
- hostile accessors rejected without getter execution.
- recursive forbidden capabilities rejected.
- lifecycle and parser/profile substitution rejected.
- Phase 5 terminal exit-code drift rejected after the integrated repair.
- Phase 6 dangling references and conflicting duplicate identities preserve bounded parser-error envelopes.
- Phase 7 invalid transitions and execution-gate substitution rejected.
- Phase 8 custom prototypes, digest drift, and invalid limits rejected.

### Syntax

Command pattern:

```text
find packages -type f -path '*/src/*.mjs' -print0 | sort -z | xargs -0 -n1 node --check
find test -maxdepth 1 -type f -name 'audit-round2-phases1-8-*.test.mjs' -print0 | sort -z | xargs -0 -n1 node --check
```

Result: **63 production modules plus 5 focused tests checked; 0 syntax failures**.

### Repository root tests

Command:

```text
node --test test/*.test.mjs
```

Result: **PASS, exit 0**.

### Package test script

The root `test` script was allowlisted only when it resolved to a direct `node --test` command.

Command:

```text
npm test
```

Result: **PASS, exit 0; no dependency installation performed**.

### Build

No build was executed unless the root build script resolved to a direct allowlisted Node command. Dependency installation, compilation, submitted-project execution, Solidity/Foundry/SMT/Halmos/Z3 execution, containers, deployment, and workflows remained forbidden. The build gate is therefore **not claimed beyond the executed syntax and direct-Node tests**.

## Adaptations and upstream defects

1. **Phase 5 lifecycle repair:** non-completed `resource_exhaustion` parser output is normalized to `exitCode: null`, repairing the accepted-with-repair mismatch from issue #76.
2. **Compact documentation:** Phase 4 and Phase 6 descriptive schema modules retain their accepted public export names and exact identity summaries but are compact. Runtime validators remain authoritative.
3. **Compact Phase 5 implementation:** identity/version/publication/result/catalog contracts retain accepted public identities and non-execution state while using a smaller integrated implementation.
4. **Compact Phase 8 service implementations:** strict accepted protocol primitives are preserved; campaign, merge, and provenance services use bounded storage-only implementations without execution capability.
5. No defect required modifying current-main GitHub-native or RPC-policy code.

## Residual risks

- No real external executor, compiler, solver, RPC endpoint, package manager, container, deployment, or submitted project was executed.
- Phase 4–8 compact adaptations should receive independent code review before any future executor is enabled.
- Real immutable container digests and runtime compatibility remain outside this integration package.
- Phase 9/GitHub Direct remains explicitly excluded.

## Final recommendation

**ACCEPT WITH DOCUMENTED ADAPTATIONS** for the non-executing Phase 1–8 integration boundary. Do not infer approval for Phase 9, GitHub Direct, production execution, workflow changes, or deployment.
