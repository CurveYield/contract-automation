import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preserved = Object.freeze({
  '.github/workflows/github-native-simulate.yml': 'c6312e071401acdd6554bacfe753f3791b6d1502',
  'packages/runner/src/rpc-method-policy.mjs': '59dfa72f41a697d533720a4d8f939a81aeba6736',
  'packages/runner/src/fork-rpc-guard.mjs': '73690f16b506baa50ca471ce5b5566ccb601e765',
  'packages/runner/src/run-job.mjs': '6c61203ce69fa4c2f317807ea477cc27e1d2df81',
  'packages/github-native-sim/src/fork-rpc-proxy.mjs': '4d7e2bd1114f5a37914b26447c9c79a1e40a58e6',
  'packages/github-native-sim/src/run-job-file.mjs': '8c4c82d76e249b74efc630c8cbf0d7707d25b5f2'
});
const productionRoots = [
  'packages/audit-protocol','packages/audit-r2-store','packages/audit-profile-registry','packages/audit-workspace-protocol','packages/audit-workspaces','packages/audit-campaign-protocol','packages/audit-campaigns','packages/audit-evidence',
  'packages/audit-tool-profile-contracts','packages/audit-tool-parsers','packages/audit-executor-adapters','packages/audit-tool-result-contracts',
  'packages/audit-phase5-profile-contracts','packages/audit-phase5-parsers','packages/audit-phase5-result-contracts','packages/audit-phase5-tool-catalog',
  'packages/audit-phase6-profile-contracts','packages/audit-phase6-parsers','packages/audit-phase6-result-contracts','packages/audit-phase6-tool-catalog',
  'packages/audit-fork-protocol','packages/audit-fork-mock-adapter','packages/audit-forks',
  'packages/audit-clean-room-protocol','packages/audit-clean-room-access','packages/audit-clean-room-campaigns','packages/audit-controlled-merge','packages/audit-provenance'
];
function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
function gitBlobSha(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`);
  return crypto.createHash('sha1').update(header).update(bytes).digest('hex');
}

test('protected current-main GitHub-native and RPC files remain byte-identical', () => {
  for (const [relative, expected] of Object.entries(preserved)) {
    const bytes = fs.readFileSync(path.join(root, relative));
    assert.equal(gitBlobSha(bytes), expected, relative);
  }
});

test('reconstructed production modules contain no execution or network capability imports/calls', () => {
  const prohibited = [
    /from\s+['"]node:(?:child_process|cluster|dgram|dns|http|https|net|tls|vm|worker_threads)['"]/,
    /require\(['"](?:child_process|cluster|dgram|dns|http|https|net|tls|vm|worker_threads)['"]\)/,
    /\bfetch\s*\(/,
    /\bWebSocket\s*\(/,
    /\b(?:spawn|spawnSync|exec|execFile|execFileSync|fork)\s*\(/,
    /\beval\s*\(/,
    /new\s+Function\s*\(/,
    /\b(?:npm|pnpm|yarn|bun|docker|podman|kubectl)\s+(?:install|run|exec|build|pull|push)\b/,
    /audit_execution_enabled\s*=\s*true/i
  ];
  const scanned = productionRoots.flatMap((relative) => files(path.join(root, relative))).filter((name) => name.endsWith('.mjs'));
  assert.equal(scanned.length > 20, true);
  for (const file of scanned) {
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of prohibited) assert.equal(pattern.test(source), false, `${path.relative(root, file)}: ${pattern}`);
  }
});

test('no reconstructed production module imports GitHub-native, runner, workflow, web, Lite, or deployment paths', () => {
  const scanned = productionRoots.flatMap((relative) => files(path.join(root, relative))).filter((name) => name.endsWith('.mjs'));
  const forbiddenImports = /(github-native-sim|packages\/runner|\.github\/workflows|apps\/audit-web|curveyield lite|deployment|infrastructure)/i;
  for (const file of scanned) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.equal(forbiddenImports.test(match[1]), false, `${path.relative(root, file)} -> ${match[1]}`);
  }
});
