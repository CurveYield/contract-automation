import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAMPAIGN_OPERATION_BUDGETS,
  JOB_STATES,
  MAX_EVENT_BATCH_EVENTS,
  MAX_LOG_CHUNK_BYTES,
  MAX_LOG_CHUNKS_PER_ATTEMPT,
  TERMINAL_JOB_STATES
} from '../../packages/audit-campaign-protocol/src/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');

const EXPECTED_BUDGETS = Object.freeze({
  createCampaign: { classA: 3, classB: 2, storageBytes: 64_000 },
  submitJob: { classA: 5, classB: 3, storageBytes: 128_000 },
  claimAttempt: { classA: 3, classB: 3, storageBytes: 64_000 },
  heartbeat: { classA: 1, classB: 1, storageBytes: 0 },
  eventBatch: { classA: 1, classB: 0, storageBytes: 256_000 },
  logChunk: { classA: 2, classB: 1, storageBytes: 1_000_000 },
  readTypicalLogs: { classA: 0, classB: 9, storageBytes: 0 },
  rawArtifacts: { classA: 2, classB: 0, storageBytes: 15_000_000 },
  acceptEvidence: { classA: 4, classB: 1, storageBytes: 10_000_000 },
  publishReport: { classA: 3, classB: 0, storageBytes: 1_000_000 },
  completeJob: { classA: 3, classB: 2, storageBytes: 32_000 },
  pollJob: { classA: 0, classB: 1, storageBytes: 0 }
});

test('Phase 3 lifecycle, terminal states, limits, and R2 budgets match the approved v2 design', () => {
  assert.deepEqual(JOB_STATES, ['submitted','validating','admitted','queued','awaiting_executor','provisioning','running','collecting_evidence','completed','failed','cancelled','timed_out','policy_rejected']);
  assert.deepEqual(TERMINAL_JOB_STATES, ['completed','failed','cancelled','timed_out','policy_rejected']);
  assert.equal(MAX_EVENT_BATCH_EVENTS, 32);
  assert.equal(MAX_LOG_CHUNK_BYTES, 1_000_000);
  assert.equal(MAX_LOG_CHUNKS_PER_ATTEMPT, 64);
  assert.deepEqual(CAMPAIGN_OPERATION_BUDGETS, EXPECTED_BUDGETS);
});

test('public job submission stops at awaiting_executor and never provisions', async () => {
  const campaigns = await read('packages/audit-campaigns/src/index.mjs');
  const api = await read('apps/audit-api/src/phase3.mjs');
  assert.match(campaigns, /state:\s*'awaiting_executor'/);
  assert.match(campaigns, /executionEnabled:\s*false/);
  assert.match(campaigns, /execution_plane_unavailable/);
  assert.match(api, /executionEnabled:\s*false/);
  assert.match(api, /executionState:\s*'awaiting_executor'/);
  assert.doesNotMatch(api, /queue\.send|dispatchWorkflow|child_process|spawn\s*\(|exec\s*\(/);
});

test('trusted fixture continuation is internal, replay protected, and disabled by Wrangler default', async () => {
  const phase3 = await read('apps/audit-api/src/phase3.mjs');
  const wrangler = await read('apps/audit-api/wrangler.toml');
  assert.match(phase3, /AUDIT_TRUSTED_FIXTURE_ENABLED\s*!==\s*'true'/);
  assert.match(phase3, /x-audit-timestamp/);
  assert.match(phase3, /x-audit-nonce/);
  assert.match(phase3, /x-audit-signature/);
  assert.match(phase3, /etagDoesNotMatch:\s*'\*'/);
  assert.doesNotMatch(wrangler, /AUDIT_TRUSTED_FIXTURE_ENABLED/);
});

test('campaign state uses server-read ETag-protected objects and no listing', async () => {
  const campaigns = await read('packages/audit-campaigns/src/index.mjs');
  assert.match(campaigns, /jobStatusKey/);
  assert.match(campaigns, /campaignJobIndexKey/);
  assert.match(campaigns, /await this\.store\.get\(jobStatusKey/);
  assert.match(campaigns, /etagMatches/);
  assert.match(campaigns, /etagDoesNotMatch/);
  assert.doesNotMatch(campaigns, /currentStatus/);
  assert.doesNotMatch(campaigns, /ListObjects|\.list\s*\(/);
});

test('logs bind chunks to authoritative status and remain bundled deterministic objects', async () => {
  const evidence = await read('packages/audit-evidence/src/index.mjs');
  for (const required of ['jobStatusKey','logChunkKey','rawArtifactBundleKey','rawArtifactManifestKey','evidenceQuarantineKey','evidenceAcceptedKey','evidenceManifestKey','evidenceAttestationKey','reportBundleKey','reportManifestKey','reportIndexKey']) {
    assert.match(evidence, new RegExp(`\\b${required}\\b`), required);
  }
  assert.match(evidence, /highestLogSequence\s*\+\s*1/);
  assert.match(evidence, /attempt_mismatch/);
  assert.match(evidence, /MAX_RAW_ARTIFACT_BYTES\s*=\s*64_000_000/);
  assert.match(evidence, /MAX_EVIDENCE_BUNDLE_BYTES\s*=\s*50_000_000/);
  assert.match(evidence, /MAX_REPORT_BUNDLE_BYTES\s*=\s*10_000_000/);
  assert.doesNotMatch(evidence, /ListObjects|\.list\s*\(|writeFile|mkdir|extractTo|extractAll|child_process|spawn\s*\(|exec\s*\(/);
});

test('browser exposes only public metadata operations', async () => {
  const client = await read('apps/audit-web/src/client.mjs');
  for (const expected of ['createCampaign','getCampaign','submitCampaignJob','getJob','cancelJob','resumeJob','getJobLogs','getJobReports']) assert.match(client, new RegExp(`async ${expected}\\(`));
  assert.doesNotMatch(client, /claimAttempt|appendLogChunk|acceptEvidence|publishRawArtifacts|publishReport|listR2Objects|putR2Object|executeJob|runCommand|broadcastTransaction|setRpcUrl/);
});
