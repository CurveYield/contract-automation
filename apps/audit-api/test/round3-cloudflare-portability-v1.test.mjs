import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const productionFiles = Object.freeze([
  'packages/audit-api-contracts/src/index.mjs',
  'packages/audit-api-contracts/src/authorization.mjs',
  'packages/audit-api-contracts/src/discovery.mjs',
  'packages/audit-api-contracts/src/status.mjs',
  'packages/audit-catalog-composition/src/index.mjs',
  'apps/audit-api/src/phase4-catalog.mjs',
  'apps/audit-api/src/phase5-catalog.mjs',
  'apps/audit-api/src/phase6-catalog.mjs',
  'apps/audit-api/src/phase9-reports.mjs',
  'apps/audit-api/src/phase9-gpt.mjs',
  'apps/audit-api/src/entry.mjs'
]);
const forbidden = Object.freeze([
  /from\s+['"]node:/u,
  /require\s*\(/u,
  /\bBuffer\b/u,
  /\bprocess\s*\./u,
  /\b(?:Deno|Bun)\s*\./u,
  /\b(?:child_process|worker_threads|cluster|filesystem|socket)\b/iu,
  /\b(?:XMLHttpRequest|WebSocket|EventSource)\b/u,
  /\bglobalThis\.fetch\b/u,
  /(?<![.\w])fetch\s*\(/u,
  /\b(?:eval|Function)\s*\(/u,
  /\bWebAssembly\b/u,
  /\b(?:npm|pnpm|yarn|bun|pip|cargo)\s+(?:install|add|run)\b/iu,
  /\b(?:docker|podman|containerd|kubectl)\b/iu,
  /\b(?:eth_sendTransaction|eth_sendRawTransaction|sendTransaction|signTransaction|broadcastTransaction)\b/u,
  /\b(?:privateKeyToAccount|walletClient|mnemonicToAccount|deployContract|writeContract)\b/u,
  /\bexecutionEnabled\s*:\s*true\b/u,
  /\brunnable\s*:\s*true\b/u,
  /from\s+['"][^'"]*(?:github-native-sim|rpc-method-policy|fork-rpc-guard|curveyield-lite)[^'"]*['"]/iu
]);

test('all owned production modules use no Node-only, filesystem, process, socket, network, dynamic-code, wallet, deployment, or execution-enablement primitive', async () => {
  const matches = [];
  for (const relative of productionFiles) {
    const source = await readFile(resolve(root, relative), 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(source)) matches.push({ relative, pattern: String(pattern) });
    }
  }
  assert.deepEqual(matches, []);
});

test('runtime import graph stays within Web-compatible Audit contracts, catalog packages, and existing Phase 1-3 composition', async () => {
  const edges = [];
  for (const relative of productionFiles) {
    const source = await readFile(resolve(root, relative), 'utf8');
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/gu)) {
      const specifier = match[1];
      edges.push([relative, specifier]);
      assert.equal(specifier.startsWith('node:'), false, `${relative} -> ${specifier}`);
      assert.equal(/(?:github-native-sim|rpc-method-policy|fork-rpc-guard|curveyield-lite)/iu.test(specifier), false);
    }
  }
  assert.ok(edges.length > 0);
});

test('required runtime primitives are standard Web APIs available without Node compatibility imports', () => {
  assert.equal(typeof TextEncoder, 'function');
  assert.equal(typeof TextDecoder, 'function');
  assert.equal(typeof crypto?.subtle?.digest, 'function');
  assert.equal(typeof URL, 'function');
  assert.equal(typeof Request, 'function');
  assert.equal(typeof Response, 'function');
  assert.equal(typeof Headers, 'function');
  assert.equal(typeof structuredClone, 'function');
  assert.equal(typeof btoa, 'function');
  assert.equal(typeof atob, 'function');
});

test('production modules do not import test fixtures, local host paths, or production credentials', async () => {
  const findings = [];
  for (const relative of productionFiles) {
    const source = await readFile(resolve(root, relative), 'utf8');
    for (const pattern of [
      /test\/fixtures/iu,
      /(?:C:\\Users\\|\/home\/|\/Users\/|\/tmp\/)/u,
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
      /\b(?:sk_live|ghp_|github_pat_)\w+/u
    ]) if (pattern.test(source)) findings.push({ relative, pattern: String(pattern) });
  }
  assert.deepEqual(findings, []);
});
