import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(here, '../src');
const sourceFiles = fs.readdirSync(sourceDir).filter((name) => name.endsWith('.mjs')).sort();
const sources = sourceFiles.map((name) => [name, fs.readFileSync(path.join(sourceDir, name), 'utf8')]);

test('production imports remain restricted to deterministic accepted packages', () => {
  for (const [name, source] of sources) {
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      assert.match(match[1], /^(\.\/|\.\.\/\.\.\/(audit-protocol|audit-tool-parsers|audit-tool-profile-contracts|audit-executor-adapters)\/src\/index\.mjs$)/, `${name}: ${match[1]}`);
    }
    assert.doesNotMatch(source, /\bimport\s*\(/, `${name}: dynamic import`);
  }
});

test('production source has no filesystem, process, network, dynamic-code, package, container, or external execution capability', () => {
  const joined = sources.map(([, source]) => source).join('\n');
  const prohibited = [
    /node:(?:fs|child_process|http|https|net|dgram|tls|vm|worker_threads)/,
    /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/,
    /\b(?:eval|Function)\s*\(/,
    /\bnew\s+Function\b/,
    /\b(?:spawn|spawnSync|exec|execFile|fork)\s*\(/,
    /\bprocess\s*\./,
    /\b(?:Deno|Bun)\s*\./,
    /\b(?:readFile|writeFile|readdir|opendir|createReadStream|createWriteStream)\s*\(/,
    /\b(?:docker|podman|kubernetes|kubectl|npm|pnpm|yarn)\b/i,
    /\b(?:privateKey|mnemonic|seedPhrase|wallet|signer|signature|calldata|broadcast)\b/i,
    /\b(?:rpcEndpoint|rpcUrl|imageName|binaryPath|commandLine|scriptPath)\b/i,
    /AUDIT_EXECUTION_ENABLED\s*=\s*true/i,
    /executionEnabled\s*:\s*true/,
    /CurveYield\s+Lite/i
  ];
  for (const pattern of prohibited) assert.doesNotMatch(joined, pattern, String(pattern));
});

test('production package exposes no file-backed or execution-like public function', async () => {
  const api = await import('../src/index.mjs');
  const publicFunctions = Object.entries(api).filter(([, value]) => typeof value === 'function').map(([name]) => name).sort();
  assert.deepEqual(publicFunctions, [
    'assertPhase4FixtureInventory',
    'assertPhase4PackageCompatibility',
    'serializePhase4ToolResultDocumentation',
    'validatePhase4ResultForPlan',
    'validatePhase4ToolResult'
  ]);
  for (const name of publicFunctions) assert.doesNotMatch(name, /(?:execute|spawn|install|compile|deploy|fetch|read|write|upload|download|broadcast)/i, name);
});
