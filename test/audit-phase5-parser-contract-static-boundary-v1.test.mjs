import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_ROOT = path.join(ROOT, 'packages/audit-phase5-parsers/src');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : entry.name.endsWith('.mjs') ? [target] : [];
  }).sort();
}

const FORBIDDEN = Object.freeze([
  ['filesystem', /(?:node:)?(?:fs|fs\/promises)/],
  ['process execution', /(?:node:)?(?:child_process|worker_threads)|\b(?:spawn|execFile|execSync|fork)\s*\(/],
  ['network', /(?:node:)?(?:http|https|net|tls|dns|dgram)|\bfetch\s*\(|\bWebSocket\s*\(/],
  ['dynamic code', /\beval\s*\(|\bnew\s+Function\s*\(|\bvm\./],
  ['package/container execution', /\b(?:npm|pnpm|yarn|bun|docker|podman|ghcr\.io)\b/i],
  ['wallet/signing execution', /(?:from\s+['"](?:ethers|viem|web3|@solana)|require\(['"](?:ethers|viem|web3)|\b(?:signTransaction|sendTransaction|broadcastTransaction|deployContract|createWalletClient)\s*\()/i],
  ['AWS', /\bAWS\b|@aws-sdk|amazonaws\.com/i],
  ['CurveYield Lite', /curveyield[-_/ ]?lite/i],
  ['execution enablement', /AUDIT_EXECUTION_ENABLED\s*=\s*(?:true|1)|executionEnabled\s*:\s*true/]
]);

test('Phase 5 parser production source has no prohibited execution or external capability', () => {
  const files = sourceFiles(SOURCE_ROOT);
  assert.ok(files.length >= 7);
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const [label, pattern] of FORBIDDEN) {
      assert.doesNotMatch(source, pattern, `${path.relative(ROOT, file)} contains forbidden ${label} capability`);
    }
  }
});

test('Phase 5 parser production imports remain local or the stable audit protocol only', () => {
  for (const file of sourceFiles(SOURCE_ROOT)) {
    const source = fs.readFileSync(file, 'utf8');
    const specifiers = [...source.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)].map((match) => match[2]);
    for (const specifier of specifiers) {
      assert.ok(
        specifier.startsWith('./') || specifier.startsWith('../') || specifier === '../../audit-protocol/src/index.mjs',
        `${path.relative(ROOT, file)} imports non-local capability ${specifier}`
      );
      assert.doesNotMatch(specifier, /node:|https?:|data:|file:/);
    }
  }
});

test('changed parser implementation preserves execution-disabled vocabulary', () => {
  const joined = sourceFiles(SOURCE_ROOT).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(joined, /runnable\s*:\s*true|executorState\s*:\s*['"]available['"]|executionEnabled\s*:\s*true/);
});
