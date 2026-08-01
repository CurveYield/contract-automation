# CurveYield Audit Current-Stack Specifications v2

## Governing decision

This version supersedes the prior deployment architecture wherever the earlier package assumed a managed database, external queue, external object store, external key manager, or a selected VM cloud. The implementation scope is limited to the software already used by `CurveYield/contract-automation`:

- GitHub repository and GitHub Actions.
- One CurveYield Audit GitHub App identity.
- Cloudflare Pages.
- Cloudflare Workers.
- Cloudflare R2 Standard storage.
- Existing browser, local CLI, ChatGPT GitHub connector, and API integration patterns.

AWS and every other unselected infrastructure provider are outside scope. A hardened execution provider is a separate future project.

## Explicit operating modes

The Audit suite has two independently selected current-stack operating modes:

1. `cloudflare-audit-v1`
   - the existing Cloudflare Worker/API and Pages surface;
   - R2-backed durable state, evidence, reports, and checkpoints;
   - unchanged by the addition of GitHub Direct.

2. `github-direct-audit-v1`
   - direct coordination through the dedicated Audit GitHub App and GitHub Actions;
   - GitHub-native control-branch manifests, Checks/statuses, issue/PR reporting, workflow metadata, and bounded artifacts;
   - no Cloudflare Worker, Pages, R2, Cloudflare credential, route, account, or availability dependency.

A request selects exactly one mode before admission. Neither mode may transparently replace, proxy, fail over to, or automatically invoke the other. Shared profile, parser, result, evidence, and report contracts remain transport-neutral pure dependencies.

## What v2 delivers

The current stack can fully deliver:

- a separate Audit web/API namespace and credential boundary;
- an isolated GitHub Direct repository-native coordination mode;
- immutable source workspaces and generated layers;
- signed profile metadata and tool allowlists;
- campaign, job, attempt, status, cancellation, resume, and evidence schemas;
- durable R2-backed logs, artifacts, evidence, reports, and fork checkpoints for Cloudflare mode;
- durable GitHub control manifests and bounded GitHub Actions artifacts for GitHub Direct mode;
- clean-room visibility and controlled merge logic;
- normalized parsers for compile, test, fuzz, invariant, static, coverage, mutation, dependency, symbolic, and formal results;
- GitHub App, browser, local CLI, and API integrations;
- deployment, rollback, quota, lifecycle, retention, permission, and incident controls.

## Execution restriction

The system MUST remain `executionDisabled=true` for submitted Audit projects until a separately developed hardened compute plane passes the external interface and adversarial acceptance suite. Cloudflare Workers, browser code, local clients, and GitHub-hosted Actions MUST NOT execute uploaded project scripts, tests, plugins, package lifecycle hooks, arbitrary commands, or hostile tool workloads.

Trusted repository tests may execute safe fixtures and CurveYield-owned adapter/parser code. That does not authorize submitted user code. GitHub Actions is coordination infrastructure and is not the claimed hostile-code sandbox.

## R2 pricing baseline

The capacity calculations use Cloudflare R2 Standard pricing published May 28, 2026:

- 10 GB-month storage included monthly.
- 1,000,000 Class A operations included monthly.
- 10,000,000 Class B operations included monthly.
- R2 egress is free.
- The free tier does not apply to Infrequent Access storage.

Pricing source: `https://developers.cloudflare.com/r2/pricing/`.

These R2 calculations apply only to `cloudflare-audit-v1`. GitHub Direct quota, Actions, artifact-retention, and repository-limit controls are specified separately and must never be represented as R2 capacity.

## Files

Read `01` through `17` in order. The exact per-function R2 calculations are in `18_R2_FUNCTION_USAGE_TABLE_v2.csv`, with assumptions in `19_R2_USAGE_ASSUMPTIONS_v2.json` and aggregate scenarios in `20_R2_AGGREGATE_SCENARIOS_v2.csv`. The isolated GitHub Direct operating-mode contract is in `21_GITHUB_DIRECT_MODE_v1.md`.
