# PR #126 Security Reconciliation Design

## Status

Approved by the repository owner on 2026-08-02.

## Context

PR #126 was merged into `main` as commit `500de7b8752e926f7478feafb81b92586d6364ea`. Its functional evidence is strong and independently verified: the final PR head is `df2e51824d257669dac204de5bf869c80ed6e844`, GitHub Actions run `30745082610` completed successfully, and artifact `v27-full-live-fork-30745082610` has digest `sha256:ec4e17b10a45af7df6b62ab77b2be82058c21d11b4c914ae928b63fe9502ebbd`.

Independent reconciliation found four release-blocking trust defects:

1. pull-request workflows execute PR-controlled repository code while live RPC secrets or `issues: write` authority are present;
2. changed workflows reference third-party actions by mutable major tags;
3. the public issue-backed RPC-health ledger accepts unauthenticated comment events and unsafe slot identifiers, including prototype-polluting keys;
4. upstream RPC provider text is reflected into local JSON-RPC errors.

## Goal

Preserve PR #126's simulation behavior while making workflow execution, persistent health state, and RPC error surfaces fail closed at their trust boundaries.

## Architecture

### Workflow trust separation

Pull-request jobs are static and secretless. They may check out the PR merge commit, install dependencies with scripts disabled, run tests, lint, build, and syntax checks, but receive no live RPC secrets and no write permissions.

Live fork jobs run only from trusted events:

- `workflow_dispatch`; or
- `push` to `main`.

Every live workflow checks out an explicit trusted SHA from the triggering repository. No `pull_request_target` workflow is introduced. Third-party actions are pinned to exact full commit SHAs:

- `actions/checkout` -> `11d5960a326750d5838078e36cf38b85af677262`;
- `actions/setup-node` -> `49933ea5288caeca8642d1e84afbd3f7d6820020`;
- `actions/upload-artifact` -> `ea165f8d65b6e75b540449e92b4886f43607fa02`.

### RPC-health ledger authority

The reducer accepts only canonical event objects with exact keys, bounded values, exact slot IDs, and a null-prototype state map. Valid slot IDs are `primary-01` through `primary-07`, `secondary-01` through `secondary-03`, and `legacy-01`.

The GitHub issue store accepts ledger comments only when all of these are true:

- the comment author is `github-actions[bot]` for session events;
- the event `runId` is a decimal GitHub Actions run ID;
- recovery events are never loaded from arbitrary issue comments;
- administrative recovery is appended only by the authenticated store method and records the current authenticated actor supplied by trusted configuration;
- malformed or unauthorized comments are ignored, never reduced.

The public repository may remain public because arbitrary commenters cannot create accepted ledger events.

### RPC error normalization

Provider messages are used only for internal classification. Public errors expose stable text and bounded metadata:

- message: `Archive RPC request failed`;
- code: `ARCHIVE_RPC_UNAVAILABLE`;
- failure class from a fixed allowlist;
- method only when it passes the JSON-RPC method-name grammar.

No upstream URL, provider body, token, header, path, or exception message is returned by `archive-rpc-pool.mjs` or `live-fork-proxy.mjs`.

### Integration evidence

The repair branch remains a descendant of merge commit `500de7b8…`. Final evidence records:

- exact changed paths and blobs;
- RED and GREEN commands/results;
- action-pin provenance;
- workflow trigger/permission matrix;
- ledger attack corpus;
- RPC error-redaction corpus;
- full repository tests, lint, build, syntax gates, and live-fork acceptance results when trusted secrets are available.

## Compatibility

No simulation job schema, RPC routing policy, fork engine behavior, V27 lifecycle logic, artifact schema, or public contract version changes. The health ledger format remains `rpc-health-event/v1`; validation becomes stricter. Existing bot-authored valid session comments remain readable.

## Failure behavior

- A pull request cannot receive live RPC secrets or issue-write authority.
- An unauthorized or malformed issue comment is ignored.
- An invalid locally generated event throws before persistence.
- A hostile slot ID cannot mutate object prototypes.
- Provider failures return a stable redacted JSON-RPC error.
- Any unpinned third-party action fails the workflow trust test.

## Testing

Tests are written before each production change and observed failing on commit `500de7b8…`:

1. workflow static trust test;
2. ledger schema/prototype and issue-comment authority tests;
3. archive router and live proxy redaction tests;
4. full repository and syntax regression gates.

## Scope exclusions

No deployment, secret-value modification, public-chain broadcast, wallet operation, unrelated refactor, direct `main` edit, or traditional merge into Worker 2's integration branch.