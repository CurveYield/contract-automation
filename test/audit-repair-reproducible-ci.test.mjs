import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const workflowPaths = [
  '.github/workflows/audit-test.yml',
  '.github/workflows/audit-deploy-dry-run.yml'
];

test('repository commits an npm v3 lockfile matching pinned root dependencies', async () => {
  const lock = JSON.parse(await fs.readFile(new URL('package-lock.json', root), 'utf8'));
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.packages[''].dependencies.ethers, '6.15.0');
  assert.equal(lock.packages[''].dependencies.ganache, '7.9.2');
  assert.equal(lock.packages[''].dependencies.solc, '0.8.30');
  assert.equal(lock.packages[''].dependencies.tar, '7.4.3');
  assert.equal(lock.packages[''].dependencies.unzipper, '0.12.3');
  assert.equal(lock.packages[''].devDependencies.wrangler, '4.116.0');
});

test('Audit workflows use npm ci and immutable action commit SHAs', async () => {
  for (const relative of workflowPaths) {
    const text = await fs.readFile(new URL(relative, root), 'utf8');
    assert.match(text, /npm ci --ignore-scripts --no-audit --no-fund/, relative);
    assert.doesNotMatch(text, /npm install/, relative);
    assert.match(text, /uses:\s*actions\/checkout@[0-9a-f]{40}/, relative);
    assert.match(text, /uses:\s*actions\/setup-node@[0-9a-f]{40}/, relative);
    assert.doesNotMatch(text, /uses:\s*actions\/(?:checkout|setup-node)@v\d+/, relative);
    assert.match(text, /- "package-lock\.json"/, relative);
  }
});
