import { ROUND4_EXTERNAL_QUARANTINE } from './quarantine.mjs';
import { ROUND4_ACCEPTED_STAGE_A_INPUTS_SOURCE } from './live-evidence-candidates.mjs';
import { ROUND4_LIVE_OWNERSHIP_SOURCE } from './live-evidence-ownership.mjs';
import { ROUND4_LIVE_GATES_SOURCE } from './live-evidence-gates.mjs';
import { ROUND4_WORKER0_INTAKE } from './live-evidence-intake-worker0.mjs';
import { ROUND4_WORKER1_PRODUCTION_INTAKE } from './live-evidence-intake-worker1-production.mjs';
import { ROUND4_WORKER1_SUPPORT_INTAKE } from './live-evidence-intake-worker1-support.mjs';
import { ROUND4_WORKER3_INTAKE } from './live-evidence-intake-worker3.mjs';
import { ROUND4_WORKER4_INTAKE } from './live-evidence-intake-worker4.mjs';

const SHA40 = /^[0-9a-f]{40}$/;
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}
function overlaps(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

export const ROUND4_ACCEPTED_STAGE_A_INPUTS = deepFreeze(ROUND4_ACCEPTED_STAGE_A_INPUTS_SOURCE);
export const ROUND4_LIVE_OWNERSHIP = deepFreeze(ROUND4_LIVE_OWNERSHIP_SOURCE);
export const ROUND4_DISJOINT_INTAKE = deepFreeze([
  ...ROUND4_WORKER0_INTAKE,
  ...ROUND4_WORKER1_PRODUCTION_INTAKE,
  ...ROUND4_WORKER1_SUPPORT_INTAKE,
  ...ROUND4_WORKER3_INTAKE,
  ...ROUND4_WORKER4_INTAKE
].sort((a, b) => a.path.localeCompare(b.path)));
export const ROUND4_LIVE_GATES = deepFreeze(ROUND4_LIVE_GATES_SOURCE);

function assertRegistry() {
  const seen = new Set();
  for (const item of ROUND4_DISJOINT_INTAKE) {
    if (typeof item.path !== 'string' || item.path.startsWith('/') || item.path.includes('//') || item.path.split('/').includes('..')) throw new Error(`unsafe intake path: ${item.path}`);
    if (!SHA40.test(item.blobSha) || !SHA40.test(item.sourceSha)) throw new Error(`invalid intake SHA: ${item.path}`);
    if (seen.has(item.path)) throw new Error(`duplicate intake path: ${item.path}`);
    seen.add(item.path);
  }
}

export function analyzeRound4LiveEvidence() {
  assertRegistry();
  const found = [];
  for (const item of ROUND4_DISJOINT_INTAKE) {
    for (const quarantinedPath of ROUND4_EXTERNAL_QUARANTINE.paths) {
      if (overlaps(item.path, quarantinedPath)) found.push({ intakePath: item.path, quarantinedPath });
    }
  }
  found.sort((a, b) => a.intakePath.localeCompare(b.intakePath) || a.quarantinedPath.localeCompare(b.quarantinedPath));
  return deepFreeze({
    schemaVersion: 'round4-live-evidence-analysis-v1',
    acceptedCandidateCount: ROUND4_ACCEPTED_STAGE_A_INPUTS.length,
    intakePathCount: ROUND4_DISJOINT_INTAKE.length,
    quarantinedPathCount: ROUND4_EXTERNAL_QUARANTINE.paths.length,
    overlapCount: found.length,
    overlaps: found,
    finalAssembledCandidateAuthorized: ROUND4_LIVE_GATES.finalAssembledCandidateAuthorized,
    unresolved: ROUND4_LIVE_GATES.unresolved
  });
}
