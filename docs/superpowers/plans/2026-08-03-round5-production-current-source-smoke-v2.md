# Round 5 Production Current-Source Smoke V2 Plan

1. Verify the live release branch remains exactly `2c6e543dfcaa17ca975bbde3c15302269bbf8072` and deployment v4 run/job remain successful.
2. Commit only the focused requirement test and design/plan documentation.
3. Open a draft PR against `orchestrator/round4-ci-base-v1` and capture natural RED CI caused only by the absent v2 request/workflow.
4. Add `.agent-control/v1/orchestrator/PRODUCTION_ACCEPTANCE_REQUEST_v2.json` with the exact parent, deployment run/job, bounded check list, and safety prohibitions.
5. Add `.github/workflows/production-acceptance-v2.yml` using a one-time path trigger, exact `github.event.before` check, production environment, full-SHA checkout pin, read-only checks, and sanitized issue #125 reporting.
6. Capture fresh exact-head GREEN CI without rerunning failed checks.
7. Verify exact changed paths, comments, reviews, review threads, head SHA, and mergeability.
8. Merge only the verified exact head.
9. Inspect the live run, job, and every step; record accepted or rejected evidence durably.
10. Update issue #125 and the control-plane snapshot/ledger without overwriting historical evidence.
