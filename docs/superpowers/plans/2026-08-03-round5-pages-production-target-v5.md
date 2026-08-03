# Round 5 Pages Production-Target Deployment V5 Implementation Plan

> **For agentic workers:** Execute inline with test-first commits and exact-head review gates.

**Goal:** Promote the already accepted Ethereum/Base-only web assets to the Cloudflare Pages production target and prove the custom domain serves them.

**Architecture:** A one-time exact-parent request triggers a production-environment GitHub Actions workflow. The workflow does not redeploy the Worker or mutate R2; it builds the existing static site, deploys Pages without a preview branch argument, and verifies the live custom domain before posting sanitized evidence.

**Tech Stack:** GitHub Actions, Node.js test runner, Wrangler Pages, Bash, Python standard library.

## Global Constraints

- Parent release SHA is `b31c79a2b48b3d1390e050489e2b9307f1fb75af`.
- Active UI networks are exactly Ethereum and Base.
- Deployment v4 run `30808377849` and failed smoke run `30813209037` must not be rerun.
- No Worker deployment, secret upload, R2 mutation, job/upload submission, wallet signing, or transaction broadcast.
- Every third-party action remains pinned to a full commit SHA.

---

### Task 1: Add the failing production-target contract

**Files:**
- Create: `packages/runner/test/audit-round5-pages-production-target-v2.test.mjs`

- [ ] Assert the v5 request and workflow exist.
- [ ] Assert exact-parent, production environment, Pages-only deployment, no `--branch`, live custom-domain verification, guaranteed report, and forbidden operations.
- [ ] Commit test-only RED state and let both natural PR CI workflows prove the sole intended failure.

### Task 2: Add the one-time deployment implementation

**Files:**
- Create: `.agent-control/v1/orchestrator/DEPLOY_REQUEST_v5.json`
- Create: `.github/workflows/deploy-v5.yml`

- [ ] Bind the request to the exact parent and prior evidence.
- [ ] Verify Cloudflare Pages project metadata with GET only.
- [ ] Run trusted repository verification and build.
- [ ] Deploy `dist/web` without a preview branch argument.
- [ ] Verify live HTML and client assets with bounded retries.
- [ ] Post sanitized evidence to issue #125 with `always()`.
- [ ] Confirm exact-head CI is green before merge.

### Task 3: Merge and inspect live evidence

- [ ] Recheck parent, head, changed paths, reviews, comments, threads, and mergeability.
- [ ] Merge only the verified exact head.
- [ ] Inspect every deployment job step and full sanitized logs.
- [ ] Preserve any failure without rerunning it.
- [ ] On success, create a separate test-first acceptance v3 from the new release head.
