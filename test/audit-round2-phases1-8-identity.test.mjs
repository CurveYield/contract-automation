import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAuditId } from '../packages/audit-protocol/src/index.mjs';
import { PHASE4_PROFILE_IDS } from '../packages/audit-tool-profile-contracts/src/index.mjs';
import { parseToolOutput } from '../packages/audit-tool-parsers/src/index.mjs';
import { assertPhase4PackageCompatibility, validatePhase4ToolResult } from '../packages/audit-tool-result-contracts/src/index.mjs';
import { PHASE5_PROFILE_IDS, PHASE5_PROFILE_TEMPLATES } from '../packages/audit-phase5-profile-contracts/src/index.mjs';
import { parsePhase5ToolResult } from '../packages/audit-phase5-parsers/src/index.mjs';
import { validatePhase5ToolResult } from '../packages/audit-phase5-result-contracts/src/index.mjs';
import { assertPhase5PackageCompatibility, createPhase5ToolCatalog } from '../packages/audit-phase5-tool-catalog/src/index.mjs';
import { parseFormalObligationsBytes } from '../packages/audit-phase6-parsers/src/index.mjs';
import { createPhase6ToolResultEnvelope } from '../packages/audit-phase6-result-contracts/src/index.mjs';
import { assertPhase6PackageCompatibility, createPhase6ToolCatalog } from '../packages/audit-phase6-tool-catalog/src/index.mjs';
import { FREE_DEVELOPMENT_FORK_CAPABILITY, validateForkRequest } from '../packages/audit-fork-protocol/src/index.mjs';
import { InertForkMockAdapter } from '../packages/audit-fork-mock-adapter/src/index.mjs';
import { createCleanRoomPolicy } from '../packages/audit-clean-room-protocol/src/index.mjs';
import { createProvenanceEvent, validateProvenanceChain } from '../packages/audit-provenance/src/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/audit-round2-phases1-8/canonical-v1.json'), 'utf8'));
const bytes = (value) => new TextEncoder().encode(JSON.stringify(value));

test('Phase 1 identity grammar is preserved', () => {
  assert.equal(assertAuditId('ws_22222222222222222222222222222222', 'workspace'), 'ws_22222222222222222222222222222222');
  assert.throws(() => assertAuditId('bad', 'workspace'), (error) => error.code === 'invalid_id');
});

test('Phase 4 package identities and canonical compiler result are compatible', () => {
  assert.equal(PHASE4_PROFILE_IDS.length, 6);
  const result = parseToolOutput('solidity-compile-v1', fixture.phase4.compilerInput);
  assert.equal(result.exitClassification, 'success');
  assert.equal(validatePhase4ToolResult(result).profileId, 'solidity-compile-v1');
  const compatibility = assertPhase4PackageCompatibility();
  assert.equal(compatibility.compatible, true);
  assert.equal(compatibility.checkedTemplates, 6);
});

test('Phase 5 identities, lifecycle repair, catalog, and result contract align', () => {
  assert.deepEqual([...PHASE5_PROFILE_IDS].sort(), PHASE5_PROFILE_TEMPLATES.map((item) => item.profileId).sort());
  const success = validatePhase5ToolResult(parsePhase5ToolResult('hardhat-test-v1', fixture.phase5.hardhatInput));
  assert.equal(success.classification, 'success');
  const exhausted = validatePhase5ToolResult(parsePhase5ToolResult('hardhat-test-v1', fixture.phase5.resourceExhaustion));
  assert.equal(exhausted.classification, 'resource_exhaustion');
  assert.equal(exhausted.exitCode, null);
  assert.equal(createPhase5ToolCatalog().length, 4);
  assert.equal(assertPhase5PackageCompatibility().compatible, true);
});

test('Phase 6 trusted capture, result envelope, and catalog share exact identities', () => {
  const result = parseFormalObligationsBytes(bytes(fixture.phase6.capture));
  assert.equal(result.outcome, 'proved');
  const envelope = createPhase6ToolResultEnvelope('formal-obligations-v1', result);
  assert.equal(envelope.toolVersion, '1.0.0');
  assert.equal(envelope.trustedProducer, 'curveyield-formal-capture-producer-v1');
  const catalog = createPhase6ToolCatalog();
  assert.equal(catalog.entries.length, 3);
  assert.equal(assertPhase6PackageCompatibility({ catalog, results: [envelope] }).compatible, true);
});

test('Phase 7 request contract and inert adapter remain execution-disabled', async () => {
  const request = validateForkRequest(fixture.phase7.request);
  assert.equal(request.executionGate, 'trusted_mock');
  assert.equal(FREE_DEVELOPMENT_FORK_CAPABILITY.executionEnabled, false);
  const adapter = new InertForkMockAdapter();
  const result = await adapter.handle({ schemaVersion: 'fork-mock-request-v1', operation: 'create', forkId: request.forkId, chainId: request.chainId, blockNumber: request.blockNumber, timestamp: 1, seed: 'round2', mode: 'success' });
  assert.equal(result.status, 'ready');
  assert.equal(result.result.executionEnabled, false);
});

test('Phase 8 policy and provenance identities are deterministic and execution-disabled', () => {
  const policy = createCleanRoomPolicy(fixture.phase8.policy);
  assert.match(policy.policyDigest, /^sha256:[0-9a-f]{64}$/);
  const first = createProvenanceEvent({ eventId: 'event-1', sequence: 1, tenantId: policy.tenantId, workspaceId: policy.workspaceId, campaignId: null, subjectType: 'policy', subjectId: policy.policyId, subjectDigest: policy.policyDigest, action: 'published', actorId: 'worker-2', policyId: policy.policyId, previousDigest: null, occurredAt: fixture.phase8.policy.issuedAt });
  const chain = validateProvenanceChain([first]);
  assert.equal(chain.headDigest, first.eventDigest);
  assert.equal(chain.executionEnabled, false);
});
