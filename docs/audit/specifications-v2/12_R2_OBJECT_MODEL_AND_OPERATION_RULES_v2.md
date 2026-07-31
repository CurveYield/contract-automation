# R2 Object Model and Operation Rules v2

## Storage class

Use R2 Standard exclusively. The free allowance does not apply to Infrequent Access storage, and the Audit access pattern reads recent logs, evidence, and reports frequently.

## Key layout

```text
ingress/{tenantId}/{digest}.zip
workspaces/{workspaceId}/seal-v1.json
workspaces/{workspaceId}/source-manifest-v1.json
workspaces/{workspaceId}/layers/{layerId}.tar.zst
workspaces/{workspaceId}/layers/{layerId}-manifest-v1.json
profiles/{profileId}/profile-v1.json
profiles/{profileId}/sbom-v1.json
campaigns/{campaignId}/campaign-v1.json
jobs/{jobId}/request-v1.json
jobs/{jobId}/status-v1.json
jobs/{jobId}/events/{batch}.jsonl
jobs/{jobId}/attempts/{attemptId}/logs/{sequence}.jsonl
jobs/{jobId}/attempts/{attemptId}/raw.tar.zst
jobs/{jobId}/attempts/{attemptId}/evidence.tar.zst
reports/{reportId}/report.tar.zst
forks/{forkId}/checkpoints/{checkpointId}.bin
indexes/... deterministic index objects
```

## Mandatory cost rules

1. Never call `ListObjects` in status, log, artifact, workspace, campaign, or report retrieval paths.
2. Store source and generated files as bundled archives with internal file manifests.
3. Store raw artifacts and reports as bundles.
4. Use one mutable current-state key and ETag-conditional PUTs.
5. Batch immutable events: 32 events or five minutes.
6. Chunk logs at one MB, not per line.
7. Make upload-session grants stateless.
8. Reference checkpoint objects during export; do not copy them.
9. Delete expired objects rather than moving them to Infrequent Access.
10. Keep R2 Data Catalog and R2 SQL disabled; they are unnecessary and create separate usage dimensions.

## Operation classification

Cloudflare classifies PutObject, CopyObject, ListObjects, and multipart creation/parts/completion as Class A. HeadObject and GetObject are Class B. DeleteObject is free. The implementation must maintain a test fixture mapping every R2 adapter method to its billing class.

## Concurrency

R2 is strongly consistent. Mutable state updates use ETag preconditions so concurrent writers cannot silently overwrite each other. A failed precondition returns a retryable conflict and does not advance the logical state machine.
