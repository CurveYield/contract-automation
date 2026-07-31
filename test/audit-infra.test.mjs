import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('Audit workflows are secret-free, non-executing, and isolated from Lite', async () => {
  const files = ['.github/workflows/audit-test.yml', '.github/workflows/audit-deploy-dry-run.yml'];
  for (const file of files) {
    const text = await read(file);
    assert.match(text, /node-version: ["']?22/);
    assert.doesNotMatch(text, /PREFLIGHTSIM_|RPC_|simulate\.yml|preflightsim-lite-runner|workflow_call:|repository_dispatch:/);
    assert.doesNotMatch(text, /secrets\./);
    assert.doesNotMatch(text, /docker:\s|container:\s|curl\s+\|\s*(?:sh|bash)/);
  }
  assert.match(await read('.github/workflows/audit-deploy-dry-run.yml'), /--dry-run/);
});

test('Audit Worker and R2 lifecycle remain separate and execution disabled', async () => {
  const wrangler = await read('apps/audit-api/wrangler.toml');
  assert.match(wrangler, /name = "curveyield-audit-api"/);
  assert.match(wrangler, /AUDIT_EXECUTION_ENABLED = "false"/);
  assert.match(wrangler, /binding = "AUDIT_NONCE_STORE"/);
  assert.match(wrangler, /bucket_name = "curveyield-audit-control"/);
  assert.doesNotMatch(wrangler, /curveyield-preflight|PREFLIGHTSIM/);

  const lifecycle = JSON.parse(await read('infra/audit-cloudflare/r2-lifecycle.json'));
  const rules = new Map(lifecycle.Rules.map((rule) => [rule.Filter.Prefix, rule.Expiration.Days]));
  assert.equal(rules.get('audit/ingress/'), 1);
  assert.equal(rules.get('audit/logs/raw/'), 7);
  assert.equal(rules.get('audit/source/'), 30);
  assert.equal(rules.get('audit/layers/'), 30);
  assert.equal(rules.get('audit/evidence/'), 30);
  assert.equal(rules.get('audit/reports/'), 30);
  assert.equal(rules.get('audit/forks/active/'), 1);
  assert.equal(rules.get('audit/exports/'), 7);
  assert.doesNotMatch(JSON.stringify(lifecycle), /Infrequent|Transition|DataCatalog|SQL/i);
});

test('Audit static build produces a separate output without altering Lite assets', async () => {
  const script = await read('scripts/build-audit.mjs');
  assert.match(script, /dist.*audit-web/s);
  assert.match(script, /apps.*audit-web/s);
  assert.doesNotMatch(script, /apps['"], ['"]web|dist['"], ['"]web/);
});

test('v2 current-stack specifications are complete and hash-verified', async () => {
  const directory = path.join(root, 'docs/audit/specifications-v2');
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'MANIFEST_v2.json'), 'utf8'));
  assert.equal(manifest.version, 2);
  assert.equal(manifest.package, 'CurveYield Audit Current-Stack Specifications');
  assert.equal(manifest.files.length, 22);
  const mismatches = [];
  for (const entry of manifest.files) {
    const bytes = await fs.readFile(path.join(directory, entry.file));
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== entry.sha256) {
      mismatches.push({ file: entry.file, expected: entry.sha256, actual, actualBytes: bytes.byteLength });
    }
  }
  assert.deepEqual(mismatches, []);
  const usage = await read('docs/audit/specifications-v2/18_R2_FUNCTION_USAGE_TABLE_v2.csv');
  assert.equal(usage.trim().split('\n').length - 1, 34);
  const scope = await read('docs/audit/specifications-v2/00_README_AND_GOVERNING_SCOPE_v2.md');
  assert.match(scope, /AWS and every other unselected infrastructure provider are outside scope/);
});
