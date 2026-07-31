# Phase 2 — R2 Workspaces and Profile Registry v2

## Workspaces

Supported inputs are inline bundles, single ZIP uploads, and public GitHub repository refs. Branches and tags are resolved to exact commits before sealing.

The client computes the SHA-256 archive digest before upload. Upload grants are stateless and bind tenant, digest, size, content type, expiry, and destination key. The sealer streams the object from R2, validates the digest, canonicalizes the archive, and writes:

```text
workspaces/{workspaceId}/seal-v1.json
workspaces/{workspaceId}/source-manifest-v1.json
indexes/tenant/{tenantId}/workspaces-v1.json
```

The uploaded source remains a single bundled object. Extracted files are not stored as separate R2 objects.

## Layers

Each generated layer is one archive plus one manifest. Attaching a layer updates one deterministic workspace-layer index and emits one event batch. Public layer listing reads the index object; it never calls `ListObjects`.

## Profile registry

Profile images remain in GitHub Container Registry. R2 stores only immutable profile manifests, SBOM references, signatures/attestations, revocations, and deterministic profile indexes.

## R2 limits

- source archive: 250 MiB maximum;
- generated layer: 100 MB maximum;
- workspace manifest: 2 MB maximum;
- Standard storage only;
- no multipart upload below the single-part limit;
- ingress expiry: one day;
- free-development source/layer retention: 30 days.

Exact operation counts are in the R2 function table.
