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
| 9 | Audit web UI, reports, GitHub App integration, GPT/API surfaces | Full with fixture results |
| 10 | Current-stack production hardening, R2 quotas/lifecycle, incident controls, feature gate, external-compute readiness | Full for control plane; Full Audit launch remains gated |

## Phase gate rule

No phase may claim hostile submitted-project execution. The final feature flag remains off until the external hardened-compute project passes all required sandbox, egress, credential, cancellation, resource, and cross-workspace tests.
