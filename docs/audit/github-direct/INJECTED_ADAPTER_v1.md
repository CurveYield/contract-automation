# GitHub Direct Injected Adapter v1

## No embedded client

The adapter does not instantiate a GitHub client and does not perform network calls by itself. A trusted caller injects a transport with an exact closed method set. The adapter validates that shape without invoking accessors and rejects hostile reflection.

## Identity binding

Every operation is bound before dispatch to:

- repository ID;
- installation ID;
- canonical repository full name;
- exact target commit SHA.

Substitution fails before the injected transport is called.

## Least-privilege mapping

| Capability | Permission |
|---|---|
| `read-source` | `contents: read` |
| `write-control-ledger` | `contents: write` |
| `publish-check` | `checks: write` |
| `publish-comment` | `issues-comments: write` |
| `publish-status` | `statuses: write` |
| `read-artifact-metadata` | `actions-artifact-metadata: read` |

No admin, secret, workflow, deployment, or Actions-execution permission is produced.

## Publication reconciliation

Check, issue-comment, and commit-status plans are exact-SHA bound, bounded, deterministic, and assigned stable idempotency keys.

- missing prior publication: create;
- byte-identical prior publication: no-op;
- changed prior publication in the same idempotency slot: `publication_conflict`.

## Redacted errors and artifacts

Transport errors normalize to a fixed bounded schema. Raw messages, headers, bodies, URLs, tokens, and host paths are not retained. Artifact access is metadata-only: identifier, name, size, digest, expiry state, and timestamps. Artifact bytes and download URLs are outside the package.
