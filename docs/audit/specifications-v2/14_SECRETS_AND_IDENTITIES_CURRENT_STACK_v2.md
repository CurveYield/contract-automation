# Secrets and Identities — Current Stack v2

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

## GitHub identity

```text
AUDIT_GITHUB_MASTER_KEY
```

This is the private key of one dedicated CurveYield Audit GitHub App. Non-secret repository variables:

```text
AUDIT_GITHUB_APP_ID
AUDIT_GITHUB_INSTALLATION_ID
AUDIT_GITHUB_REPOSITORY=CurveYield/contract-automation
```

The App is installed only on approved repositories and receives the combined repository permissions needed for contents, pull requests, issues, checks/statuses, Actions dispatch/status, deployments, metadata, and package/profile publication. Organization administration, billing, members, and unrelated repositories remain excluded.

GitHub Actions continues using its automatic per-run `GITHUB_TOKEN` when sufficient. The master key is used only to mint short-lived installation tokens when the automatic token cannot perform the required approved operation.

## Explicitly absent

No AWS, external database, external queue, external object-store, external registry, external key-manager, or external compute-provider secret is required by this current-stack specification. Those belong to the separately designed hardened compute project.
