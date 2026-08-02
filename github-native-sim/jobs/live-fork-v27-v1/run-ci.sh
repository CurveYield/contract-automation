#!/usr/bin/env bash
set -euo pipefail

job_root='github-native-sim/jobs/live-fork-v27-v1'
result_root="${RESULT_ROOT:?RESULT_ROOT is required}"
harness_commit='73a0e73aa269927a7338e58b59c1cab394d7bad0'
harness_source='github-native-sim/jobs/v27-hardhat-full-v1'
source_commit='829954164fc9f3ea23665122b711cef2a0850fbf'
source_root='github-native-sim/jobs/v27-functional-smoke-v2'

mkdir -p "$result_root" "$job_root/project" "$job_root/scripts" "$job_root/config"

# Reconstruct the exact reviewed V27 lifecycle from its immutable commit.
git fetch --no-tags origin "$harness_commit" "$source_commit"
rm -rf /tmp/v27-reviewed-harness
mkdir -p /tmp/v27-reviewed-harness
git archive "$harness_commit" "$harness_source" | tar -x -C /tmp/v27-reviewed-harness
reviewed_root="/tmp/v27-reviewed-harness/$harness_source"
cat "$reviewed_root"/payload-hex/v27-hardhat-job.tar.gz.hex.part-* > /tmp/v27-hardhat-job.hex
python - <<'PY'
from pathlib import Path
compact = ''.join(Path('/tmp/v27-hardhat-job.hex').read_text(encoding='utf-8').split())
Path('/tmp/v27-hardhat-job.tar.gz').write_bytes(bytes.fromhex(compact))
PY
echo 'aef1382bfbf9bc9c78872d1e5e7f3ac850f66bc308852f6c12e4dd50c7baaa24  /tmp/v27-hardhat-job.tar.gz' | sha256sum -c -
tar -xzf /tmp/v27-hardhat-job.tar.gz -C "$job_root"

# Preserve the reviewed lifecycle and economic assertions. Only adapt the RPC
# transport vocabulary from local Hardhat EDR to the persistent remote Anvil RPC.
python - "$job_root/scripts/run-v27-hardhat-lifecycle.mjs" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = p.read_text(encoding='utf-8')
replacements = {
    'upstream observations use RPC_ETHEREUM directly; state-changing calls use the local Hardhat node only':
        'all observations and state-changing calls use the same persistent remote Anvil RPC',
    'upstream observations use the shared capability-aware live-fork proxy; state-changing calls use the local Hardhat EDR node only':
        'all observations and state-changing calls use the same persistent remote Anvil RPC',
    'hardhat_impersonateAccount': 'anvil_impersonateAccount',
    'hardhat_stopImpersonatingAccount': 'anvil_stopImpersonatingAccount',
    'hardhat_setBalance': 'anvil_setBalance',
    'hardhat_setCode': 'anvil_setCode',
    'hardhat_setStorageAt': 'anvil_setStorageAt',
    'hardhat_mine': 'anvil_mine',
    'if (upstreamProvider) await upstreamProvider.destroy().catch(() => {});':
        'if (upstreamProvider) await Promise.resolve(upstreamProvider.destroy()).catch(() => {});',
    'if (engine) await engine.close().catch(() => {});':
        'if (engine) await Promise.resolve(engine.close()).catch(() => {});'
}
for old, new in replacements.items():
    s = s.replace(old, new)
p.write_text(s, encoding='utf-8')
PY

# Keep the previously reviewed economic and migration corrections unchanged.
python "$job_root/patch-reviewed-v27-harness.py" "$job_root/scripts/run-v27-hardhat-lifecycle.mjs"
node --check "$job_root/scripts/run-v27-hardhat-lifecycle.mjs"
sha256sum "$job_root/scripts/run-v27-hardhat-lifecycle.mjs" > "$result_root/patched-lifecycle-sha256.txt"
cp "$job_root/scripts/run-v27-hardhat-lifecycle.mjs" "$result_root/effective-lifecycle-pre-wrapper.mjs"

# Materialize and verify the exact V27 Solidity sources from their immutable commit.
rm -rf /tmp/v27-reviewed-sources
mkdir -p /tmp/v27-reviewed-sources
git archive "$source_commit" "$source_root/source-payloads" "$source_root/project/CurveYieldSdYBRewardConverterV27.sol" | tar -x -C /tmp/v27-reviewed-sources
reviewed_source_root="/tmp/v27-reviewed-sources/$source_root"
: > /tmp/v27-sources.tar.gz.b64
for part in 01 02 03 04 05; do
  cat "$reviewed_source_root/source-payloads/archive/v27-sources.tar.gz.part-$part.b64" >> /tmp/v27-sources.tar.gz.b64
done
base64 -d /tmp/v27-sources.tar.gz.b64 > /tmp/v27-sources.tar.gz
echo '4ac83fac16a6005a9517775edc19f8997e2a6752f8ad94d2c7442eee0babbb59  /tmp/v27-sources.tar.gz' | sha256sum -c -
tar -xzf /tmp/v27-sources.tar.gz -C "$job_root/project"
cp "$reviewed_source_root/project/CurveYieldSdYBRewardConverterV27.sol" "$job_root/project/CurveYieldSdYBRewardConverterV27.sol"
echo 'c3c009179c53a9b5953f090ab8fd47528e392044b65c73006d229eeed8dd69c2  github-native-sim/jobs/live-fork-v27-v1/project/CurveYieldSdYBHybridVaultV27.sol' | sha256sum -c -
echo 'e8c1cd62b55986400555ac8ccb682f189304577a9fb53f26bdafccf24c09f14e  github-native-sim/jobs/live-fork-v27-v1/project/CurveYieldSdYBRewardConverterV27.sol' | sha256sum -c -
echo '8d5db62b021d152c48fde77cb426d22e1948a3208f169586cf91d07f0ad89a04  github-native-sim/jobs/live-fork-v27-v1/project/CurveYieldSdYBTwoDestinationStrategyV27.sol' | sha256sum -c -
cat > "$result_root/source-verification.json" <<JSON
{
  "harnessCommit": "$harness_commit",
  "sourceCommit": "$source_commit",
  "harnessPayloadSha256": "aef1382bfbf9bc9c78872d1e5e7f3ac850f66bc308852f6c12e4dd50c7baaa24",
  "sourceArchiveSha256": "4ac83fac16a6005a9517775edc19f8997e2a6752f8ad94d2c7442eee0babbb59",
  "vaultSha256": "c3c009179c53a9b5953f090ab8fd47528e392044b65c73006d229eeed8dd69c2",
  "converterSha256": "e8c1cd62b55986400555ac8ccb682f189304577a9fb53f26bdafccf24c09f14e",
  "strategySha256": "8d5db62b021d152c48fde77cb426d22e1948a3208f169586cf91d07f0ad89a04"
}
JSON

set +e
RESULT_ROOT="$result_root" V27_JOB_ROOT="$job_root" \
  timeout --signal=TERM --kill-after=20s 65m \
  node "$job_root/run-v27-live-fork.mjs" \
  > "$result_root/wrapper-stdout.log" \
  2> "$result_root/wrapper-stderr.log"
wrapper_status=$?
set -e
printf '%s\n' "$wrapper_status" > "$result_root/wrapper-exit-code.txt"

validated=0
if test -f "$result_root/data-report.json" \
  && test -f "$result_root/live-fork-wrapper-report.json" \
  && jq -e '
    .status == "completed"
    and .error == null
    and (.calls | length) == 53
    and ([.calls[] | select(.method == "eth_sendTransaction" and .receiptStatus == 1)] | length) == 42
    and ([.calls[] | select(.method == "eth_sendTransaction" and .receiptStatus == null)] | length) == 2
    and (.assertions | length) >= 85
    and all(.assertions[]; .passed == true)
    and (.cycles | length) == 4
    and (.postMigrationCycles | length) == 2
    and (.supplementalTests | length) == 4
    and all(.supplementalTests[]; .status == "passed")
    and all(.supplementalTests[]; all(.assertions[]; .passed == true))
    and .migration.strategy1Retired == true
    and .migration.backingBefore == .migration.backingAfter
    and (.migration.activeStrategy | type) == "string"
    and .preflight.ybMcopyExecutionProof.receiptStatus == 1
    and (.finalJournalHash | type) == "string"
    and (.finalJournalHash | length) == 66
  ' "$result_root/data-report.json" >/dev/null \
  && jq -e '
    .assurance == "persistent-remote-anvil-fork"
    and .broadcastTransactions == false
    and .sourceChainId == 1
    and .transport.type == "authenticated-remote-json-rpc"
    and .transport.slotSecret == "RPC_ANVIL_ETHEREUM1"
    and .transport.stickyForWholeRun == true
    and .transport.localExecutionEngine == false
    and .cleanup.reverted == true
    and .cleanup.baselineFullyRestored == true
  ' "$result_root/live-fork-wrapper-report.json" >/dev/null; then
  validated=1
fi

if test -f "$result_root/data-report.json"; then
  jq --slurpfile wrapper "$result_root/live-fork-wrapper-report.json" \
     --argjson wrapperExitCode "$wrapper_status" \
     --argjson validated "$validated" '
    {
      reportStatus: .status,
      reportError: .error,
      wrapperExitCode: $wrapperExitCode,
      validatedSuccess: ($validated == 1),
      assurance: $wrapper[0].assurance,
      rpcChainId: $wrapper[0].rpcChainId,
      forkIdentity: $wrapper[0].forkIdentity,
      cleanup: $wrapper[0].cleanup,
      callCount: (.calls | length),
      successfulTransactionCount: ([.calls[] | select(.method == "eth_sendTransaction" and .receiptStatus == 1)] | length),
      expectedRevertTransactionCount: ([.calls[] | select(.method == "eth_sendTransaction" and .receiptStatus == null)] | length),
      assertionCount: (.assertions | length),
      passedAssertionCount: ([.assertions[] | select(.passed == true)] | length),
      cycleCount: (.cycles | length),
      cycles: .cycles,
      postMigrationCycleCount: (.postMigrationCycles | length),
      postMigrationCycles: .postMigrationCycles,
      supplementalTestCount: (.supplementalTests | length),
      passedSupplementalTestCount: ([.supplementalTests[] | select(.status == "passed")] | length),
      migration: .migration,
      finalJournalHash: .finalJournalHash,
      mcopyPreflight: .preflight.ybMcopyExecutionProof
    }
  ' "$result_root/data-report.json" | tee "$result_root/final-validation.json"
else
  jq -n --slurpfile wrapper "$result_root/live-fork-wrapper-report.json" \
    --argjson wrapperExitCode "$wrapper_status" \
    '{reportStatus:"missing",wrapperExitCode:$wrapperExitCode,validatedSuccess:false,wrapper:$wrapper[0]}' \
    | tee "$result_root/final-validation.json"
fi

if test "$validated" -eq 1; then
  exit 0
fi
exit "$wrapper_status"
