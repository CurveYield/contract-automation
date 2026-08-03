# Deep Assurance Status Publication v1 — RED Gate

This marker records the test-first state for browser-agent workflow discovery.

Expected failures before implementation:

- missing `publish-deep-assurance-status.mjs` module;
- missing `statuses: write` workflow permission;
- missing pending and terminal commit-status publication steps;
- stale runner-release manifest after the trusted workflow changes.
