#!/usr/bin/env bash
set -euo pipefail

if test "$#" -ne 2; then
  echo "usage: build-yb-shanghai-runtime.sh <runtime-output> <report-output>" >&2
  exit 2
fi

runtime_output="$1"
report_output="$2"
work_root="${RUNNER_TEMP:-/tmp}/v27-yb-shanghai"
source_root="$work_root/source"
payload="$work_root/blockscout-contract.json"
venv="$work_root/venv"
address='0x01791F726B4103694969820be083196cC7c045fF'

rm -rf "$work_root"
mkdir -p "$source_root" "$(dirname "$runtime_output")" "$(dirname "$report_output")"
curl --fail --silent --show-error --location \
  "https://eth.blockscout.com/api/v2/smart-contracts/$address" \
  --output "$payload"

PAYLOAD="$payload" SOURCE_ROOT="$source_root" REPORT_OUTPUT="$report_output" python - <<'PY'
import hashlib
import json
import os
from pathlib import Path

payload_path = Path(os.environ['PAYLOAD'])
source_root = Path(os.environ['SOURCE_ROOT'])
report_output = Path(os.environ['REPORT_OUTPUT'])
data = json.loads(payload_path.read_text(encoding='utf-8'))

compiler = str(data.get('compiler_version') or '')
language = str(data.get('language') or '')
if '0.4.3' not in compiler:
    raise SystemExit(f'unexpected YB compiler version: {compiler}')
if language.lower() != 'vyper':
    raise SystemExit(f'unexpected YB language: {language}')

files = [('contracts/dao/YB.vy', data['source_code'])]
for item in data.get('additional_sources') or []:
    files.append((item['file_name'], item['source_code']))

manifest = []
for relative, content in files:
    target = source_root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')
    manifest.append({
        'file': relative,
        'sha256': hashlib.sha256(content.encode()).hexdigest(),
        'bytes': len(content.encode())
    })

runtime = str(data.get('deployed_bytecode') or '')
if not runtime.startswith('0x'):
    raise SystemExit('Blockscout did not return YB deployed bytecode')
pc = 2591
start = 2 + pc * 2
original_byte = '0x' + runtime[start:start + 2]
if original_byte.lower() != '0x5e':
    raise SystemExit(f'YB byte at PC {pc} was {original_byte}, expected Cancun MCOPY 0x5e')

report = {
    'version': 'yb-ganache-shanghai-compatibility/v1',
    'address': data.get('address_hash'),
    'name': data.get('name'),
    'language': language,
    'compilerVersion': compiler,
    'verifiedAt': data.get('verified_at'),
    'evmVersionReportedByExplorer': data.get('evm_version'),
    'optimizationEnabled': data.get('optimization_enabled'),
    'sourceFiles': sorted(manifest, key=lambda item: item['file']),
    'sourceBundleSha256': hashlib.sha256(
        json.dumps(sorted(manifest, key=lambda item: item['file']), separators=(',', ':'), sort_keys=True).encode()
    ).hexdigest(),
    'originalRuntimeSha256': hashlib.sha256(bytes.fromhex(runtime[2:])).hexdigest(),
    'originalRuntimeBytes': (len(runtime) - 2) // 2,
    'originalPc': pc,
    'originalByteAtPc': original_byte,
    'compatibilityTarget': 'shanghai'
}
report_output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
PY

python -m venv "$venv"
"$venv/bin/python" -m pip install --disable-pip-version-check --no-input --quiet 'vyper==0.4.3'
"$venv/bin/vyper" \
  --evm-version shanghai \
  -p "$source_root/.venv/lib/pypy3.11/site-packages" \
  -f bytecode_runtime \
  "$source_root/contracts/dao/YB.vy" \
  > "$runtime_output"

RUNTIME_OUTPUT="$runtime_output" REPORT_OUTPUT="$report_output" VYPER_BIN="$venv/bin/vyper" python - <<'PY'
import hashlib
import json
import os
import subprocess
from pathlib import Path

runtime_path = Path(os.environ['RUNTIME_OUTPUT'])
report_path = Path(os.environ['REPORT_OUTPUT'])
runtime = runtime_path.read_text(encoding='utf-8').strip()
if not runtime.startswith('0x') or len(runtime) < 100:
    raise SystemExit('Vyper did not produce valid Shanghai runtime bytecode')
runtime_path.write_text(runtime + '\n', encoding='utf-8')
report = json.loads(report_path.read_text(encoding='utf-8'))
report.update({
    'compatibilityCompilerVersion': subprocess.check_output([os.environ['VYPER_BIN'], '--version'], text=True).strip(),
    'compatibilityRuntimeSha256': hashlib.sha256(bytes.fromhex(runtime[2:])).hexdigest(),
    'compatibilityRuntimeBytes': (len(runtime) - 2) // 2,
    'storagePolicy': 'preserve existing live Ganache storage; replace runtime code only',
    'mainnetMutation': False
})
report_path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
PY
