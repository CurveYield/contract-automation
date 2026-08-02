# Worker 2 — Round 4 deterministic full-platform integration and release-candidate assembly v1

## Identity

- Worker ID: `worker-2-round4-full-platform-integration-v1`
- Sequence: `8`
- Message ID: `worker-2-round4-full-platform-integration-v1-000008`
- Repository: `CurveYield/contract-automation`
- Issue: `#122`
- Branch: `audit-round4/full-platform-integration-v1`
- Starting SHA: `5914b03382422ea714346625a601b5dbda3aa0cd`
- Round: **4 — final static/inert integration and acceptance round before Round 5 production testing**

## Activation model

You may begin **Stage 0 integration preparation immediately**. Do not transplant subsystem production paths until issues #120, #121, #123 and #124 publish accepted/repaired Stage A heads and complete intake manifests. This staged rule supersedes idle waiting but preserves issue #122’s no-premature-intake invariant.

## Authoritative base

- Worker 2 Round 3 final integration-spine head: `5914b03382422ea714346625a601b5dbda3aa0cd`.
- Worker 2 durable report: issue #114 comment `5156779012`.
- Release review and manifest on the starting branch are authoritative subject to Worker 0 review #120.
- Round 4 master gate: issue #119.
- Current approved `main` simulation-addon lineage: `3f68cc1b12cc7f9a84e4cb04b768c049138814c6`; keep it byte-for-byte frozen.

## Goal

Prepare and then assemble the complete Audit platform from exact independently accepted/repaired heads using deterministic path/blob intake, explicit shared-file unions and full provenance. Publish one frozen assembled SHA, coordinate four specialist acceptances against it, reconcile any proven repairs and prepare the complete Round 5 production-test/deployment/rollback/observability package.

## Owned paths

- `packages/audit-integration-*` and `packages/audit-release-*`;
- tests `test/audit-round4-integration-*`;
- fixtures `test/fixtures/audit-round4/integration/**`;
- release/provenance/overlap/union/production-plan docs under `docs/audit/round4/**`;
- exact shared files authorized by committed field-owned union manifests.

Subsystem production paths may change only by exact accepted/repaired intake. Never alter the frozen GitHub-native simulation/App/RPC addon.

## Stage 0 — immediate preparation

1. Pin the starting tree, Round 3 reports/manifests and all five Round 4 issue contracts.
2. Build a candidate-resolution registry that records expected worker, issue, branch, base, report and required manifest schemas without pretending unresolved Stage A heads exist.
3. Build strict validators for completed status snapshots, exact branch-head resolution, report references and path/blob manifests.
4. Build a complete preliminary path ownership registry for Phase 1–8, API, GitHub Direct, web, workflows, shared files and protected addon paths.
5. Add RED tests for stale/malformed status, wrong branch, wrong report, missing blob, duplicate path, nested overlap, undocumented adaptation and protected path mutation.
6. Build deterministic shared-file union schemas with base blob, ordered inputs, disjoint field ownership, output digest and required post-union tests.
7. Build intake-wave checkpoint templates and exact rerun matrices for core, API, GitHub Direct and web waves.
8. Build the Round 5 production-input schema: secret names only, variable names, Cloudflare bindings/resources, domains, R2 resources, GitHub variables, read-only RPC networks, spend/rate caps, rollback and observability.

### Checkpoint 0

Post exact base verification, preparatory registry paths, observed RED results, unresolved Stage A slots, protected hashes and changed paths. Do not claim subsystem intake.

## Stage 1 — resolve reviewed candidates

After each reviewer publishes Stage A completion:

9. Resolve exact SHA/report/path/blob/public-interface manifest and independently reject any mismatch.
10. Record Worker 0’s reviewed integration-spine verdict from #120.
11. Record Worker 1’s reviewed/repaired Phase 7–8 candidate from #121.
12. Record Worker 3’s reviewed/repaired API/auth candidate from #123.
13. Record Worker 4’s reviewed/repaired GitHub Direct/UI candidates from #124.
14. Publish a final overlap/union/provenance plan before modifying subsystem paths.

### Checkpoint 1

Post all resolved heads/reports/manifests, overlap registry, rejected inputs, exact intake order and pre-intake test results.

## Stage 2 — deterministic intake

15. Start from the accepted/repaired Phase 1–6 integration-spine head.
16. Replace every stale Phase 7–8 path with exact Worker 1 reviewed/repaired output.
17. Intake exact Worker 3 reviewed/repaired API/GPT/auth paths.
18. Intake exact Worker 3 Round 3 GitHub Direct paths/workflow plus any accepted Worker 4 compatibility repair.
19. Intake exact Worker 4 web/UI paths plus any accepted Stage A repair.
20. Apply shared-file unions field by field only from committed manifests.
21. Restore/verify approved `main` simulation-addon files byte-for-byte.
22. Publish an exact SHA after each intake wave and rerun that wave’s required gates.

### Checkpoint 2

Post Phase 1–8 intake SHA, path/blob evidence, core tests and protected hashes.

### Checkpoint 3

Post API/GitHub Direct/web intake SHA, shared-file union outputs, schema/route/workflow inventories and tests.

## Stage 3 — combined release candidate

23. Run full direct-Node repository tests permitted without dependency installation.
24. Run syntax, JSON, YAML, changed-path, source/blob provenance, overlap, public-export/schema/version and whitespace gates.
25. Run identity/lifecycle/storage/report/API/auth/GitHub Direct/UI integration scenarios.
26. Run hostile-object, mutation, cross-tenant, stale-CAS, replay, cancellation, quota/retention, redaction and resource-limit matrices.
27. Run workflow static/security, action pin, permission and target-as-data checks.
28. Scan source, fixtures, docs and test output for secret values or credential-shaped leakage.
29. Publish one exact assembled candidate SHA on issue #119 and freeze it.
30. Produce complete release, provenance, compatibility, secret-name/binding, rollback, observability and Round 5 live-test manifests.

### Checkpoint 4 — frozen assembled candidate

Post exact SHA, every intake source, all paths/blobs/unions, combined gates, total tests/scenarios/mutations, residual risks and specialist rerun commands.

## Stage 4 — specialist acceptance reconciliation

31. Collect Worker 0, 1, 3 and 4 acceptances against the same exact SHA.
32. Reject stale acceptances or reports against any other SHA.
33. For each rejection, require observed RED and apply only the minimum proven repair.
34. Publish a new SHA after repair and invalidate/rerun affected acceptances.
35. After unanimous exact-SHA acceptance, publish the final release manifest and Round 5 handoff.
36. Prepare release-branch/PR instructions, but do not merge to `main` without orchestrator verification.

### Checkpoint 5 — Round 4 completion

Post final exact candidate SHA, all specialist report IDs, final tests/gates, production assumptions, rollback/observability plan, Round 5 inputs and `ACCEPT` or `REJECT`.

## Restrictions

No secret values, live production deployment, unrestricted credentials, submitted-project execution, live wallet/signing/transactions, direct `main` merge or unreviewed broad branch merge. Do not integrate a subsystem before its Stage A exact head is accepted.

## Completion

Post startup/checkpoints/final reports only to issue #122 and master assembled-candidate announcements to issue #119. Commit only to `audit-round4/full-platform-integration-v1`. Record exact SHAs/report IDs in status.
