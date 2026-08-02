# GitHub Direct Core Protocol v1

## Identity

The mode identifier is exactly `github-direct-audit-v1`. It is distinct from `cloudflare-audit-v1` and never falls back automatically. The repository ledger branch is exactly `audit-direct/control-v1`.

A request binds all of the following immutable identities:

- numeric repository ID;
- numeric GitHub App installation ID;
- canonical `owner/repository` full name;
- requester identity;
- policy version;
- profile version;
- parser version;
- result-contract version;
- report-contract version;
- exact lowercase 40-hex target commit SHA;
- canonical request timestamp;
- idempotency key.

Mutable refs such as branch names, tags, `latest`, commands, credentials, workflow names, URLs, images, runner labels, RPC endpoints, and execution flags are not request fields and fail exact-key validation.

## Contracts

The protocol exports builders and validators for:

- direct requests;
- current state records;
- immutable transition events;
- capability manifests;
- result manifests;
- report indexes.

Every accepted value is canonical, byte-bounded, recursively frozen, and SHA-256 identified. Builders accept ordinary or null-prototype objects. Class instances, custom prototypes, symbols, accessors, sparse arrays, cycles, negative zero, unsafe integers, control characters, hostile proxies, and oversized canonical UTF-8 output are rejected with bounded code/path errors.

## Execution truth

`execution_plane_unavailable` requires:

- outcome `execution_unavailable`;
- execution state `execution_plane_unavailable`;
- null result digest;
- no claim that a submitted project ran.

Repository-owned inert fixture modeling uses outcome `modeled_fixture` and execution state `fixture_modeled`. It remains distinct from successful external execution.

## Runtime portability

The package uses standard JavaScript only. Its synchronous SHA-256 implementation uses `TextEncoder`, has no Node built-in dependency, and is pinned by known vectors and cross-checked in tests.
