#!/usr/bin/env bash
set -euo pipefail

job_root='github-native-sim/jobs/v27-hardhat-full-v1'
result_root="${RESULT_ROOT:?RESULT_ROOT is required}"
source_ref='origin/automation/v27-functional-smoke-v2'
source_root='github-native-sim/jobs/v27-functional-smoke-v2'
hardhat_url='http://127.0.0.1:8545'
node_pid=''

mkdir -p "$result_root" "$job_root/project"
cleanup() {
  if test -n "$node_pid"; then
    kill "$node_pid" 2>/dev/null || true
    wait "$node_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Patch only the preflight evidence assertion. The unchanged live YB transaction
# already succeeds against byte 0x5e; Hardhat's trace omits opcode enumeration.
python "$job_root/patch-mcopy-preflight.py" "$job_root/scripts/run-v27-hardhat-lifecycle.mjs"
node --check "$job_root/scripts/run-v27-hardhat-lifecycle.mjs"
sha256sum "$job_root/scripts/run-v27-hardhat-lifecycle.mjs" > "$result_root/patched-runner-sha256.txt"

# Reconstruct and verify the exact V27 sources.
git fetch --no-tags origin 'automation/v27-functional-smoke-v2:refs/remotes/origin/automation/v27-functional-smoke-v2'
: > /tmp/v27-sources.tar.gz.b64
for part in 01 02 03 04 05; do
  git show "$source_ref:$source_root/source-payloads/archive/v27-sources.tar.gz.part-$part.b64" >> /tmp/v27-sources.tar.gz.b64
done
base64 -d /tmp/v27-sources.tar.gz.b64 > /tmp/v27-sources.tar.gz
echo '4ac83fac16a6005a9517775edc19f8997e2a6752f8ad94d2c7442eee0babbb59  /tmp/v27-sources.tar.gz' | sha256sum -c -
tar -xzf /tmp/v27-sources.tar.gz -C "$job_root/project"
git show "$source_ref:$source_root/project/CurveYieldSdYBRewardConverterV27.sol" > "$job_root/project/CurveYieldSdYBRewardConverterV27.sol"
echo 'c3c009179c53a9b5953f090ab8fd47528e392044b65c73006d229eeed8dd69c2  github-native-sim/jobs/v27-hardhat-full-v1/project/CurveYieldSdYBHybridVaultV27.sol' | sha256sum -c -
echo 'e8c1cd62b55986400555ac8ccb682f189304577a9fb53f26bdafccf24c09f14e  github-native-sim/jobs/v27-hardhat-full-v1/project/CurveYieldSdYBRewardConverterV27.sol' | sha256sum -c -
echo '8d5db62b021d152c48fde77cb426d22e1948a3208f169586cf91d07f0ad89a04  github-native-sim/jobs/v27-hardhat-full-v1/project/CurveYieldSdYBTwoDestinationStrategyV27.sol' | sha256sum -c -
cat > "$result_root/source-verification.json" <<JSON
{
  "archiveSha256": "4ac83fac16a6005a9517775edc19f8997e2a6752f8ad94d2c7442eee0babbb59",
  "vaultSha256": "c3c009179c53a9b5953f090ab8fd47528e392044b65c73006d229eeed8dd69c2",
  "converterSha256": "e8c1cd62b55986400555ac8ccb682f189304577a9fb53f26bdafccf24c09f14e",
  "strategySha256": "8d5db62b021d152c48fde77cb426d22e1948a3208f169586cf91d07f0ad89a04"
}
JSON

# Start Hardhat EDR and wait for a real metadata response.
nohup npx hardhat node \
  --config "$job_root/hardhat.config.mjs" \
  --network v27Fork \
  --hostname 127.0.0.1 \
  --port 8545 \
  > "$result_root/hardhat-node.log" 2>&1 &
node_pid=$!
ready=0
for attempt in $(seq 1 120); do
  if curl --silent --fail \
    --header 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"hardhat_metadata","params":[]}' \
    "$hardhat_url" > "$result_root/hardhat-metadata.json"; then
    if jq -e '.result.clientVersion and .result.chainId' "$result_root/hardhat-metadata.json" >/dev/null; then
      ready=1
      break
    fi
  fi
  if ! kill -0 "$node_pid" 2>/dev/null; then
    break
  fi
  sleep 1
done
if test "$ready" -ne 1; then
  cat "$result_root/hardhat-node.log" >&2
  exit 1
fi
jq . "$result_root/hardhat-metadata.json"

# Execute the complete lifecycle. The runner itself writes complete or partial evidence.
set +e
HARDHAT_RPC_URL="$hardhat_url" RESULT_ROOT="$result_root" \
  node "$job_root/scripts/run-v27-hardhat-lifecycle.mjs" \
  > "$result_root/workflow-stdout.log" \
  2> "$result_root/workflow-stderr.log"
status=$?
set -e
printf '%s\n' "$status" > "$result_root/simulation-exit-code.txt"
if test -f "$result_root/data-report.json"; then
  jq '{status, finishedAt, error, callCount: (.calls | length), assertionCount: (.assertions | length), passedAssertions: ([.assertions[] | select(.passed == true)] | length), cycleCount: (.cycles | length), postMigrationCycleCount: (.postMigrationCycles | length), supplementalTestCount: (.supplementalTests | length), migration, finalJournalHash, mcopyPreflight: .preflight.ybMcopyExecutionProof}' "$result_root/data-report.json" | tee "$result_root/compact-result.json"
fi
exit "$status"
