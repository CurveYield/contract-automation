import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist', 'audit-web');
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
await fs.cp(path.join(root, 'apps', 'audit-web', 'public'), output, { recursive: true });
await fs.copyFile(path.join(root, 'apps', 'audit-web', 'src', 'client.mjs'), path.join(output, 'client.js'));
await fs.copyFile(path.join(root, 'apps', 'audit-web', 'src', 'view-model.mjs'), path.join(output, 'view-model.js'));
console.log(`Built separate Audit Pages site at ${output}`);
