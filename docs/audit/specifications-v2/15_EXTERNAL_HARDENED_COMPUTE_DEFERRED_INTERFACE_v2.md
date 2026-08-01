# Deferred Hardened Compute Interface v2

## Purpose

This document defines the only boundary the future hardened compute project must implement. It does not select a provider or require provider secrets in the current repository.

## Outbound request

The control plane sends a signed, replay-protected envelope containing only:

- job/attempt/workspace/campaign IDs;
- immutable source/layer object grants;
- immutable profile ID/digest;
- structured allowlisted configuration;
- resource/network policy IDs;
- expected evidence schema;
- cancellation endpoint and deadline.

It never sends shell commands, private keys, wallet material, arbitrary URLs, custom images, raw provider credentials, or Cloudflare/GitHub deployment credentials.

## Inbound events

The executor may submit:

- admitted/provisioning/running phase updates;
- heartbeats;
- log chunks;
- resource counters;
- artifact quarantine bundles;
- normalized result bundle;
- destruction record;
- terminal status.

## Required acceptance before enablement

- one workload per strong sandbox;
- non-root, no privilege, no host mounts/devices/socket;
- default-deny egress and no public inbound;
- no access to Lite, GitHub administration, Cloudflare deployment, R2 credentials, RPC provider credentials, or attestation private key;
- cancellation and timeout destroy the sandbox;
- fork bombs, memory/disk/log floods, package hooks, plugins, compiler downloads, shell escapes, cross-workspace reads, wallet/signing calls, and broadcast attempts are blocked;
- evidence is validated and signed outside the worker.

Until these tests pass, `AUDIT_EXECUTION_ENABLED` must remain false.
