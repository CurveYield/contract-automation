# Phase 8 — Clean-Room Parallel Campaigns v2

## Visibility model

Every index and object key is tenant/workspace/campaign scoped. A campaign sees only source, explicitly shared base artifacts, its own layers, jobs, logs, artifacts, evidence, reports, and forks.

Hidden resources MUST be absent from API responses, counts, timing-dependent indexes, search, notifications, and signed URLs.

## Controlled merge

The merge process reads explicit terminal campaign manifests and writes:

- merge manifest;
- duplicate relation map;
- conflict relation map;
- provenance index;
- merged report references.

Original findings and evidence remain immutable.

## R2 behavior

No merge performs prefix listing. The request supplies approved campaign IDs, and the control plane resolves deterministic manifest keys. One typical merge is budgeted at four Class A, four Class B, and two MB retained for 90 days.
