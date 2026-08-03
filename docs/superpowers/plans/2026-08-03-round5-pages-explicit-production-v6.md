# Round 5 Explicit Pages Production Deployment V6 Plan

## Goal

Deploy the accepted static UI to the configured Cloudflare Pages production branch without detached-HEAD inference, then verify the production custom domain.

## Constraints

- Exact parent: `669591985d27a7c9e7a3dee8be1ff1ab8821d2e2`.
- Application source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`.
- Active networks: Ethereum and Base only.
- Historical runs `30808377849`, `30813209037`, and `30814064657` must not be rerun.
- No dependency installation, repository compilation, Worker deployment, secret mutation, R2 mutation, job/upload submission, RPC call, signing, or broadcasting.

## Tasks

1. Add a focused test requiring an exact-parent v6 request and production-branch-bound workflow.
2. Record natural RED evidence while the request/workflow are absent.
3. Add the immutable request and Pages-only workflow.
4. Verify exact-head CI and five-file scope.
5. Merge only the exact verified head.
6. Inspect the live deployment steps and issue #125 report.
7. On success, create a separate read-only production acceptance v3; on failure, preserve evidence and diagnose without rerunning.
