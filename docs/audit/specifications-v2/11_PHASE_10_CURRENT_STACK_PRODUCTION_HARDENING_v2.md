# Phase 10 — Current-Stack Production Hardening v2

## Scope

This phase independently production-hardens both current-stack control planes:

- `cloudflare-audit-v1` — Cloudflare Worker/Pages and R2;
- `github-direct-audit-v1` — GitHub App, GitHub Actions, control-branch ledger, CLI, Checks/comments, and bounded artifacts.

It does not production-harden or authorize the deferred hostile-code executor.

## Cloudflare mode controls

- separate Audit domains, Worker, Pages project, R2 bucket, workflows, secrets, and feature flag;
- least-privilege Cloudflare token scoped to Audit resources;
- R2 conditional state writes and immutable manifests;
- lifecycle rules by prefix;
- budget alerts and monthly R2 operation/storage review;
- tenant limits for source, layers, jobs, logs, artifacts, evidence, reports, and checkpoints;
- incident switch that disables submissions while preserving read-only evidence;
- report/log injection defenses;
- Cloudflare-mode rollback and Audit-removal drill.

## GitHub Direct mode controls

- a separate direct-mode feature gate and staged repository/installation allowlist;
- `audit-direct/control-v1` branch protection, restricted writers, required review, and deterministic recovery procedure;
- least-privilege GitHub App permission audit by operation;
- use of per-run `GITHUB_TOKEN` where sufficient and short-lived installation tokens only where required;
- App private-key rotation, installation-token revocation, and compromised-installation drills;
- immutable SHA pinning for third-party Actions;
- workflow permission manifests, bounded concurrency, timeouts, cancellation, retry, and idempotency controls;
- request, event, Check, comment, report, and artifact publication deduplication;
- API rate-limit budgets and abuse limits;
- artifact size, retention, expiration, and deletion controls;
- control-branch index backup, reconstruction, and disaster-recovery tests;
- untrusted-fork and `pull_request_target` security tests;
- report/log/comment escaping and content caps;
- incident switch that rejects new direct jobs while preserving read-only manifests and reports;
- direct-mode rollback/removal drill proving Cloudflare Audit remains operational and unchanged.

## Shared controls

- one dedicated Audit GitHub App master key scoped only to approved repositories;
- exact source commit identity for every admitted job;
- explicit mode selection and mode-bearing capability/report records;
- no automatic cross-mode fallback or shared mutable current state;
- cross-mode schema rejection and storage/index isolation tests;
- key and token redaction in all public errors and artifacts;
- Lite boundary regression tests;
- hardened-compute adapter signature, replay, cancellation, and capability checks while the executor remains disabled.

## Launch gates

The Cloudflare UI/API and GitHub Direct control plane may be enabled independently with submitted execution disabled.

GitHub Direct production enablement additionally requires:

- all Cloudflare credentials absent from its runtime test environment;
- static and runtime proof that direct-mode production paths do not import or invoke Cloudflare/R2 modules;
- branch protection and App permissions verified against the approved manifest;
- action dependencies pinned to immutable commits;
- rate-limit, retention, cancellation, incident, and recovery drills completed;
- explicit repository allowlisting.

The product MUST NOT claim complete hostile-code audit execution until the separate hardened compute project passes the interface and adversarial tests in document 15. GitHub Actions and Cloudflare Workers remain coordination/control-plane infrastructure only.
