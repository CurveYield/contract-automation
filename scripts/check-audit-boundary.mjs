import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const LITE_BASELINE_SHA256 = Object.freeze({
  'apps/api/src/index.mjs': '76f5c249208164b1cf01add810b88009ecaa2ba146e5c978ed2b4ae0140b3552',
  '.github/workflows/simulate.yml': '5a39983d28d94dc8313ae7a908f5a352004bdbe070ac3259f91d3c03b33f4fb2',
  'packages/runner/src/api-client.mjs': 'e08c336c7672d3bf2633294f1c0030cb37ccb99c242158fee5f84e85c28882eb',
  'packages/protocol/src/index.mjs': '0b91d0726239408975b3c6aaedc6a123880c4abe43c5a0b7dedfe0b495d202ce',
  'infra/r2-lifecycle.json': '3a9826fadce24eda439732367ac88bdb8193f11ff4a63f7a32601aa0fe21ba40',
  'apps/web/src/client.mjs': '57cdc3e77dc37c421fd9f9a79c06401d1d813416b5a68d0767caf05ae1a6a9c7'
});

const AUDIT_CODE_ROOTS = [
  'apps/audit-api/src',
  'apps/audit-web/src',
  'apps/audit-web/public',
  'packages/audit-protocol/src',
  'packages/audit-r2-store/src'
];
const LITE_ROOTS = [
  'apps/api',
  'apps/web',
  'packages/runner',
  'packages/protocol'
];
const AUDIT_WORKFLOWS = [
  '.github/workflows/audit-test.yml',
  '.github/workflows/audit-deploy-dry-run.yml'
];
const LITE_FILES = [
  '.github/workflows/simulate.yml',
  '.github/workflows/deploy.yml',
  'infra/r2-lifecycle.json',
  'infra/r2-cors.json'
];
const TEXT_EXTENSIONS = new Set(['.mjs', '.js', '.json', '.html', '.css', '.toml', '.yml', '.yaml']);

async function exists(relative) {
  try { await fs.access(path.join(root, relative)); return true; }
  catch { return false; }
}

async function read(relative) {
  return fs.readFile(path.join(root, relative), 'utf8');
}

async function walk(relative) {
  const absolute = path.join(root, relative);
  if (!(await exists(relative))) return [];
  const output = [];
  for (const entry of await fs.readdir(absolute, { withFileTypes: true })) {
    const child = path.posix.join(relative.replaceAll('\\', '/'), entry.name);
    if (entry.isDirectory()) output.push(...await walk(child));
    else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name))) output.push(child);
  }
  return output;
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function addMatch(violations, relative, text, pattern, message) {
  if (pattern.test(text)) violations.push(`${relative}: ${message}`);
}

export async function checkAuditBoundary() {
  const violations = [];
  const auditFiles = (await Promise.all(AUDIT_CODE_ROOTS.map(walk))).flat();
  const liteFiles = [...new Set([...(await Promise.all(LITE_ROOTS.map(walk))).flat(), ...LITE_FILES])];

  for (const [relative, expected] of Object.entries(LITE_BASELINE_SHA256)) {
    if (!(await exists(relative))) {
      violations.push(`${relative}: verified Lite baseline file is missing`);
      continue;
    }
    const actual = sha256(await read(relative));
    if (actual !== expected) violations.push(`${relative}: Lite baseline changed (${actual} != ${expected})`);
  }

  for (const relative of auditFiles) {
    const text = await read(relative);
    addMatch(violations, relative, text, /packages\/runner|from\s+['"][^'"]*\/runner(?:\/|['"])/i, 'Audit code imports or references the Lite runner');
    addMatch(violations, relative, text, /PREFLIGHTSIM_|RPC_(?:ETHEREUM|BASE|KATANA|FRAXTAL|ARBITRUM|POLYGON|OPTIMISM)|curveyield-preflight/i, 'Audit code references a Lite secret, RPC name, or resource');
    addMatch(violations, relative, text, /(?:^|[^-])\/api\/v1\/|\/internal\/v1\//, 'Audit production code references a Lite API namespace');
  }

  for (const relative of ['apps/audit-api/src', 'apps/audit-web/src', 'apps/audit-web/public']) {
    for (const file of await walk(relative)) {
      const text = await read(file);
      addMatch(violations, file, text, /ListObjects|\.list\s*\(/, 'Audit hot-path code uses a billed bucket-list operation');
    }
  }

  const protocol = await read('packages/audit-protocol/src/index.mjs');
  for (const key of [
    'shell', 'command', 'script', 'dockerfile', 'workflowfile', 'image', 'binary',
    'plugin', 'packagemanagercommand', 'url', 'rpcurl', 'privatekey', 'mnemonic',
    'signer', 'rawtransaction', 'signedtransaction', 'walletmethod', 'privileged', 'broadcast'
  ]) {
    if (!protocol.toLowerCase().includes(`'${key}'`)) violations.push(`packages/audit-protocol/src/index.mjs: forbidden key ${key} is not enforced`);
  }

  const capabilities = await read('packages/audit-protocol/src/index.mjs');
  if (!/executionEnabled:\s*false/.test(capabilities)) violations.push('packages/audit-protocol/src/index.mjs: execution is not hard-disabled');
  const wrangler = await read('apps/audit-api/wrangler.toml');
  if (!/AUDIT_EXECUTION_ENABLED\s*=\s*"false"/.test(wrangler)) violations.push('apps/audit-api/wrangler.toml: deployment does not default execution to false');
  if (/curveyield-preflight|PREFLIGHTSIM_/.test(wrangler)) violations.push('apps/audit-api/wrangler.toml: Audit Worker reuses a Lite resource');
  if (!/bucket_name\s*=\s*"curveyield-audit-control"/.test(wrangler)) violations.push('apps/audit-api/wrangler.toml: separate Audit R2 bucket is not bound');

  const workflowGroups = new Set();
  for (const relative of AUDIT_WORKFLOWS) {
    const text = await read(relative);
    addMatch(violations, relative, text, /PREFLIGHTSIM_|RPC_|simulate\.yml|preflightsim-lite-runner|curveyield-preflight/i, 'Audit workflow references a Lite secret, workflow, group, or resource');
    addMatch(violations, relative, text, /\$\{\{\s*secrets\./, 'Phase 1 Audit verification unexpectedly requires a repository secret');
    if (!/npm run audit:boundary/.test(text)) violations.push(`${relative}: workflow does not run the boundary checker`);
    for (const line of text.split('\n')) {
      const match = line.match(/^\s*group:\s*(.+)$/);
      if (!match) continue;
      const group = match[1].trim();
      if (workflowGroups.has(group)) violations.push(`${relative}: duplicate Audit workflow concurrency group ${group}`);
      workflowGroups.add(group);
    }
    for (const line of text.split('\n')) {
      if (/wrangler\s+deploy/.test(line) && !/--dry-run/.test(line)) violations.push(`${relative}: contains a real Worker deployment rather than a dry run`);
    }
  }

  for (const relative of liteFiles) {
    const text = await read(relative);
    addMatch(violations, relative, text, /AUDIT_|curveyield-audit|apps\/audit-|packages\/audit-|\/audit\/v1|\/audit-internal\/v1/i, 'Lite code or workflow references the Audit tier');
  }

  const lifecycle = JSON.parse(await read('infra/audit-cloudflare/r2-lifecycle.json'));
  if (!Array.isArray(lifecycle.Rules) || lifecycle.Rules.length < 8) violations.push('infra/audit-cloudflare/r2-lifecycle.json: required prefix lifecycle rules are missing');
  if (/Transition|Infrequent|DataCatalog|R2 SQL/i.test(JSON.stringify(lifecycle))) violations.push('infra/audit-cloudflare/r2-lifecycle.json: unsupported paid R2 feature is configured');

  return Object.freeze({
    ok: violations.length === 0,
    violations: Object.freeze(violations),
    checkedAuditModules: auditFiles.length,
    checkedLiteFiles: liteFiles.length,
    checkedAuditWorkflows: AUDIT_WORKFLOWS.length
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await checkAuditBoundary();
  if (!result.ok) {
    for (const violation of result.violations) console.error(`BOUNDARY VIOLATION: ${violation}`);
    process.exitCode = 1;
  } else {
    console.log(`Audit boundary valid: ${result.checkedAuditModules} Audit modules, ${result.checkedLiteFiles} Lite files, ${result.checkedAuditWorkflows} Audit workflows checked`);
  }
}
