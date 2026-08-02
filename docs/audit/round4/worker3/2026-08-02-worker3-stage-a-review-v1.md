# Worker 3 Round 4 API/Auth Security Stage A Review v1

## Verdict

**ACCEPT WITH REPAIR — Stage A only**

- Issue: `#123`
- Sequence: `8`
- Starting SHA: `6d877e2d87f1a91380a6c5d1efc47550527d8729`
- Reviewed/repaired code snapshot: `a70e6d762530bf0ce8c7dfd467c8b1278b6dd43d`
- Takeover branch: `orchestrator/worker3-round4-takeover-v1`
- Original Worker 3 branch: untouched and byte-identical to the starting SHA
- Stage B: waiting for issue #119 to freeze one assembled SHA

## Takeover provenance

Worker 3 never acknowledged or started its Round 4 assignment. The orchestrator verified the assigned branch had zero commits and created an isolated takeover branch from the exact starting SHA. No Worker 3 Round 3 GitHub Direct production, workflow, simulation/RPC add-on, PR #126 path, other worker branch, or `main` path was modified.

## Observed defect

`apps/audit-api/src/phase9-reports.mjs` recursively validated every provider row before applying tenant/workspace visibility filtering. Consequently, a hidden cross-tenant row containing an accessor, cycle, or oversized value could change an authorized tenant's otherwise empty `200` response to a `500 provider_contract_error`. That created hidden-resource non-interference drift in status, body and cache metadata.

## Test-first repair

The five-case Round 4 test was committed before production repair. Against the original behavior:

```text
tests 5
pass 3
fail 2
```

Only hidden accessor/cycle/oversize non-interference cases failed. Visible malformed rows and conflicting duplicate identities already failed closed.

The minimal repair:

- inspects provider arrays/page wrappers through own data descriptors;
- rejects sparse arrays, symbols, accessors, custom prototypes and malformed wrapper fields;
- reads only bounded `tenantId` and `workspaceId` data properties first;
- discards cross-scope rows before recursive validation;
- fully validates visible rows using the authoritative public validator;
- preserves canonical ordering, exact duplicate deduplication and conflicting duplicate rejection.

Fresh verification:

```text
node --check apps/audit-api/src/phase9-reports.mjs
node --check apps/audit-api/test/round4-hidden-provider-noninterference-v1.test.mjs
node --test apps/audit-api/test/round4-hidden-provider-noninterference-v1.test.mjs
```

Result:

```text
tests 5
pass 5
fail 0
cancelled 0
skipped 0
```

The committed production blob and locally verified blob both equal `4b2a68acc80c22d333ff03e2a4c80b64397ce8a6`.

## External trust review

Exact source inspection confirmed the inherited release already provides:

- exact bounded Bearer parsing;
- duplicate configured credential failure;
- centralized route-specific scopes and resource bindings;
- service grant expiry/revocation and tenant/workspace binding;
- server-owned provider arguments;
- checksummed scope/kind-bound cursors;
- tenant/workspace/route/query/body-bound private ETags;
- bounded recursive external-value validation and public error normalization;
- read-only GPT/report routes using Web APIs rather than Node/process/network authority.

## Changed inventory

Only two paths changed:

1. `apps/audit-api/src/phase9-reports.mjs`
2. `apps/audit-api/test/round4-hidden-provider-noninterference-v1.test.mjs`

The exact blobs are recorded in the path/blob manifest. Traditional branch merge is forbidden.

## Residual risks and required integration work

- This runtime did not run the full repository suite or dependency-backed Cloudflare tests.
- The focused run used the exact repaired production blob with test-only dependency stubs; exact-byte identity is separately proven by GitHub blob equality.
- Worker 2 must rerun all existing Round 3 API/auth/report suites after exact intake.
- Provider `snapshotVersion` is validated but not included in cursor identity; assembled snapshot-drift behavior must be tested.
- A row whose tenant/workspace identity itself is malformed remains a provider-contract failure because visibility cannot be safely determined.
- Stage B must verify the complete API/GitHub trust separation against the frozen assembled SHA.

## Worker 2 disposition

Use `2026-08-02-worker3-worker2-intake-v1.md` and the exact path/blob manifest. A blob mismatch, unmanifested adaptation, protected-path overlap, or failed combined API/auth gate blocks assembly.
