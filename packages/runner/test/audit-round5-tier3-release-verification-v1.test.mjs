import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = readFileSync(path.join(root, '.github/workflows/tier3-release-verification-v1.yml'), 'utf8');

function has(pattern) { assert.match(workflow, pattern); }

test('release verifier runs only on the accepted Round 5 release branch and posts to dedicated issue 173', () => {
  has(/branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  has(/gh issue comment 173/);
  assert.doesNotMatch(workflow, /TIER3_PRODUCTION_DEPLOY_REQUEST|workflow_dispatch/);
});

test('dependency-free job enforces accepted Lite/API boundary and current v16.14 tests', () => {
  has(/git diff --exit-code[^\n]*apps\/web\/public apps\/api\/src\/index\.mjs/);
  has(/packages\/protocol\/test\/tier3-controller-v3\.test\.mjs/);
  has(/apps\/api\/test\/controller-adapter-v3\.test\.mjs/);
  has(/apps\/api\/test\/controller-command-adapter-v2\.test\.mjs/);
  has(/apps\/api\/test\/controller-entry-v3\.test\.mjs/);
  has(/apps\/web\/test\/controller-view-v3\.test\.mjs/);
  has(/packages\/runner\/test\/audit-round5-tier3-clean-build-v3\.test\.mjs/);
  has(/packages\/runner\/test\/audit-round5-tier3-production-deploy-v4\.test\.mjs/);
});

test('authorized build job installs dependencies then runs full tests lint build and current build verification', () => {
  has(/needs:\s*no-install/);
  has(/npm install --ignore-scripts --no-audit --no-fund/);
  has(/npm test/);
  has(/npm run lint/);
  has(/npm run build/);
  has(/audit-round5-tier3-clean-build-v3\.test\.mjs/);
});

test('release verifier has no deployment, controller mutation, explicit Solidity compiler, wallet or broadcast command', () => {
  assert.doesNotMatch(workflow, /wrangler|cloudflare\.com|secret bulk|pages deploy|r2 bucket|\/issues\/\$?\{?[^\n]*comments/i);
  assert.doesNotMatch(workflow, /^\s*(forge|hardhat|solc)\b/m);
  assert.doesNotMatch(workflow, /sendTransaction|signTransaction|private key|seed phrase/i);
});
