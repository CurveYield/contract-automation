import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const SOURCE_DIR = new URL('../packages/audit-tool-result-contracts/src/', import.meta.url);

async function sourceFiles() {
  return (await readdir(SOURCE_DIR)).filter((name) => name.endsWith('.mjs')).sort();
}
async function sourceText() {
  const names = await sourceFiles();
  return (await Promise.all(names.map((name) => readFile(new URL(name, SOURCE_DIR), 'utf8')))).join('\n');
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

test('production package imports only local modules and accepted stable Phase 4 contracts', async () => {
  const source = await sourceText();
  const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
  const external = imports.filter((value) => value.startsWith('../')).sort();
  const local = imports.filter((value) => value.startsWith('./')).sort();
  assert.deepEqual(external, [
    '../../audit-executor-adapters/src/index.mjs',
    '../../audit-protocol/src/index.mjs',
    '../../audit-protocol/src/index.mjs',
    '../../audit-tool-parsers/src/index.mjs',
    '../../audit-tool-parsers/src/index.mjs',
    '../../audit-tool-profile-contracts/src/index.mjs'
  ].sort());
  for (const value of local) assert.match(value, /^\.\/[a-z0-9-]+-v1\.mjs$/);
});

test('public exports contain validation and immutable contract metadata only', async () => {
  const module = await import('../packages/audit-tool-result-contracts/src/index.mjs');
  assert.deepEqual(Object.keys(module).sort(), [
    'PHASE4_COMPATIBILITY_CONTRACT_VERSION',
    'PHASE4_FIXTURE_INVENTORY',
    'PHASE4_RESULT_CONTRACT_SCHEMA_VERSION',
    'PHASE4_TOOL_RESULT_CONTRACT_VERSION',
    'assertPhase4FixtureInventory',
    'assertPhase4PackageCompatibility',
    'validatePhase4ResultForPlan',
    'validatePhase4ToolResult'
  ].sort());
  for (const name of Object.keys(module)) assert.doesNotMatch(name, /submit|execute|run|spawn|install|fetch|network/i);
});
