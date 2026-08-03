# Temporary Ethereum RPC Diagnostic v1

This branch exists only to determine why the GitHub-native Ganache fork failed before executing its first workflow step.

It records no RPC URL or credentials. It reports only the endpoint hostname, structural metadata, and a short SHA-256 fingerprint so repository operators can determine whether GitHub is using the intended secret value.

The diagnostic compares:

1. Direct JSON-RPC requests from the GitHub runner.
2. Equivalent ethers requests.
3. Ganache fork initialization through a local method-logging proxy.

The branch and pull request must not be merged.
