#!/usr/bin/env bash
set -euo pipefail

if test "$#" -ne 2; then
  echo "usage: build-yb-shanghai-runtime-v2.sh <runtime-output> <report-output>" >&2
  exit 2
fi

runtime_output="$1"
report_output="$2"
report_dir="$(dirname "$report_output")"
work_root="${RUNNER_TEMP:-/tmp}/v27-yb-shanghai-v2"
payload="$work_root/blockscout-contract.json"
input_json="$work_root/vyper-input.json"
output_json="$work_root/vyper-output.json"
venv="$work_root/venv"
address='0x01791F726B4103694969820be083196cC7c045fF'

rm -rf "$work_root"
mkdir -p "$work_root" "$(dirname "$runtime_output")" "$report_dir"
curl --fail --silent --show-error --location \
  "https://eth.blockscout.com/api/v2/smart-contracts/$address" \
  --output "$payload"
cp "$payload" "$report_dir/blockscout-contract-metadata.json"

PAYLOAD="$payload" INPUT_JSON="$input_json" REPORT_OUTPUT="$report_output" python - <<'PY'
import hashlib
import json
import os
from pathlib import Path

payload_path = Path(os.environ['PAYLOAD'])
input_path = Path(os.environ['INPUT_JSON'])
report_path = Path(os.environ['REPORT_OUTPUT'])
data = json.loads(payload_path.read_text(encoding='utf-8'))
compiler = str(data.get('compiler_version') or '')
language = str(data.get('language') or '')
if '0.4.3' not in compiler:
    raise SystemExit(f'unexpected YB compiler version: {compiler}')
if language.lower() != 'vyper':
    raise SystemExit(f'unexpected YB language: {language}')

source_entries = [('contracts/dao/YB.vy', data['source_code'])]
source_entries.extend((item['file_name'], item['source_code']) for item in data.get('additional_sources') or [])
manifest = []
sources = {}
for relative, content in source_entries:
    encoded = content.encode()
    manifest.append({'file': relative, 'sha256': hashlib.sha256(encoded).hexdigest(), 'bytes': len(encoded)})
    sources[relative] = {'content': content}
    for prefix in ('lib/snekmate/src/', '.venv/lib/pypy3.11/site-packages/'):
        if relative.startswith(prefix):
            sources.setdefault(relative[len(prefix):], {'content': content})

runtime = str(data.get('deployed_bytecode') or '')
if not runtime.startswith('0x'):
    raise SystemExit('Blockscout did not return YB deployed bytecode')
pc = 2591
start = 2 + pc * 2
original_byte = '0x' + runtime[start:start + 2]
if original_byte.lower() != '0x5e':
    raise SystemExit(f'YB byte at PC {pc} was {original_byte}, expected Cancun MCOPY 0x5e')

standard_input = {
    'language': 'Vyper',
    'sources': sources,
    'settings': {
        'evmVersion': 'shanghai',
        'outputSelection': {
            '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'layout']
        }
    }
}
input_path.write_text(json.dumps(standard_input, separators=(',', ':')), encoding='utf-8')
manifest_sorted = sorted(manifest, key=lambda item: item['file'])
report = {
    'version': 'yb-ganache-shanghai-compatibility/v2',
    'address': data.get('address_hash'),
    'name': data.get('name'),
    'language': language,
    'compilerVersion': compiler,
    'verifiedAt': data.get('verified_at'),
    'evmVersionReportedByExplorer': data.get('evm_version'),
    'optimizationEnabled': data.get('optimization_enabled'),
    'sourceFiles': manifest_sorted,
    'sourceBundleSha256': hashlib.sha256(json.dumps(manifest_sorted, separators=(',', ':'), sort_keys=True).encode()).hexdigest(),
    'standardInputSha256': hashlib.sha256(input_path.read_bytes()).hexdigest(),
    'originalRuntimeSha256': hashlib.sha256(bytes.fromhex(runtime[2:])).hexdigest(),
    'originalRuntimeBytes': (len(runtime) - 2) // 2,
    'originalPc': pc,
    'originalByteAtPc': original_byte,
    'compatibilityTarget': 'shanghai',
    'compileInterface': 'vyper standard JSON'
}
report_path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
PY

python -m venv "$venv"
"$venv/bin/python" -m pip install --disable-pip-version-check --no-input 'vyper==0.4.3' \
  > "$report_dir/vyper-install.stdout.log" \
  2> "$report_dir/vyper-install.stderr.log"
"$venv/bin/vyper" --version > "$report_dir/vyper-version.txt" 2>&1
"$venv/bin/vyper-json" --help > "$report_dir/vyper-json-help.txt" 2>&1

set +e
"$venv/bin/vyper-json" "$input_json" \
  > "$output_json" \
  2> "$report_dir/vyper-json.stderr.log"
compile_status=$?
set -e
printf '%s\n' "$compile_status" > "$report_dir/vyper-json-exit-code.txt"
cp "$output_json" "$report_dir/vyper-output.json"
if test "$compile_status" -ne 0; then
  cat "$report_dir/vyper-json.stderr.log" >&2
  exit "$compile_status"
fi

OUTPUT_JSON="$output_json" RUNTIME_OUTPUT="$runtime_output" REPORT_OUTPUT="$report_output" VYPER_BIN="$venv/bin/vyper" python - <<'PY'
import hashlib
import json
import os
import subprocess
from pathlib import Path

output_path = Path(os.environ['OUTPUT_JSON'])
runtime_path = Path(os.environ['RUNTIME_OUTPUT'])
report_path = Path(os.environ['REPORT_OUTPUT'])
output = json.loads(output_path.read_text(encoding='utf-8'))
errors = output.get('errors') or []
fatal = [item for item in errors if str(item.get('severity', '')).lower() == 'error']
if fatal:
    raise SystemExit('Vyper standard JSON returned errors: ' + json.dumps(fatal[:5]))

selected = None
selected_source = None
for source_name, contracts in (output.get('contracts') or {}).items():
    for contract_name, artifact in contracts.items():
        if contract_name == 'YB':
            selected = artifact
            selected_source = source_name
            break
    if selected is not None:
        break
if selected is None:
    raise SystemExit('Vyper standard JSON output did not contain YB')

runtime_object = (((selected.get('evm') or {}).get('deployedBytecode') or {}).get('object') or '')
runtime = runtime_object if runtime_object.startswith('0x') else '0x' + runtime_object
if not runtime.startswith('0x') or len(runtime) < 100:
    raise SystemExit('Vyper standard JSON did not produce valid Shanghai runtime bytecode')
runtime_path.write_text(runtime + '\n', encoding='utf-8')
report = json.loads(report_path.read_text(encoding='utf-8'))
report.update({
    'compatibilityCompilerVersion': subprocess.check_output([os.environ['VYPER_BIN'], '--version'], text=True).strip(),
    'selectedSource': selected_source,
    'compilerWarnings': [item for item in errors if str(item.get('severity', '')).lower() != 'error'],
    'compatibilityRuntimeSha256': hashlib.sha256(bytes.fromhex(runtime[2:])).hexdigest(),
    'compatibilityRuntimeBytes': (len(runtime) - 2) // 2,
    'storagePolicy': 'preserve existing live Ganache storage; replace runtime code only',
    'mainnetMutation': False
})
report_path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
PY
