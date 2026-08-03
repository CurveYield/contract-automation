# CurveYield Audit Cloudflare scaffold v2

This directory defines the current-stack-only R2 policies for the separate Audit tier.

- Bucket: `curveyield-audit-control`
- Storage class: R2 Standard only
- Submitted execution: disabled
- Direct browser writes: disabled in Phase 1
- R2 SQL, Data Catalog, Infrequent Access, and Lite bindings: prohibited

The lifecycle rules are applied only during a later authenticated deployment. Phase 1 CI validates their structure without changing Cloudflare resources.
