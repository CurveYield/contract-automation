# Round 5 Pages Routing Diagnostic v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Determine why `preflight.curveyield.online` serves stale seven-network assets after Cloudflare accepted the v11 production deployment, without mutating Cloudflare or installing/downloading dependencies.

**Architecture:** Add a fresh exact-parent, one-time, GET-only production diagnostic. Bind the diagnostic to the successful v11 deployment and accepted application commit, inspect Pages project/domain/deployment metadata through official Cloudflare Pages GET endpoints, then classify served HTML/JavaScript at the immutable deployment URL, project `pages.dev` subdomain, and production custom domain using hashes and bounded selector/client checks. Publish only sanitized classifications to issue #125.

**Tech Stack:** GitHub Actions YAML, bash, `curl`, `jq`, Python 3 standard library, Node.js built-in test runner.

## Global Constraints

- Release branch is `orchestrator/round4-ci-base-v1`.
- Accepted application source is `2c6e543dfcaa17ca975bbde3c15302269bbf8072`.
- Successful v11 run is `30832528012`; job is `91749723106`; deployment short ID is `c3d3e149`.
- No dependency installation or download.
- No repository compilation or build.
- Cloudflare methods are GET only; no Pages/Worker/R2/secret mutation.
- No API job/upload submission, blockchain RPC call, wallet operation, signing, or transaction broadcast.
- Never rerun failed or historical workflows.
- Active browser network scope remains exactly Ethereum and Base, with Base as sole default.
- The implementation request must bind to the exact release parent captured before the test commit; it must not infer or float at runtime.

---

### Task 1: Freeze the exact v2 diagnostic contract

**Files:**
- Create: `docs/superpowers/specs/2026-08-07-round5-pages-routing-diagnostic-v2-design.md`
- Test: `packages/runner/test/audit-round5-pages-routing-diagnostic-v2.test.mjs`

**Interfaces:**
- Consumes: v11 deployment evidence in issue #125 and Cloudflare Pages GET endpoints for project, deployments, exact deployment, domain list, and exact domain.
- Produces: static requirements for a versioned request and workflow.

- [ ] **Step 1: Record the exact release parent** from the parent of the first plan commit on this branch and write it into the design and test constants.
- [ ] **Step 2: Write the failing Node built-in test** requiring the v2 request/workflow and all GET-only metadata/content gates.
- [ ] **Step 3: Verify RED** through the repository's natural pull-request CI; the expected focused failure is the absent v2 request/workflow while existing unrelated tests remain unchanged.

### Task 2: Implement the GET-only routing diagnostic

**Files:**
- Create: `.agent-control/v1/orchestrator/PAGES_ROUTING_DIAGNOSTIC_REQUEST_v2.json`
- Create: `.github/workflows/pages-routing-diagnostic-v2.yml`

**Interfaces:**
- Consumes: exact release parent, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `PAGES_PROJECT_NAME`, Cloudflare Pages GET responses, and public served assets.
- Produces: sanitized issue #125 receipt classifying project production branch, exact v11 deployment binding, production deployment list binding, project domain association/status, project subdomain content, immutable deployment content, and custom-domain content.

- [ ] **Step 1: Add the one-time v2 request** with exact parent, accepted application commit, v11 run/job/short deployment ID, required checks, and explicit GET-only/no-mutation assertions.
- [ ] **Step 2: Add the workflow** triggered only by a push of that request path to the trusted release branch and protected by the production environment.
- [ ] **Step 3: Validate metadata** using only official GET endpoints: project; deployments filtered to production; exact deployment by resolved ID; project domains; exact custom domain.
- [ ] **Step 4: Validate served content** at the exact immutable deployment URL, the project subdomain returned by Cloudflare, and `https://preflight.curveyield.online`, including cache-busted reads. Hash assets and classify selector/client behavior without posting bodies or URLs.
- [ ] **Step 5: Derive one bounded diagnosis** distinguishing at minimum exact-deployment mismatch, production-list mismatch, Pages-domain association/status mismatch, project-subdomain mismatch, custom-domain routing mismatch, and no-current-mismatch.
- [ ] **Step 6: Publish a sanitized issue #125 receipt under `always()`** containing booleans, bounded enums/counts, run/source identifiers, and no secret/account/domain-response bodies.

### Task 3: Verify and promote the diagnostic

**Files:**
- No additional production files unless a test-discovered defect requires a fresh v3.

**Interfaces:**
- Consumes: v2 test/workflow/request exact head and PR checks.
- Produces: merged GET-only diagnostic and live sanitized diagnosis.

- [ ] **Step 1: Verify GREEN** on the exact PR head with the focused test and repository CI; do not manually rerun any failed/historical workflow.
- [ ] **Step 2: Inspect exact diff, PR comments/reviews, mergeability, and required checks.**
- [ ] **Step 3: Merge only the verified exact head** into `orchestrator/round4-ci-base-v1`; this merge push is the one-time diagnostic trigger.
- [ ] **Step 4: Read the resulting issue #125 diagnostic receipt** and preserve the run/job evidence.

### Task 4: Apply the smallest routing repair and complete browser acceptance

**Files:**
- Versioned files determined strictly by the v2 diagnosis; any repair must use a fresh exact-parent request/workflow and a new whole-number version.

**Interfaces:**
- Consumes: v2 diagnosis.
- Produces: correctly routed production custom domain and fresh production smoke acceptance.

- [ ] **Step 1: If the diagnosis identifies a repository-fixable Cloudflare routing/configuration defect, write a new failing test and a fresh versioned exact-parent repair design before mutation.**
- [ ] **Step 2: Implement only the diagnosed repair; preserve no-dependency/no-compile and least-mutation boundaries.**
- [ ] **Step 3: Verify and promote the repair through a fresh trusted push; never rerun v11 or another failed/historical run.**
- [ ] **Step 4: Run a fresh read-only production smoke gate proving the custom domain serves exactly Ethereum/Base, Base defaults, authenticated chain synchronization remains present, and Pages/API/CORS/RPC-read gates are healthy.**
- [ ] **Step 5: Continue the remaining Round 5 browser/operator acceptance stages only after the routing gate is green; stop only on a true account-owner/external hard blocker.**
