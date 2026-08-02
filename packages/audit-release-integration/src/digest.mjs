import { createHash } from 'node:crypto';
import { canonicalJson } from './boundary.mjs';
export function digestOf(value) { return createHash('sha256').update(canonicalJson(value)).digest('hex'); }
