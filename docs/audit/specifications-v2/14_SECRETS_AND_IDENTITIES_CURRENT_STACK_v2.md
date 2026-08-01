# Secrets and Identities — Current Stack v2

## Operating-mode rule

Secrets and identities are admitted only by the selected operating mode. `cloudflare-audit-v1` and `github-direct-audit-v1` do not automatically exchange credentials, route failures to one another, or share mutable authentication state.

## Cloudflare values

Instructions for obtaining Cloudflare values are intentionally omitted. Required names and specifications:

```text
AUDIT_CLOUDFLARE_API_TOKEN
AUDIT_CLOUDFLARE_ACCOUNT_ID
AUDIT_R2_ACCESS_KEY_ID
AUDIT_R2_SECRET_ACCESS_KEY
AUDIT_EDGE_CONTROL_PLANE_TOKEN
AUDIT_CLIENT_API_KEY
AUDIT_GPT_API_KEY
AUDIT_ATTESTATION_PRIVATE_KEY
```

Specifications:

- Cloudflare token: Audit Worker/Pages/R2/DNS deployment permissions only; no Lite resources when separate-account/resource scoping is available.
- R2 key pair: one Audit bucket, read/write objects, no unrelated bucket access.
- edge/control token: at least 32 random bytes, independent from client keys.
- client/GPT keys: separate revocable 32-byte random values.
- attestation key: Ed25519 private key in PKCS#8 or another explicitly versioned WebCrypto-compatible format; current-stack attestations are preproduction/service attestations, not a substitute for a future isolated production signer.

These values belong only to Cloudflare mode. GitHub Direct schemas, clients, workflows, packages, tests, reports, and artifacts must reject or ignore none of them silently: their presence as request fields is an error, and their absence must not prevent GitHub Direct operation.

## Dedicated GitHub App identity

```text
AUDIT_GITHUB_MASTER_KEY
```

This is the private key of one dedicated CurveYield Audit GitHub App. Non-secret approved identity variables include:

```text
AUDIT_GITHUB_APP_ID
AUDIT_GITHUB_INSTALLATION_ID
AUDIT_GITHUB_REPOSITORY=CurveYield/contract-automation
```

Production implementations may represent approved installations and repositories as an explicit allowlist rather than one hard-coded installation. The App is installed only on approved repositories and receives the combined repository permissions needed for contents, pull requests, issues, checks/statuses, Actions dispatch/status, metadata, and approved package/profile publication. Organization administration, billing, members, secrets administration, environments administration, and unrelated repositories remain excluded.

## GitHub Actions authentication

GitHub Actions uses its automatic per-run `GITHUB_TOKEN` whenever the workflow's explicitly declared permissions are sufficient. `AUDIT_GITHUB_MASTER_KEY` is used only by an approved protected minting boundary when a short-lived installation token is required for an operation that `GITHUB_TOKEN` cannot perform.

Installation tokens must be restricted to:

- the exact approved installation;
- the exact repository or approved repository subset;
- the minimum operation-specific permissions;
- a bounded lifetime.

The App private key must never be:

- a workflow input or dispatch field;
- a repository variable;
- committed to Git;
- exposed to an untrusted pull-request job;
- written to a request/event/status/result/report manifest;
- printed to logs, Checks, statuses, comments, or artifacts;
- delivered to browser code.

A workflow triggered by untrusted pull-request code must not receive installation-key access. `pull_request_target` must not check out or execute untrusted pull-request code.

## GitHub Direct local-client identity

The optional `audit-direct` CLI should use GitHub App user authorization through device flow or an equivalent short-lived user authorization flow. The CLI must not accept App private-key material through ordinary command-line arguments, configuration committed to a repository, or environment diagnostics.

A trusted local administrative daemon may use the App private key only as an optional separately protected deployment; it is not required for normal direct-mode use.

## Browser identity boundary

No Audit browser surface receives:

- the App private key;
- an installation token;
- an R2 access key;
- a Cloudflare deployment token;
- an attestation private key.

Browser clients receive only mode-appropriate bounded session/API credentials or user-authorization results that cannot mint App installation tokens independently.

## Explicitly absent

No AWS, external database, external queue, external object-store, external registry, external key-manager, or external compute-provider secret is required by this current-stack specification. Those belong to the separately designed hardened compute project.

GitHub Direct additionally requires no Cloudflare credential, R2 key, Cloudflare route, Cloudflare account ID, or Cloudflare availability.
