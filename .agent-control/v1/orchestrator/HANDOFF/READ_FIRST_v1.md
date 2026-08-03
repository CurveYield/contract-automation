# Replacement Orchestrator — Read First v1

GitHub is the durable source of truth. Do not rely on chat history, Project files, uploaded archives, hidden memory, or a local checkout.

## Identity and authority

- Repository: `CurveYield/contract-automation`
- Control-plane branch: `agent-control-plane-v1`
- Continuity issue: #63
- Round 4 master issue: #119
- Round 5 production acceptance: #125
- Timezone: `America/Los_Angeles`
- Operating mode: sole orchestrator
- Active networks: Ethereum and Base only
- Deferred and prohibited networks: Arbitrum, Fraxtal, Katana, Optimism, Polygon
- Dependency downloads: prohibited

Do not activate worker runtimes or edit worker-owned ACK/STATUS files.

## Mandatory startup order

1. Read `.agent-control/v1/PROTOCOL_v2.md` in full.
2. Read `.agent-control/v1/GLOBAL_STATE_v1.json`.
3. Read `CURRENT_STATE_SNAPSHOT_2026-08-03T0601-0700_v2.json` in this folder.
4. Read `ACCEPTED_WORK_LEDGER_2026-08-03T0601-0700_v2.md` in this folder.
5. Read the prior `ACCEPTED_WORK_LEDGER_2026-08-03T0442-0700_v1.md` for historical PRs #139–#150.
6. Read `REPLACEMENT_BOOTSTRAP_PROMPT_v1.md` and `CONTEXT_EXHAUSTION_CHECKLIST_v1.md`.
7. Read `.agent-control/v1/orchestrator/STATUS_v1.json` and the newest orchestrator events.
8. Refresh issue #125, PRs #156 and #157, release branch `orchestrator/round4-ci-base-v1`, deployment v6 run `30815289252`, and job `91691417740`.
9. Verify all live references before acting.

Older timestamped snapshots and prompts are historical. Protocol v2, the newest timestamped snapshot, the additive ledgers, and refreshed live GitHub state win on conflict.

## Current trusted state

- Trusted release branch head: `3c37394f814c40b1fc6fff134d2de698635bd185`
- Current release-head source: PR #156
- Accepted application source: `2c6e543dfcaa17ca975bbde3c15302269bbf8072`
- Accepted application source PR: #150
- Last verified API Worker deployment: run `30808377849`, job `91668946456`, success
- Production Pages custom domain current-source acceptance: **not accepted**
- Observed Pages state: stale seven-network selector

Do not describe release head `3c37394...` as an accepted deployed application. Its one-time Pages deployment gate failed.

## Latest rejected gate

PR #156 merged a Pages-only deployment v6. Its live evidence is:

- workflow run: `30815289252`
- job: `91691417740`
- job conclusion: failure
- request verification: success
- committed static UI verification: success
- configured Pages production branch verification: success
- Wrangler deployment command: success
- production custom-domain UI verification: failure on all six bounded attempts
- sanitized issue report: success

The workflow produced deployment short ID `1e0bf5b9`, but `preflight.curveyield.online` continued serving the stale selector.

The v6 request declared `dependencyInstallationAllowed: false`, while the workflow executed `npm exec --yes --package=wrangler@4.116.0`. That runtime dependency download is an independent rejection reason.

The log also emitted `fatal: bad object 2c6e543...` while Wrangler attempted to infer an omitted commit message. Current Wrangler source catches that metadata-discovery failure and continues with the supplied branch and commit hash. The missing object is not established as the production-routing cause.

Never rerun v6.

## Active blocked candidate

PR #157:

- branch: `orchestrator/round5-pages-commit-object-v7`
- exact base: `3c37394f814c40b1fc6fff134d2de698635bd185`
- last reviewed head: `0c457b8236bc673e11ea3e2fa888eff4f8fb5ae1`
- state at review: draft and mergeable
- blocking comment: `5166610889`
- merge allowed: false
- live execution allowed: false

Blockers:

- still downloads Wrangler with `npm exec`;
- drops the prior no-dependency-installation request field;
- full-history checkout does not prove production classification;
- does not require deployment response `environment: production`;
- does not require exact production/custom-domain alias binding.

Re-fetch PR #157 before acting because another runtime may advance it. Do not merge or execute the reviewed unsafe head.

## Preserve completed work

Standing anti-duplication rules:

- do not rerun failed or historical workflow runs;
- do not recreate accepted PRs or repeat their RED/GREEN sequences;
- do not recompute historical digests from the current mutable tree;
- do not repeat Cloudflare token diagnostics unless credential state changed;
- preserve issue #125 comments and accepted receipts;
- every new live gate must use a fresh exact-parent one-time request.

Failed runs that must never be rerun:

- `30800918581`
- `30805768611`
- `30813209037`
- `30814064657`
- `30815289252`

Production smoke run `30807373463` remains valid historical evidence for source `fbe27b824da8084970915b31f2051679abe39cfc`, but is superseded for current-source acceptance.

## Exact next action

Correct PR #157 or supersede it with a fresh exact-parent, test-first candidate that deploys Pages without downloading dependencies.

The corrected candidate must:

- use the Cloudflare Pages API directly against the already-uploaded asset manifest;
- use no package manager, dependency installer, or downloaded CLI;
- fail closed and perform no asset upload if any expected asset is missing;
- use the configured production branch by API contract;
- require deployment response `environment: production`;
- require trigger metadata branch `orchestrator/round4-ci-base-v1`;
- require exact production/custom-domain binding;
- verify the custom domain serves only Ethereum and Base, with Base as the sole default and authenticated `/api/v1/chains` synchronization present;
- preserve exact-parent, `production` environment, full-SHA action pins, secretless PR CI, and sanitized issue #125 reporting;
- perform no repository compilation, API Worker deployment, secret mutation, R2 mutation, API job/upload submission, RPC call, wallet action, signing, or transaction broadcast.

After Pages production binding is accepted, create a fresh current-source production smoke gate. Do not reuse or rerun the failed smoke v2 workflow.

## Remaining Round 5 scope

After current-source smoke acceptance, continue issue #125 without repeating accepted work:

- live API identity separation and negative cases;
- bounded R2 upload/publication/readback/cleanup;
- bounded GitHub bridge/Direct tests;
- trusted Ethereum/Base V27 regression;
- web/operator E2E and accessibility;
- observability, redaction, and retention;
- idempotent redeploy and rollback;
- R2 partial-publication recovery;
- GitHub duplicate-publication reconciliation;
- one explicitly authorized non-production application-key rotation;
- final production acceptance record.

## Standing restrictions

No dependency downloads, production secret values, raw RPC URLs, authorization headers, wallet keys, signing, public-chain broadcasting, deferred-network testing, broad unreviewed merges, direct `main` merge, AWS work, CurveYield Lite changes, destructive recovery against irreplaceable data, or worker-owned ACK/STATUS edits.

When live records conflict, integrate nothing, preserve the last validated exact state, record the discrepancy durably, and resolve it before proceeding.
