# Phase 10 — Current-Stack Production Hardening v2

## Scope

This phase production-hardens the Cloudflare/GitHub control plane, not the deferred hardened executor.

## Required controls

- separate Audit domains, Worker, Pages project, R2 bucket, workflows, secrets, and feature flag;
- least-privilege Cloudflare token scoped to Audit resources;
- one GitHub App master key scoped to approved repositories;
- R2 conditional state writes and immutable manifests;
- lifecycle rules by prefix;
- budget alerts and monthly R2 operation/storage review;
- tenant limits for source, layers, jobs, logs, artifacts, evidence, reports, and checkpoints;
- incident switch that disables submissions while preserving read-only evidence;
- key rotation and GitHub App token revocation drills;
- report/log injection defenses;
- Lite boundary regression and Audit-removal rollback drill.

## Launch gate

The UI and API may be deployed with submitted execution disabled. The product MUST NOT claim complete hostile-code audit execution until the separate hardened compute project passes the interface and adversarial tests in document 15.
