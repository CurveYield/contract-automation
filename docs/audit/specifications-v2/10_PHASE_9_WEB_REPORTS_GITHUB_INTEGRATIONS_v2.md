# Phase 9 — Web, Reports, and GitHub Integrations v2

## Web application

The Audit Pages application provides workspace, layer, profile, campaign, job, attempt, log, artifact, evidence, report, fork, quota, and integration views. It never receives R2 credentials or the GitHub App private key.

## Retrieval strategy

- status polling reads one current-state object;
- log polling requests only sequences newer than the client cursor;
- artifact/evidence/report downloads use one bundled object each;
- the UI never lists bucket prefixes;
- browser cache/ETag requests are used where safe.

## GitHub identity

One GitHub App private key is stored as `AUDIT_GITHUB_MASTER_KEY`. The App ID and installation ID are non-secret variables. Short-lived installation tokens are generated when required. GitHub-specific PR, issue, workflow, and bridge keys are not created separately.

## Reports

One report publication writes the bundled render, manifest, and report index. Reports reference authoritative evidence IDs and digests rather than duplicating evidence invisibly.
