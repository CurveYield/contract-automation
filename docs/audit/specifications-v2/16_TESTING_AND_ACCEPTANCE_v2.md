# Testing and Acceptance v2

## Current-stack test layers

- protocol and schema unit tests;
- in-memory R2 adapter tests;
- R2 billing-class mapping tests;
- conditional-write conflict tests;
- object key and manifest integrity tests;
- lifecycle and quota tests;
- Cloudflare Worker component tests;
- GitHub App token/permission tests with fixtures;
- trusted GitHub Actions fixture tests for every parser/profile contract;
- UI/report escaping and hidden-resource tests;
- Lite boundary regression tests.

## R2 acceptance

- no hot-path `ListObjects` calls;
- per-function A/B estimates match adapter call traces;
- bundles remain within caps;
- expired prefixes are deleted under lifecycle tests;
- status overwrites do not accumulate object versions in application indexes;
- ETag conflicts do not lose transitions;
- one conservative audit-job fixture stays within 75 Class A, 47 Class B, and 0.0342 GB-month under free-development assumptions;
- admin usage report matches synthetic operation traces;
- same-account mode subtracts configured Lite reserve.

## Execution-disabled acceptance

- submitted projects cannot advance beyond `awaiting_executor`;
- no workflow accepts an uploaded project path or arbitrary ref as executable input;
- trusted fixtures are clearly marked and repository-owned;
- external executor callbacks are rejected unless signed and replay-protected;
- feature flag false is the default in every deployment environment.
