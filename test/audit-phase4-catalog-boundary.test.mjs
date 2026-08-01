import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const catalogSourceUrl = new URL('../packages/audit-tool-catalog/src/index.mjs', import.meta.url);
const apiSourceUrl = new URL('../apps/audit-api/src/phase4-catalog.mjs', import.meta.url);
const entrySourceUrl = new URL('../apps/audit-api/src/entry.mjs', import.meta.url);

async function source(url) { return readFile(url, 'utf8'); }

test('catalog and API source do not import parser, Lite, executor, process, container, network, or package-manager primitives', async () => {
  const combined = `${await source(catalogSourceUrl)}\n${await source(apiSourceUrl)}`;
  const forbidden = [
    /audit-tool-parsers/i,
    /curveyield[-_/ ]?lite/i,
    /audit-executor-adapters/i,
    /node:(?:child_process|cluster|dgram|http|https|net|tls|worker_threads)/,
    /(?:docker|podman|containerd|kubernetes)/i,
    /(?:npm|pnpm|yarn|bun)\s+(?:install|add|exec|run)/i,
    /\bfetch\s*\(/,
    /\bspawn\s*\(/,
    /\bexec(?:File)?\s*\(/
  ];
  for (const pattern of forbidden) assert.doesNotMatch(combined, pattern);
});

test('public request handler accepts no arbitrary body, URL, RPC, image, binary, wallet, key, signing, transaction, or broadcast field', async () => {
  const api = await source(apiSourceUrl);
  assert.doesNotMatch(api, /request\.(?:json|text|arrayBuffer|formData)\s*\(/);
  assert.doesNotMatch(api, /(?:rpcUrl|registryUrl|imageName|imageTag|binary|wallet|privateKey|signer|rawTransaction|signedTransaction|broadcast)\s*[:=]/i);
});

test('entry composition exposes the Phase 4 handler without replacing existing campaign/job behavior', async () => {
  const entry = await source(entrySourceUrl);
  assert.match(entry, /handlePhase4CatalogRequest/);
  assert.match(entry, /const phase4Response = await handlePhase4CatalogRequest\(request, runtimeEnv\)/);
  assert.match(entry, /if \(phase4Response\) return phase4Response/);
  assert.match(entry, /auditPhase4Health\(\)/);
  assert.match(entry, /auditPhase4Capabilities\(auditPhase3Capabilities\(env\)\)/);
  assert.match(entry, /const response = await worker\.fetch\(request, runtimeEnv\)/);
  assert.ok(
    entry.indexOf('handlePhase4CatalogRequest(request, runtimeEnv)') < entry.indexOf('worker.fetch(request, runtimeEnv)'),
    'Phase 4 read-only routes must be handled before existing service delegation'
  );
});
