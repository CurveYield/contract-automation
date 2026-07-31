# Phase 1 — Boundary Lock and Audit Scaffold v2

## Deliverables

- `apps/audit-api` with `/audit/v1/health` and protected route skeleton.
- `apps/audit-web` with a visibly separate Audit surface.
- `packages/audit-protocol` for IDs, scopes, errors, schemas, and forbidden-field scanning.
- `packages/audit-r2-store` interface with in-memory test implementation.
- separate `audit-test.yml` and Audit deployment dry-run workflow.
- static import and secret-name boundary tests.
- root scripts `audit:test`, `audit:lint`, and `audit:build`.

## Required tests

- Lite secrets fail against Audit and Audit secrets fail against Lite.
- Audit route fields are rejected by Lite.
- shell, command, script, Dockerfile, image, URL, RPC, wallet, signing, private-key, signed-transaction, and broadcast fields are recursively rejected.
- no Audit module imports `packages/runner`.
- no Audit workflow references `simulate.yml` or Lite concurrency groups.
- deleting Audit paths leaves Lite tests/build definitions unchanged.
- no R2 or external secret is required for unit and dry-run CI.

## R2 usage

Phase 1 unit tests use an in-memory R2 adapter. Deployment dry runs do not consume R2 operations. A real health endpoint consumes no R2 operation.
