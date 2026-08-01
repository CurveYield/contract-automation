import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  auditRuntimeReadiness,
  mapApprovedAuditRuntimeEnv
} from '../apps/audit-api/src/runtime.mjs';

const root = new URL('../', import.meta.url);
const expectedFiles = [
  '00_README_AND_GOVERNING_SCOPE_v2.md',
  '01_CURRENT_STACK_AND_LITE_BOUNDARY_v2.md',
  '02_TARGET_ARCHITECTURE_CURRENT_STACK_v2.md',
  '03_PHASE_ROADMAP_v2.md',
  '04_PHASE_1_BOUNDARY_LOCK_AND_SCAFFOLD_v2.md',
  '05_PHASE_2_R2_WORKSPACES_AND_PROFILE_REGISTRY_v2.md',
  '06_PHASE_3_R2_CAMPAIGNS_JOBS_LOGS_EVIDENCE_v2.md',
  '07_PHASES_4_TO_6_TOOL_PROFILE_INTEGRATIONS_v2.md',
  '08_PHASE_7_PERSISTENT_FORK_INTERFACE_v2.md',
  '09_PHASE_8_CLEAN_ROOM_CAMPAIGNS_v2.md',
  '10_PHASE_9_WEB_REPORTS_GITHUB_INTEGRATIONS_v2.md',
  '11_PHASE_10_CURRENT_STACK_PRODUCTION_HARDENING_v2.md',
  '12_R2_OBJECT_MODEL_AND_OPERATION_RULES_v2.md',
  '13_R2_FUNCTION_USAGE_AND_FREE_TIER_CAPACITY_v2.md',
  '14_SECRETS_AND_IDENTITIES_CURRENT_STACK_v2.md',
  '15_EXTERNAL_HARDENED_COMPUTE_DEFERRED_INTERFACE_v2.md',
  '16_TESTING_AND_ACCEPTANCE_v2.md',
  '17_CAPABILITY_TRACEABILITY_v2.md',
  '18_R2_FUNCTION_USAGE_TABLE_v2.csv',
  '19_R2_USAGE_ASSUMPTIONS_v2.json',
  '20_R2_AGGREGATE_SCENARIOS_v2.csv',
  'SOURCES_v2.md'
];

function store() {
  return { async get() { return null; }, async put() { return {}; } };
}
function approvedEnv() {
  return {
    AUDIT_CLIENT_API_KEY: 'c'.repeat(32),
    AUDIT_GPT_API_KEY: 'g'.repeat(32),
    AUDIT_EDGE_CONTROL_PLANE_TOKEN: 'e'.repeat(32),
    AUDIT_ATTESTATION_PRIVATE_KEY: 'a'.repeat(32),
    AUDIT_NONCE_STORE: store(),
    AUDIT_CONTROL_STORE: store()
  };
}

test('committed v2 manifest uses one deterministic canonical contract', async () => {
  const directory = new URL('docs/audit/specifications-v2/', root);
  const manifest = JSON.parse(await fs.readFile(new URL('MANIFEST_v2.json', directory), 'utf8'));
  assert.deepEqual(Object.keys(manifest), ['schemaVersion', 'package', 'version', 'files', 'fileCount']);
  assert.equal(manifest.schemaVersion, 'curveyield-audit-specification-manifest-v2');
  assert.equal(manifest.package, 'CurveYield Audit Current-Stack Specifications');
  assert.equal(manifest.version, 2);
  assert.equal(manifest.fileCount, 22);
  assert.deepEqual(manifest.files.map((entry) => entry.file), expectedFiles);
  for (const entry of manifest.files) {
    assert.deepEqual(Object.keys(entry), ['file', 'sha256', 'bytes']);
    const bytes = await fs.readFile(new URL(entry.file, directory));
    const { createHash } = await import('node:crypto');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.file);
    assert.equal(bytes.byteLength, entry.bytes, entry.file);
  }
});

test('manifest generator rejects inventory drift and produces stable output', async () => {
  const { AUDIT_SPECIFICATION_FILES_V2, buildAuditSpecificationManifest } = await import('../scripts/rebuild-audit-spec-manifest.mjs');
  assert.deepEqual(AUDIT_SPECIFICATION_FILES_V2, expectedFiles);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-manifest-v2-'));
  for (const file of expectedFiles) await fs.writeFile(path.join(directory, file), `fixture:${file}\n`);
  assert.deepEqual(await buildAuditSpecificationManifest(directory), await buildAuditSpecificationManifest(directory));
  await fs.writeFile(path.join(directory, 'UNEXPECTED.md'), 'drift');
  await assert.rejects(() => buildAuditSpecificationManifest(directory), /inventory/i);
});

test('approved identities provide least-privilege runtime mappings without legacy secrets', async () => {
  const env = approvedEnv();
  const mapped = mapApprovedAuditRuntimeEnv(env);
  const readiness = auditRuntimeReadiness(mapped);
  assert.equal(readiness.coreReady, true);
  assert.equal(readiness.configuration.clientKey, true);
  assert.equal(readiness.configuration.gptKey, true);
  assert.equal(readiness.configuration.edgeControlKey, true);
  assert.equal('readKey' in readiness.configuration, false);
  assert.equal(mapped.AUDIT_ADMIN_API_KEY, env.AUDIT_CLIENT_API_KEY);
  assert.equal(mapped.AUDIT_SUBMIT_API_KEY, env.AUDIT_GPT_API_KEY);
  assert.equal(mapped.AUDIT_INTERNAL_SERVICE_KEY, env.AUDIT_EDGE_CONTROL_PLANE_TOKEN);

  const api = await fs.readFile(new URL('apps/audit-api/src/index.mjs', root), 'utf8');
  assert.match(api, /AUDIT_SUBMIT_API_KEY, scopes: \['audit:read', 'audit:submit'\]/);
  assert.match(api, /AUDIT_ADMIN_API_KEY, scopes: \['audit:read', 'audit:submit', 'audit:admin'\]/);
  assert.doesNotMatch(api, /AUDIT_INTERNAL_SERVICE_KEY, scopes:/);
});

test('public Phase 2 schemas reject caller-authored tenant and layer indexes', async () => {
  const source = await fs.readFile(new URL('apps/audit-api/src/index.mjs', root), 'utf8');
  assert.doesNotMatch(source, /['"]tenantIndex['"]/);
  assert.doesNotMatch(source, /['"]layerIndex['"]/);
});

test('root package exposes canonical Audit scripts with deterministic targets', async () => {
  const pkg = JSON.parse(await fs.readFile(new URL('package.json', root), 'utf8'));
  assert.equal(pkg.scripts['audit:test'], 'node --test apps/audit-*/test/*.test.mjs packages/audit-*/test/*.test.mjs test/audit-*.test.mjs');
  assert.equal(pkg.scripts['audit:lint'], 'node scripts/check.mjs');
  assert.equal(pkg.scripts['audit:build'], 'node scripts/build-audit.mjs');
  assert.equal(pkg.scripts['test:audit'], 'npm run audit:test');
  assert.equal(pkg.scripts['build:audit'], 'npm run audit:build');
});

test('Wrangler documents only approved persistent Audit identities and keeps execution disabled', async () => {
  const wrangler = await fs.readFile(new URL('apps/audit-api/wrangler.toml', root), 'utf8');
  for (const name of ['AUDIT_CLIENT_API_KEY', 'AUDIT_GPT_API_KEY', 'AUDIT_EDGE_CONTROL_PLANE_TOKEN', 'AUDIT_ATTESTATION_PRIVATE_KEY']) {
    assert.match(wrangler, new RegExp(name));
  }
  assert.doesNotMatch(wrangler, /AUDIT_(?:READ|SUBMIT|ADMIN)_API_KEY|AUDIT_INTERNAL_SERVICE_KEY/);
  assert.match(wrangler, /AUDIT_EXECUTION_ENABLED = "false"/);
});
