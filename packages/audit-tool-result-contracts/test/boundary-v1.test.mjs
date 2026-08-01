import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(here, '../src');

test('production result-contract source remains static, deterministic, and non-executing', () => {
  const source = fs.readdirSync(sourceDir).filter((name) => name.endsWith('.mjs')).sort().map((name) => fs.readFileSync(path.join(sourceDir, name), 'utf8')).join('\n').toLowerCase();
  const prohibited = [
    'node:fs', 'node:child_process', 'node:http', 'node:https', 'node:net', 'node:dgram', 'node:vm',
    'fetch(', 'xmlhttprequest', 'websocket', 'eval(', 'new function', 'spawn(', 'exec(', 'fork(',
    'docker', 'podman', 'npm ', 'pnpm ', 'yarn ', 'bun ', 'curl ', 'wget ',
    'privatekey', 'mnemonic', 'seedphrase', 'wallet', 'signer', 'calldata', 'broadcast',
    'curveyield lite', 'audit_execution_enabled=true'
  ];
  for (const token of prohibited) assert.equal(source.includes(token), false, token);
});

test('production imports are restricted to accepted validation packages', () => {
  const files = fs.readdirSync(sourceDir).filter((name) => name.endsWith('.mjs'));
  for (const name of files) {
    const source = fs.readFileSync(path.join(sourceDir, name), 'utf8');
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      assert.match(match[1], /^(\.\/|\.\.\/\.\.\/(audit-protocol|audit-tool-parsers|audit-tool-profile-contracts|audit-executor-adapters)\/src\/index\.mjs$)/, `${name}: ${match[1]}`);
    }
  }
});
