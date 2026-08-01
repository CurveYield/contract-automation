import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const SOURCE = new URL('../packages/audit-tool-result-contracts/src/index.mjs', import.meta.url);

async function sourceText() {
  return readFile(SOURCE, 'utf8');
}

test('production result-contract source imports no filesystem, process, network, container, package-manager, Lite, or dynamic-code primitive', async () => {
  const source = await sourceText();
  const forbidden = [
    /node:fs|node:fs\/promises|readFile|writeFile|readdir|opendir|createReadStream|createWriteStream/,
    /node:child_process|\bspawn\s*\(|\bexec(?:File)?\s*\(|\bfork\s*\(/,
    /\bfetch\s*\(|XMLHttpRequest|WebSocket|node:http|node:https|rpc/i,
    /docker|podman|containerd|\bnpm\b|\bpnpm\b|\byarn\b|packageManager/i,
    /\beval\s*\(|new\s+Function|WebAssembly/,
    /CurveYield[\s_-]*Lite|curveyield-lite|\/lite\//i,
    /AUDIT_EXECUTION_ENABLED\s*=\s*['"]?true|executionEnabled\s*:\s*true/,
    /privateKey|mnemonic|wallet|signer|transaction|calldata|broadcast|credential/i
  ];
  for (const pattern of forbidden) assert.doesNotMatch(source, pattern);
});

test('production package imports only accepted stable Phase 4 contracts', async () => {
  const source = await sourceText();
  const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]).sort();
  assert.deepEqual(imports, [
    '../../audit-executor-adapters/src/index.mjs',
    '../../audit-protocol/src/index.mjs',
    '../../audit-tool-parsers/src/index.mjs',
    '../../audit-tool-profile-contracts/src/index.mjs'
  ].sort());
});

test('public exports contain validation only and no execution-like operation', async () => {
  const source = await sourceText();
  const exports = [...source.matchAll(/export\s+(?:function|const|class)\s+([A-Za-z0-9_]+)/g)].map((match) => match[1]);
  assert.deepEqual(exports.sort(), [
    'PHASE4_RESULT_CONTRACT_SCHEMA_VERSION',
    'assertPhase4PackageCompatibility',
    'validatePhase4ResultForPlan',
    'validatePhase4ToolResult'
  ].sort());
  for (const name of exports) assert.doesNotMatch(name, /submit|execute|run|spawn|install|fetch|network/i);
});
