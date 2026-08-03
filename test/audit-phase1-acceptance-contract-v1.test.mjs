import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  AUDIT_SPECIFICATION_FILES_V2,
  buildAuditSpecificationManifest
} from '../scripts/rebuild-audit-spec-manifest.mjs';

const root = new URL('../', import.meta.url);

test('Phase 1 owns one deterministic hash-verified Audit v2 manifest', async () => {
  const directory = new URL('docs/audit/specifications-v2/', root);
  const manifest = JSON.parse(await fs.readFile(new URL('MANIFEST_v2.json', directory), 'utf8'));
  assert.deepEqual(Object.keys(manifest), ['schemaVersion', 'package', 'version', 'files', 'fileCount']);
  assert.equal(manifest.schemaVersion, 'curveyield-audit-specification-manifest-v2');
  assert.equal(manifest.package, 'CurveYield Audit Current-Stack Specifications');
  assert.equal(manifest.version, 2);
  assert.equal(manifest.fileCount, 22);
  assert.deepEqual(manifest.files.map((entry) => entry.file), AUDIT_SPECIFICATION_FILES_V2);
  for (const entry of manifest.files) {
    assert.deepEqual(Object.keys(entry), ['file', 'sha256', 'bytes']);
    const bytes = await fs.readFile(new URL(entry.file, directory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.file);
    assert.equal(bytes.byteLength, entry.bytes, entry.file);
  }
});

test('Phase 1 manifest generator is stable and rejects inventory drift', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-phase1-manifest-v2-'));
  for (const file of AUDIT_SPECIFICATION_FILES_V2) {
    await fs.writeFile(path.join(directory, file), `fixture:${file}\n`);
  }
  assert.deepEqual(
    await buildAuditSpecificationManifest(directory),
    await buildAuditSpecificationManifest(directory)
  );
  await fs.writeFile(path.join(directory, 'UNEXPECTED.md'), 'drift\n');
  await assert.rejects(() => buildAuditSpecificationManifest(directory), /inventory mismatch/i);
});

test('Phase 1 exposes the canonical root Audit script contract', async () => {
  const pkg = JSON.parse(await fs.readFile(new URL('package.json', root), 'utf8'));
  assert.equal(pkg.scripts['audit:test'], 'node --test apps/audit-*/test/*.test.mjs packages/audit-*/test/*.test.mjs test/audit-*.test.mjs');
  assert.equal(pkg.scripts['audit:lint'], 'node scripts/check.mjs');
  assert.equal(pkg.scripts['audit:build'], 'node scripts/build-audit.mjs');
  assert.equal(pkg.scripts['test:audit'], 'npm run audit:test');
  assert.equal(pkg.scripts['build:audit'], 'npm run audit:build');
});

test('Phase 1 documents only approved persistent identities and keeps execution disabled', async () => {
  const wrangler = await fs.readFile(new URL('apps/audit-api/wrangler.toml', root), 'utf8');
  for (const name of [
    'AUDIT_CLIENT_API_KEY',
    'AUDIT_GPT_API_KEY',
    'AUDIT_EDGE_CONTROL_PLANE_TOKEN',
    'AUDIT_ATTESTATION_PRIVATE_KEY'
  ]) {
    assert.match(wrangler, new RegExp(name));
  }
  assert.doesNotMatch(wrangler, /AUDIT_(?:READ|SUBMIT|ADMIN)_API_KEY|AUDIT_INTERNAL_SERVICE_KEY/);
  assert.match(wrangler, /AUDIT_EXECUTION_ENABLED = "false"/);
  assert.doesNotMatch(wrangler, /binding = "AUDIT_CONTROL_STORE"/);
});
