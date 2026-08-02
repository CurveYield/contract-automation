# GitHub Direct Audit Round 3 Release Candidate Implementation Plan

> **Execution mode:** inline TDD on `audit-round3/github-direct-audit-release-v1`. The authoritative requirements are issue #115 and mailbox sequence 7.

**Goal:** Produce the penultimate `github-direct-audit-v1` control-plane release candidate with strict public contracts, deterministic recovery, trusted workflow isolation, transport-neutral compatibility manifests, and a complete Round 4 handoff.

**Architecture:** Preserve the accepted issue #104 package boundaries. Harden only the boundary that owns each defect: protocol canonicalization, ledger cross-record validation, service/reporting public-result contracts, GitHub transport reconciliation, workflow trust/permission separation, and release compatibility metadata. Submitted-project execution remains disabled and the GitHub-native simulation/RPC addon remains byte-frozen.

**Tech stack:** Node.js ES modules, `node:test`, pure JSON/canonical SHA-256 records, dependency-injected GitHub transports, GitHub Actions YAML.

## Global constraints

- No dependency installation/download or package-manager execution.
- No submitted-project execution, process/container/RPC, wallet/signing/transaction/broadcast, deployment, production secret, workflow approval, PR, branch merge, or merge to `main`.
- Modify only issue #115 owned paths.
- Never modify `.github/workflows/github-native-simulate.yml`, `packages/github-native-sim/**`, runner RPC-policy/guard/run-job files, or other workers' paths.
- Every production change starts with an observed failing `test/audit-round3-github-direct-*` case.

## Task 1 — Source pinning and RED release gate

**Create**
- `test/audit-round3-github-direct-release-boundaries-v1.test.mjs`
- `docs/audit/github-direct/ROUND3_TRUST_INTERFACE_MAP_v1.md`
- `docs/audit/github-direct/ROUND3_PROTECTED_BLOBS_v1.json`

**Tests must fail against the starting SHA for:**
1. mixed-case GitHub repository names not canonicalizing to lowercase;
2. request-publication operations that can be swapped or rebound without rejection;
3. transition operations that can be swapped or rebound without rejection;
4. missing strict service-result and service-error validators;
5. weak nested reporting and artifact-index identity validation;
6. publication paths outside the closed ledger namespace;
7. transport duplicate side effects after a publication-record write failure;
8. repository-wide artifact metadata not scoped to the exact target/job;
9. caller-selected workflow installation/reporting scope and write permissions on read-only operations;
10. missing transport-neutral compatibility and Round 4 handoff manifests.

## Task 2 — Canonical protocol and ledger binding

**Modify**
- `packages/audit-github-direct-protocol/src/boundary.mjs`
- `packages/audit-github-direct-ledger/src/paths.mjs`
- `packages/audit-github-direct-ledger/src/publication.mjs`
- `packages/audit-github-direct-ledger/src/transitions.mjs`
- `packages/audit-github-direct-ledger/src/index.mjs`

**Produce**
- `fullName()` accepts GitHub-valid mixed case but returns the lowercase canonical full name.
- `buildPublicationLedgerPath({jobId,publicationId})` and a closed `publications/<job>/<publication>.json` path family.
- request-publication validation proving request/current/index exact paths, contents, state, and blob linkage.
- transition validation proving event/current/index operation order, paths, contents, versions, and blob linkage.

## Task 3 — Strict service and reporting contracts

**Modify**
- `packages/audit-github-direct-service/src/contracts.mjs`
- `packages/audit-github-direct-reporting/src/index.mjs`
- `apps/audit-github-direct-cli/src/cli.mjs`

**Produce**
- `validateServiceResult()` and `validateServiceError()`.
- closed, command/state-specific result-data validation with no credential-like field names and exact job/SHA correlation.
- complete nested validation for reporting bundles, ledger plans, publication plans, report indexes, timestamps, and identities.
- artifact-index validation for job ID, target SHA, unique artifact IDs, and exact metadata objects.
- CLI validates the service response before serializing it and maps malformed responses to a stable service-failure exit.

## Task 4 — Replay-safe GitHub transport and scoped artifacts

**Modify**
- `apps/audit-github-direct-cli/src/github-actions-transport.mjs`
- `apps/audit-github-direct-cli/src/workflow-host.mjs`
- `packages/audit-github-direct-adapter/src/adapter.mjs` only if required to pass server-owned job identity to artifact metadata reads.

**Produce**
- deterministic publication journal path from the closed ledger builder.
- side-effect reconciliation before create: Check `external_id`, exact status tuple, and deterministic hidden comment marker.
- retry after journal-write failure discovers the already-created side effect and writes the missing journal without duplicating it.
- artifact metadata filters to the exact repository ID and target SHA artifact name; unrelated repository artifacts are ignored.
- workflow authorization configuration is validated and token values never enter returned data.

## Task 5 — Trusted workflow and operation-specific permissions

**Modify**
- `.github/workflows/audit-direct-v1.yml`
- focused Round 3 workflow tests.

**Produce**
- no caller-selected installation ID or report issue number;
- server-owned workflow authorization scope and repository-variable report issue;
- separate read-only, submit, cancel, and report jobs with minimum permissions;
- trusted source checkout pinned to `github.workflow_sha`, target checkout as inert data, full action SHAs, bounded inputs, and `cancel-in-progress: false`;
- target branches cannot select commands, credentials, runner labels/images, trusted source, or permissions.

## Task 6 — Compatibility, release manifest, and Round 4 handoff

**Create**
- `packages/audit-github-direct-service/src/compatibility.mjs`
- `packages/audit-github-direct-service/src/release-manifest.mjs`
- `docs/audit/github-direct/ROUND4_HANDOFF_v1.md`
- `docs/audit/reviews/2026-08-01-audit-round3-github-direct-release-v1.md`

**Produce**
- transport-neutral compatibility manifest for Worker 1 API and Worker 2 integration-spine intake without importing their internals;
- exact command/result/error schema versions, public exports, control branch/root, workflow permissions/pins, artifact naming, integration order, and residual risks;
- deterministic release manifest and validator;
- minimal Round 4 acceptance commands and protected-blob verification inventory.

## Verification and checkpoints

- Checkpoint 1: source findings, protected hashes, interface/trust map, observed RED.
- Checkpoint 2: protocol/ledger schemas, identity/path/state/CAS/recovery matrices.
- Checkpoint 3: capabilities, transport traces, CLI/exit codes, publication/artifact reconciliation.
- Checkpoint 4: workflow trust proof, compatibility manifests, inert E2E scenarios.
- Checkpoint 5: final SHA, all changed files, aggregate tests/mutations/attacks, protected hashes, review, handoff, and recommendation.

Final verification must include all permissible direct Node tests, CLI fixture tests, syntax checks for every owned production module, YAML/JSON parsing, workflow static scans, changed-path allowlist, protected-blob equality, and whitespace checks.
