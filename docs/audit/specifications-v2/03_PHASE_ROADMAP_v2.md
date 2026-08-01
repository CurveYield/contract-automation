# Development Phase Roadmap v2

| Phase | Current-stack deliverable | Completion status possible without external compute |
|---|---|---|
| 1 | Boundary lock, sibling Audit packages, authentication scopes, CI and deployment dry runs | Full |
| 2 | R2 immutable workspaces, source/layer manifests, profile registry | Full |
| 3 | R2 campaigns, jobs, attempts, lifecycle, logs, artifacts, evidence and cancellation/resume state | Full |
| 4 | Compile/Foundry/Slither/coverage profile contracts, parsers, safe fixture tests, executor adapter interface | Code complete; submitted execution disabled |
| 5 | Hardhat/Echidna/mutation/dependency profile contracts and parsers | Code complete; submitted execution disabled |
| 6 | SMT/symbolic/formal profile contracts, obligation and counterexample schemas | Code complete; submitted execution disabled |
| 7 | Persistent-fork API, checkpoint storage, action schemas, reference mock adapter | Control/storage complete; active fork compute deferred |
| 8 | Clean-room campaign ACL, hidden-resource tests, controlled merge and provenance | Full |
| 9 | Audit web UI, reports, Cloudflare GitHub integration, separate GitHub Direct protocol/ledger/adapter/workflow/CLI surfaces, GPT/API surfaces | Full with trusted fixture results; submitted execution disabled |
| 10 | Independent Cloudflare and GitHub Direct production hardening, quotas/lifecycle/retention, permission and branch controls, incident controls, feature gates, external-compute readiness | Full for both control planes; Full Audit launch remains gated |

## Phase 9 GitHub Direct deliverables

Phase 9 includes the isolated `github-direct-audit-v1` operating mode:

- versioned request, event, state, capability, result-index, and report-index contracts;
- a dedicated `audit-direct/control-v1` repository ledger with immutable records and compare-and-swap pointers;
- a least-privilege GitHub App adapter;
- a bounded GitHub Actions coordination workflow;
- GitHub Checks/statuses, issue/PR summaries, and artifact metadata publication;
- an optional local CLI using short-lived user authorization;
- explicit mode selection and no automatic Cloudflare fallback;
- trusted repository-owned fixture operation only while submitted execution remains disabled.

GitHub Direct does not modify or replace the Cloudflare Worker/R2 operating mode.

## Phase 10 GitHub Direct hardening

Phase 10 adds:

- repository and installation allowlists;
- control-branch protection and required-review rules;
- exact workflow permission manifests;
- immutable action dependency pinning;
- rate-limit, quota, concurrency, timeout, artifact-size, and retention controls;
- token rotation, revocation, and incident drills;
- audit-log review and deterministic ledger-index recovery;
- staged repository enablement and a separate direct-mode feature gate;
- cross-mode rollback and removal tests proving Cloudflare Audit remains operational when GitHub Direct is disabled or removed.

## Phase gate rule

No phase may claim hostile submitted-project execution. The final feature flag remains off until the external hardened-compute project passes all required sandbox, egress, credential, cancellation, resource, and cross-workspace tests. GitHub Actions and Cloudflare Workers are coordination/control-plane infrastructure, not the hostile-code execution sandbox.
