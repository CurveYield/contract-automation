import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const AUDIT_SPECIFICATION_FILES_V2 = Object.freeze([
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
]);

export async function buildAuditSpecificationManifest(directory) {
  const actualFiles = (await fs.readdir(directory))
    .filter((name) => name !== 'MANIFEST_v2.json')
    .sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(AUDIT_SPECIFICATION_FILES_V2)) {
    throw new Error(`Audit v2 specification inventory mismatch: expected ${AUDIT_SPECIFICATION_FILES_V2.length} canonical files, found ${actualFiles.length}`);
  }
  const entries = [];
  for (const file of AUDIT_SPECIFICATION_FILES_V2) {
    const bytes = await fs.readFile(path.join(directory, file));
    entries.push({
      file,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length
    });
  }
  return {
    schemaVersion: 'curveyield-audit-specification-manifest-v2',
    package: 'CurveYield Audit Current-Stack Specifications',
    version: 2,
    files: entries,
    fileCount: entries.length
  };
}

export async function writeAuditSpecificationManifest(rootDirectory) {
  const directory = path.join(rootDirectory, 'docs/audit/specifications-v2');
  const manifestPath = path.join(directory, 'MANIFEST_v2.json');
  const manifest = await buildAuditSpecificationManifest(directory);
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, manifestPath };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const root = path.resolve(path.dirname(modulePath), '..');
  const { manifest, manifestPath } = await writeAuditSpecificationManifest(root);
  console.log(`Wrote ${path.relative(root, manifestPath)} with ${manifest.fileCount} entries.`);
}
