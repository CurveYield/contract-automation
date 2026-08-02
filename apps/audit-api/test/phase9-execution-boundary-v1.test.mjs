import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PHASE4_PROFILE_CATALOG } from '../../../packages/audit-tool-catalog/src/index.mjs';
import {
  createAcceptedPhase5Catalog,
  createAcceptedPhase6Catalog,
  createAuditCatalogComposition
} from '../../../packages/audit-catalog-composition/src/index.mjs';
import { auditPhase9Capabilities } from '../src/phase9-gpt.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const productionFiles = [
  'packages/audit-api-contracts/src/index.mjs',
  'packages/audit-api-contracts/src/discovery.mjs',
  'packages/audit-api-contracts/src/status.mjs',
  'packages/audit-catalog-composition/src/index.mjs',
  'apps/audit-api/src/phase4-catalog.mjs',
  'apps/audit-api/src/phase5-catalog.mjs',
  'apps/audit-api/src/phase6-catalog.mjs',
  'apps/audit-api/src/phase9-reports.mjs',
  'apps/audit-api/src/phase9-gpt.mjs',
  'apps/audit-api/src/entry.mjs'
];
const forbidden = [
  /node:(?:child_process|worker_threads|cluster|net|http|https|http2|tls|dgram|dns|vm)/u,
  /(?<![.\w])(?:spawn|spawnSync|exec|execFile|execSync|fork)\s*\(/u,
  /\b(?:eval|Function)\s*\(/u,
  /\bWebAssembly\b/u,
  /\b(?:XMLHttpRequest|WebSocket|EventSource)\b/u,
  /\bglobalThis\.fetch\b/u,
  /\b(?:npm|pnpm|yarn|bun|pip|cargo)\s+(?:install|add|run)\b/u,
  /\b(?:docker|podman|containerd|kubectl)\b/u,
  /\b(?:eth_sendTransaction|eth_sendRawTransaction|sendTransaction|signTransaction|broadcastTransaction)\b/u,
  /\b(?:privateKeyToAccount|walletClient|mnemonicToAccount)\b/u,
  /\b(?:deployContract|writeContract|sendRawTransaction)\b/u,
  /\bexecutionEnabled\s*:\s*true\b/u,
  /\brunnable\s*:\s*true\b/u,
  /\b(?:triggerWorkflow|workflow_dispatch|pull_request_target)\b/u,
  /\bCurveYield\s+Lite\b/u,
  /from\s+['"][^'"]*(?:lite|github-native-sim|rpc-method-policy)[^'"]*['"]/iu
];

test('owned production sources expose no process, network, RPC, wallet, deployment, dynamic-code, package-install, workflow, or execution-enablement capability', async () => {
  const matches = [];
  for (const relative of productionFiles) {
    const source = await readFile(resolve(root, relative), 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(source)) matches.push({ relative, pattern: String(pattern) });
    }
  }
  assert.deepEqual(matches, []);
});

test('all composed catalog entries and aggregate capabilities remain explicitly inert', () => {
  const catalog = createAuditCatalogComposition({
    phase4Profiles: PHASE4_PROFILE_CATALOG.profiles
  });
  assert.equal(catalog.entries.length, 13);
  for (const profile of catalog.entries) {
    assert.equal(profile.executionEnabled, false);
    assert.equal(profile.runnable, false);
    assert.equal(profile.executorState, 'unavailable');
    assert.equal(profile.digest, null);
  }
  for (const profile of [
    ...createAcceptedPhase5Catalog(),
    ...createAcceptedPhase6Catalog()
  ]) {
    assert.equal(profile.executionEnabled, false);
    assert.equal(profile.runnable, false);
  }
  const capabilities = auditPhase9Capabilities({
    executionEnabled: true,
    executionState: 'enabled',
    executorState: 'available'
  });
  assert.equal(capabilities.executionEnabled, false);
  assert.equal(capabilities.executionState, 'awaiting_executor');
  assert.equal(capabilities.executorState, 'unavailable');
});
