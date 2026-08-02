#!/usr/bin/env bash
set -euo pipefail

job_root='github-native-sim/jobs/live-fork-v27-v1'
slot_secret="${V27_RPC_SLOT_SECRET:-RPC_ANVIL_ETHEREUM1}"

python - "$job_root/run-v27-live-fork.mjs" "$job_root/seed-sdyb-fixture.mjs" "$job_root/run-ci.sh" <<'PY'
from pathlib import Path
import sys

runner = Path(sys.argv[1])
fixture = Path(sys.argv[2])
run_ci = Path(sys.argv[3])

runner_source = runner.read_text(encoding='utf-8')
runner_old = "const SLOT_SECRET = 'RPC_ANVIL_ETHEREUM1';"
runner_new = "const SLOT_SECRET = process.env.V27_RPC_SLOT_SECRET ?? 'RPC_ANVIL_ETHEREUM1';"
if runner_new not in runner_source:
    if runner_old not in runner_source:
        raise SystemExit('runner slot-secret declaration was not found')
    runner_source = runner_source.replace(runner_old, runner_new, 1)
runner.write_text(runner_source, encoding='utf-8')

fixture_source = fixture.read_text(encoding='utf-8')
fixture_old = "const rpcUrl = process.env.RPC_ANVIL_ETHEREUM1;\nif (!rpcUrl) throw new Error('RPC_ANVIL_ETHEREUM1 is required');"
fixture_new = "const slotSecret = process.env.V27_RPC_SLOT_SECRET ?? 'RPC_ANVIL_ETHEREUM1';\nconst rpcUrl = process.env[slotSecret];\nif (!rpcUrl) throw new Error(`${slotSecret} is required`);"
if fixture_new not in fixture_source:
    if fixture_old not in fixture_source:
        raise SystemExit('fixture slot-secret declaration was not found')
    fixture_source = fixture_source.replace(fixture_old, fixture_new, 1)
fixture.write_text(fixture_source, encoding='utf-8')

run_ci_source = run_ci.read_text(encoding='utf-8')
validation_old = '.transport.slotSecret == "RPC_ANVIL_ETHEREUM1"'
validation_new = '.transport.slotSecret == env.V27_RPC_SLOT_SECRET'
if validation_new not in run_ci_source:
    if validation_old not in run_ci_source:
        raise SystemExit('run-ci slot-secret validation was not found')
    run_ci_source = run_ci_source.replace(validation_old, validation_new, 1)
run_ci.write_text(run_ci_source, encoding='utf-8')
PY

if [[ -z "${!slot_secret:-}" ]]; then
  echo "required selected RPC secret ${slot_secret} is unavailable" >&2
  exit 2
fi

exec bash "$job_root/run-ci.sh"
