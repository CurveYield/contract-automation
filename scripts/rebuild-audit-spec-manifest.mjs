import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'docs/audit/specifications-v2');
const manifestPath = path.join(directory, 'MANIFEST_v2.json');
const files = (await fs.readdir(directory))
  .filter((name) => name !== 'MANIFEST_v2.json')
  .sort();

const entries = [];
for (const file of files) {
  const bytes = await fs.readFile(path.join(directory, file));
  entries.push({
    file,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length
  });
}

const manifest = {
  schemaVersion: 'curveyield-audit-specification-manifest-v2',
  generatedAtUtc: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  files: entries,
  fileCount: entries.length
};

await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${path.relative(root, manifestPath)} with ${entries.length} entries.`);
