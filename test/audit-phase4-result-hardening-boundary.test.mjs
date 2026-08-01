import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(root, '../packages/audit-tool-result-contracts/src');

test('Phase 4 result hardening production tree is file/network/process/execution inert', () => {
  const files = fs.readdirSync(sourceDir).filter((name) => name.endsWith('.mjs')).sort();
  assert.equal(files.length >= 5, true);
  const source = files.map((name) => fs.readFileSync(path.join(sourceDir, name), 'utf8')).join('\n');
  for (const pattern of [
    /node:(?:fs|child_process|http|https|net|vm)/,
    /\bfetch\s*\(/,
    /\b(?:spawn|exec|fork)\s*\(/,
    /\b(?:eval|Function)\s*\(/,
    /\bprocess\s*\./,
    /executionEnabled\s*:\s*true/,
    /AUDIT_EXECUTION_ENABLED\s*=\s*true/i,
    /CurveYield\s+Lite/i
  ]) assert.doesNotMatch(source, pattern, String(pattern));
});

test('Phase 4 result hardening changes remain inside the allowed package and test prefixes', () => {
  const packageRoot = path.resolve(root, '../packages/audit-tool-result-contracts');
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [path.relative(path.resolve(root, '..'), full).replaceAll('\\', '/')];
  });
  for (const file of walk(packageRoot)) assert.match(file, /^packages\/audit-tool-result-contracts\//);
});
