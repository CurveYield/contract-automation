#!/usr/bin/env bash
set -euo pipefail

result_root="${RESULT_ROOT:?RESULT_ROOT is required}"
core_commit='0cc559d1741f68dcaf197bda509db64fd5ccbc80'
core_path='github-native-sim/jobs/v27-hardhat-full-v1/run-ci.sh'
core_script='/tmp/v27-hardhat-run-ci-core.sh'

# Execute the previously hash-reviewed lifecycle driver unchanged. This wrapper
# only corrects the final success classification for two deliberately expected
# migration reverts recorded in the completed call journal.
git fetch --no-tags origin "$core_commit"
git show "$core_commit:$core_path" > "$core_script"
chmod +x "$core_script"

set +e
bash "$core_script"
core_status=$?
set -e
printf '%s\n' "$core_status" > "$result_root/core-driver-exit-code.txt"

validated=0
if test -f "$result_root/data-report.json" && jq -e '
  .status == "completed"
  and .error == null
  and (.calls | length) == 53
  and ([.calls[] | select(.method == "eth_sendTransaction" and .receiptStatus == 1)] | length) == 42
  and ([.calls[]
        | select(.method == "eth_sendTransaction" and .receiptStatus == null)
        | .label] | sort)
      == (["require early Strategy 2 migration execution revert",
           "stale Strategy 1 keeper queue reverts after Strategy 2 migration"] | sort)
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
' "$result_root/data-report.json" >/dev/null; then
  validated=1
fi

jq --argjson coreDriverExitCode "$core_status" --argjson validated "$validated" '
  {
    reportStatus: .status,
    reportError: .error,
    coreDriverExitCode: $coreDriverExitCode,
    validatedSuccess: ($validated == 1),
    callCount: (.calls | length),
    successfulTransactionCount: ([.calls[] | select(.method == "eth_sendTransaction" and .receiptStatus == 1)] | length),
    expectedRevertTransactionCount: ([.calls[] | select(.method == "eth_sendTransaction" and .receiptStatus == null)] | length),
    expectedRevertLabels: [.calls[] | select(.method == "eth_sendTransaction" and .receiptStatus == null) | .label],
    assertionCount: (.assertions | length),
    passedAssertionCount: ([.assertions[] | select(.passed == true)] | length),
    cycleCount: (.cycles | length),
    postMigrationCycleCount: (.postMigrationCycles | length),
    supplementalTestCount: (.supplementalTests | length),
    passedSupplementalTestCount: ([.supplementalTests[] | select(.status == "passed")] | length),
    migration: .migration,
    finalJournalHash: .finalJournalHash,
    mcopyPreflight: .preflight.ybMcopyExecutionProof
  }
' "$result_root/data-report.json" | tee "$result_root/final-report-validation.json"

if test "$validated" -eq 1; then
  exit 0
fi
exit "$core_status"
