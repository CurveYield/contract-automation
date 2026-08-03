# Phase 2 — R2 Workspaces and Profile Registry v2

## Workspaces

Supported current-stack inputs are single ZIP uploads and exact-commit public GitHub archives. Production capability reporting must keep GitHub import disabled until a deployable exact-commit resolver is configured.

The client computes the SHA-256 archive digest before upload. Upload grants are stateless, expire in no more than one hour, and bind tenant, digest, size, content type, expiry, and deterministic ingress key. Grant signing is derived with HKDF-SHA256 from `AUDIT_EDGE_CONTROL_PLANE_TOKEN` using versioned salt and info strings.

The sealer reads both the ingress archive and the server-owned tenant index, verifies size and digest, validates matching ZIP local/central headers, rejects encryption, symlinks, unsafe paths, unsupported compression, expansion above the source cap, and extreme compression ratios, then writes:

```text
workspaces/{workspaceId}/source-v1.zip
workspaces/{workspaceId}/seal-v1.json
workspaces/{workspaceId}/source-manifest-v1.json
indexes/tenant/{tenantId}/workspaces-v1.json
```

The uploaded source remains one bundled archive. Extracted files are never stored as individual R2 objects. Ingress expires after one day; the sealed workspace archive and metadata retain for 30 days under the supported `free-development` policy.

Normal uploaded-workspace sealing costs **4 Class A and 2 Class B operations**. Exact-commit GitHub import also reads and merges the server-owned tenant index and costs **4 Class A and 1 Class B operation**.

Callers provide stable identifiers, source data, and an optional expected index ETag only. Full tenant-index snapshots are rejected. Empty indexes are initialized server-side, earlier entries are preserved, stale ETags fail before immutable writes, and exact partial publications are retryable.

## Layers

Each generated layer is one archive plus one manifest. Attaching a layer reads and merges one deterministic server-owned workspace-layer index and emits one event batch. Public layer listing reads the index object and never calls `ListObjects`.

Normal generated-layer attachment costs **4 Class A and 2 Class B operations**: one authoritative index read and one archive-verification read. Full caller-authored layer-index snapshots are rejected; empty-store initialization, ETag conflicts, and exact partial retries follow the same server-owned-index rules as workspace imports.

Production capability reporting must keep generated-layer attachment disabled until a deployable trusted bundle resolver is configured.

## Profile registry

Profile images remain in GitHub Container Registry. R2 stores immutable profile manifests, SBOM references, attestations, revocations, and a deterministic profile index. Publication reads and merges the server-owned index; a caller cannot erase prior profiles. Exact partial publications are retryable, while completed duplicate profile IDs remain rejected.

Normal profile publication costs **4 Class A and 1 Class B operation**.

## Limits

- source archive: 250 MiB maximum;
- generated layer: 100 MB maximum;
- workspace manifest: 2 MB maximum;
- Standard storage only;
- one-day ingress retention;
- 30-day free-development source/layer retention;
- extended 90-day and 365-day campaign retention are rejected until versioned retention-class keys exist.

Exact operation counts are in the R2 function table.
