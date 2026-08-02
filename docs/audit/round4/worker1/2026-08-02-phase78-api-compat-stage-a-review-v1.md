# Worker 1 Round 4 Phase 7–8/API Compatibility Stage A Review v1

## Verdict

**ACCEPT WITH REPAIR — Stage A only**

- Issue: `#121`
- Sequence: `5`
- Starting SHA: `4d7513b7eabd2e2217b1e3fed43d999df828a93f`
- Reviewed code snapshot: `e26b78c2c26f3c11897e8fea397c8615fc66a5a0`
- Takeover branch: `orchestrator/worker1-round4-takeover-v1`
- Original runtime branch: `audit-round4/review-phase78-api-compat-v1` (read-only inherited evidence)
- Stage B: waiting for Worker 2 to freeze one assembled SHA on issue #119

## Takeover and provenance

The account owner declared Worker 1 nonfunctional and directed the orchestrator to assume its workload. The original runtime continued committing after the takeover notice, so its newest observed head was frozen and copied to the isolated takeover branch. No further work was performed on the original branch.

Checkpoint 1 already supplied a 10-test behavioral RED baseline. The inherited repair chain corrected all ten seams and added specialist service, publication, report, multi-tenant E2E, and static-boundary suites. The orchestrator independently reviewed the diff and reran the six suites together.

## Repairs accepted

1. Versioned v2 service request/response/error contracts bind immutable attempt identity for fork operations while preserving legacy v1 compatibility.
2. Request-bound response and error validators reject validly re-digested cross-scope substitutions.
3. Authorization collapses absent, cross-tenant, and cross-attempt fork resources to one hidden decision without invoking hostile accessors.
4. Fork checkpoint/export/restore/delete orchestration exposes repaired lifecycle and failure boundaries with bounded operation summaries.
5. Cursor and cache contracts bind exact tenant/workspace/campaign/fork/attempt/merge/index/view scope; v2 pages omit totals.
6. Provider/internal errors normalize to bounded public code/message/path values without reading attacker-controlled accessors.
7. Fork, checkpoint, export, deletion, campaign, merge, relation, and provenance reports validate authoritative upstream contracts before projection.
8. Hidden relation/provenance/report outputs remove hidden existence, count, digest, and timing signals represented in the public object.
9. Publication keys bind exact resource scope; immutable records use create-only preconditions; mutable pointers use exact CAS.
10. Typed recovery rejects conflicting evidence and pointer-before-index completion, with bounded pointer-last convergence.

## Independent verification

Fresh combined command:

```text
node --test test/audit-round4-worker1-source-review-red-v1.test.mjs test/audit-round4-worker1-service-compat-v1.test.mjs test/audit-round4-worker1-publication-replay-v1.test.mjs test/audit-round4-worker1-report-compat-v1.test.mjs test/audit-round4-worker1-phase78-e2e-v1.test.mjs test/audit-round4-worker1-static-boundary-v1.test.mjs
```

Result:

```text
tests 108
pass 108
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 283.344326
```

The local runtime lacked bulk repository checkout/network access. Worker 1-owned production/tests were mirrored from the GitHub snapshot, while some unchanged upstream dependencies were reconstructed to their exercised public behavior. This result is therefore behavioral verification, not a full byte-for-byte repository test. Exact-byte provenance is separately established by GitHub blob inspection and the 27-path manifest. No dependency installation or compilation occurred.

## Scope and protected boundaries

Changed Stage A inventory at the code snapshot:

- 17 production paths
- 6 test paths
- 2 fixtures
- 2 existing review documents
- 27 total paths

No change was made to:

- Worker 1 Round 3 API/GPT/auth production
- `.github/workflows/**`
- GitHub-native simulation/addon protected paths
- shared runner RPC policy or guard paths
- PR #126 live-RPC/simulation work
- other worker branches/statuses
- `main`

## Residual risks and production prerequisites

- Stage B has not verified any assembled candidate.
- Full repository tests, dependency-backed tests, live Cloudflare/R2/GitHub/RPC tests, and production deployment remain outside Stage A.
- Worker 2 must intake exact paths/blobs, run combined repository gates, and freeze one SHA.
- Worker 1 Stage B acceptance must rerun API/GPT route, identity separation, hidden-resource, pagination/cache, error redaction, report discovery, Cloudflare portability, and protected-blob checks against that exact SHA.
- PR #126 must remain quarantined until independently declared complete and reconciled.

## Required Worker 2 action

Follow `2026-08-02-phase78-worker2-intake-v1.md` and the exact path/blob manifest. Traditional branch merge is forbidden. A blob mismatch or unmanifested overlap blocks intake.
