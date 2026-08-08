import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist', 'web');
const execution = path.join(output, 'execution');

await fs.rm(path.join(root, 'dist'), { recursive: true, force: true });
await fs.mkdir(execution, { recursive: true });

await fs.cp(path.join(root, 'apps', 'web', 'public'), execution, { recursive: true });
await fs.cp(path.join(root, 'apps', 'web', 'tier3'), output, { recursive: true });

await fs.copyFile(path.join(root, 'apps', 'web', 'src', 'client.mjs'), path.join(execution, 'client.js'));
await fs.copyFile(path.join(root, 'apps', 'web', 'src', 'client.mjs'), path.join(output, 'client.js'));
await fs.copyFile(path.join(root, 'apps', 'web', 'src', 'controller-view-v2.mjs'), path.join(output, 'controller-view.js'));
await fs.copyFile(path.join(root, 'apps', 'web', 'src', 'controller-detail-model-v1.mjs'), path.join(output, 'controller-detail-model-v1.mjs'));

console.log(`Built Tier 3 Pages root at ${output} with accepted Lite execution at ${execution}`);
