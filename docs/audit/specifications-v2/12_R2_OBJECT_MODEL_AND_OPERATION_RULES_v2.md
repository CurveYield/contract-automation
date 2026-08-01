# R2 Object Model and Operation Rules v2

## Storage class

Use R2 Standard exclusively. R2 Data Catalog, R2 SQL, and Infrequent Access are disabled for this system.

## Key layout

```text
ingress/{tenantId}/{digest}.zip
ingress/jobs/{jobId}/attempts/{attemptId}/artifacts/{artifactId}.tar.zst
ingress/jobs/{jobId}/attempts/{attemptId}/evidence/{artifactId}.tar.zst
ingress/jobs/{jobId}/attempts/{attemptId}/reports/{artifactId}.zip

workspaces/{workspaceId}/source-v1.zip
workspaces/{workspaceId}/seal-v1.json
workspaces/{workspaceId}/source-manifest-v1.json
workspaces/{workspaceId}/layers/{layerId}.tar.zst
workspaces/{workspaceId}/layers/{layerId}-manifest-v1.json

profiles/{profileId}/profile-v1.json
profiles/{profileId}/sbom-v1.json
profiles/{profileId}/attestation-v1.json

campaigns/{campaignId}/creation-v1.json
campaigns/{campaignId}/current-v1.json
jobs/{jobId}/request-v1.json
jobs/{jobId}/status-v1.json
jobs/{jobId}/events/{batch}.jsonl
job-logs/{jobId}/attempts/{attemptId}/{sequence}.log
job-artifacts/{jobId}/{artifactId}.tar.zst
jobs/{jobId}/evidence/accepted/{artifactId}.tar.zst
jobs/{jobId}/evidence/{artifactId}-manifest-v1.json
jobs/{jobId}/evidence/{artifactId}-attestation-v1.json
jobs/{jobId}/reports/{artifactId}.zip
indexes/... deterministic index objects
```

## Retention prefixes

- `ingress/`: one day;
- `job-logs/`: seven days;
- `job-artifacts/`: seven days;
- `workspaces/`, `campaigns/`, `jobs/`, and active indexes: 30-day free-development policy;
- profile metadata: 90 days;
- profile revocations: 365 days.

Campaign policies `extended-90d` and `archive-365d` are rejected until separate versioned key classes and matching lifecycle rules exist.

## Mandatory cost and integrity rules

1. Never call `ListObjects` in status, log, artifact, workspace, campaign, or report retrieval.
2. Store sources, generated files, raw artifacts, evidence, and reports as bundles.
3. Use one mutable current-state key with ETag-conditional PUTs.
4. Read and merge server-owned indexes; callers cannot replace them.
5. Batch immutable events: up to 32 events or five minutes.
6. Chunk logs at one MB.
7. Make upload grants and object references stateless and short lived.
8. Validate deterministic ingress key, active attempt, digest, size, content type, and expiry before publication.
9. Quarantine evidence before validation; delete the redundant quarantine copy after acceptance.
10. Delete expired objects rather than moving them to another storage class.

## Operation classification

PutObject and CopyObject are Class A. HeadObject and GetObject are Class B. DeleteObject is free. Every adapter method and public function must have a billing-class trace test.

## Concurrency and partial writes

R2 is strongly consistent. Mutable state updates use ETag preconditions. Multi-object publication paths verify exact immutable objects on retry, merge server-owned indexes, and reject conflicting duplicates.
