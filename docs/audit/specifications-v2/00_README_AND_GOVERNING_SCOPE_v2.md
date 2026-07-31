# CurveYield Audit Current-Stack Specifications v2

## Governing decision

This version supersedes the prior deployment architecture wherever the earlier package assumed a managed database, external queue, external object store, external key manager, or a selected VM cloud. The implementation scope is limited to the software already used by `CurveYield/contract-automation`:

- GitHub repository and GitHub Actions.
- One CurveYield Audit GitHub App identity.
- Cloudflare Pages.
- Cloudflare Workers.
- Cloudflare R2 Standard storage.
- Existing browser and API integration patterns.

AWS and every other unselected infrastructure provider are outside scope. A hardened execution provider is a separate future project.

## What v2 delivers

The current stack can fully deliver:

- a separate Audit web/API namespace and credential boundary;
- immutable source workspaces and generated layers;
- signed profile metadata and tool allowlists;
- campaign, job, attempt, status, cancellation, resume, and evidence schemas;
- durable R2-backed logs, artifacts, evidence, reports, and fork checkpoints;
- clean-room visibility and controlled merge logic;
- normalized parsers for compile, test, fuzz, invariant, static, coverage, mutation, dependency, symbolic, and formal results;
- GitHub App and browser integrations;
- deployment, rollback, quota, lifecycle, and R2-budget controls.

## Execution restriction

The system MUST remain `executionDisabled=true` for submitted Audit projects until a separately developed hardened compute plane passes the external interface and adversarial acceptance suite. Cloudflare Workers, browser code, and GitHub-hosted Actions MUST NOT execute uploaded project scripts, tests, plugins, package lifecycle hooks, arbitrary commands, or hostile tool workloads.

Trusted repository tests may execute safe fixtures and the CurveYield-owned adapter/parser code. That does not authorize submitted user code.

## R2 pricing baseline

The capacity calculations use Cloudflare R2 Standard pricing published May 28, 2026:

- 10 GB-month storage included monthly.
- 1,000,000 Class A operations included monthly.
- 10,000,000 Class B operations included monthly.
- R2 egress is free.
- The free tier does not apply to Infrequent Access storage.

Pricing source: `https://developers.cloudflare.com/r2/pricing/`.

## Files

Read `01` through `17` in order. The exact per-function calculations are in `18_R2_FUNCTION_USAGE_TABLE_v2.csv`, with assumptions in `19_R2_USAGE_ASSUMPTIONS_v2.json` and aggregate scenarios in `20_R2_AGGREGATE_SCENARIOS_v2.csv`.
