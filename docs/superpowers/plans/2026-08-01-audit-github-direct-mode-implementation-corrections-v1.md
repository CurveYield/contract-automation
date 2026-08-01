# Audit GitHub Direct Mode Implementation Plan — Normative Corrections v1

This file is normative for `docs/superpowers/plans/2026-08-01-audit-github-direct-mode-implementation.md` and resolves the two symbolic values found during post-commit self-review. All other tasks, paths, interfaces, tests, constraints, dependency order, and completion gates in the detailed implementation plan remain unchanged.

## Correction 1 — exact source-acceptance review path

In Task 11, the review file path is exactly:

```text
docs/audit/reviews/audit-github-direct-v1-source-acceptance_v1.md
```

Do not substitute a date placeholder or create multiple source-acceptance filenames for the same v1 integration.

## Correction 2 — deterministic accepted Phase 8 base resolution

Before Task 11 source acceptance, the integration branch must have `origin/audit-phase8/integration-v1` as an ancestor and must record that exact remote ref in its immutable assignment and implementation issue.

Use these exact commands:

```bash
git fetch origin audit-phase8/integration-v1 --no-tags
PHASE8_SHA="$(git rev-parse refs/remotes/origin/audit-phase8/integration-v1)"
MERGE_BASE_SHA="$(git merge-base HEAD "$PHASE8_SHA")"
test "$MERGE_BASE_SHA" = "$PHASE8_SHA"
git diff --name-only "$PHASE8_SHA"...HEAD
```

If the ancestor assertion fails, stop and report `invalid_integration_base`; do not infer another base, rebase automatically, or continue source acceptance.

The durable source-acceptance report must record `PHASE8_SHA` and the final integration SHA as exact 40-character values.

## Correction 3 — implementation-plan acceptance

The implementation plan is accepted only as the pair:

```text
docs/superpowers/plans/2026-08-01-audit-github-direct-mode-implementation.md
docs/superpowers/plans/2026-08-01-audit-github-direct-mode-implementation-corrections-v1.md
```

Implementers must read both files before creating an implementation issue or branch.
