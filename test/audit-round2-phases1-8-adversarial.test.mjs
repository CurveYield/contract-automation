import test from 'node:test';
import assert from 'node:assert/strict';
import { scanAuditForbiddenFields } from '../packages/audit-protocol/src/index.mjs';
import { parseToolOutput } from '../packages/audit-tool-parsers/src/index.mjs';
import { validatePhase4ToolResult } from '../packages/audit-tool-result-contracts/src/index.mjs';
import { parsePhase5ToolResult } from '../packages/audit-phase5-parsers/src/index.mjs';
import { validatePhase5ToolResult } from '../packages/audit-phase5-result-contracts/src/index.mjs';
import { parseFormalObligationsBytes } from '../packages/audit-phase6-parsers/src/index.mjs';
import { createPhase6ToolResultEnvelope } from '../packages/audit-phase6-result-contracts/src/index.mjs';
import { validateForkTransition, validateForkRequest } from '../packages/audit-fork-protocol/src/index.mjs';
import { createCleanRoomPolicy } from '../packages/audit-clean-room-protocol/src/index.mjs';

const bytes = (value) => new TextEncoder().encode(JSON.stringify(value));
const phase4 = () => parseToolOutput('solidity-compile-v1', { resultJson: '{"contracts":{},"errors":[]}', stdout: '', stderr: '', exitCode: 0, durationMs: 1, terminationReason: 'completed' });
const phase6Base = () => ({
  schemaVersion: 'formal-obligations-capture-v1', trustedProducer: 'curveyield-formal-capture-producer-v1', profileId: 'formal-obligations-v1', toolVersion: '1.0.0', outcome: 'disproved',
  obligations: [{id:'obl_1',kind:'invariant',expression:'x > 0',assertionIds:['assert_1'],sourceReferenceIds:['src_1']}],
  assertions: [{id:'assert_1',expression:'x > 0',description:null,sourceReferenceIds:['src_1']}],
  models: [{id:'model_1',entries:[{name:'x',type:'uint256',value:'0'}]}], traces: [{id:'trace_1',steps:[]}],
  counterexamples: [{id:'cex_1',obligationId:'obl_1',failingAssertionIds:['assert_1'],modelIds:['model_1'],traceIds:['trace_1'],summary:'counterexample'}],
  diagnostics: [], sourceReferences: [{id:'src_1',sourceId:'contracts/A.sol',startLine:1,startColumn:0,endLine:1,endColumn:1}], parserWarnings: [], truncated: false
});

test('forbidden recursive capabilities are rejected', () => {
  assert.throws(() => scanAuditForbiddenFields({ nested: { privateKey: 'x' } }), (error) => error.code === 'forbidden_field');
});

test('Phase 4 hostile accessors are rejected without executing the getter', () => {
  const value = structuredClone(phase4());
  let executed = false;
  Object.defineProperty(value, 'evil', { enumerable: true, get() { executed = true; return true; } });
  assert.throws(() => validatePhase4ToolResult(value), (error) => error.code === 'accessor_property');
  assert.equal(executed, false);
});

test('Phase 4 lifecycle and parser identity substitutions fail deterministically', () => {
  const lifecycle = structuredClone(phase4()); lifecycle.exitClassification = 'timeout';
  assert.throws(() => validatePhase4ToolResult(lifecycle), (error) => error.code === 'lifecycle_mismatch');
  const parser = structuredClone(phase4()); parser.parserVersion = 'slither-parser-v1';
  assert.throws(() => validatePhase4ToolResult(parser), (error) => error.code === 'profile_parser_mismatch');
});

test('Phase 5 terminal exit-code drift is repaired and later substitution is rejected', () => {
  const parsed = parsePhase5ToolResult('hardhat-test-v1', { resultJson: '{}', exitCode: 137, durationMs: 1, termination: 'resource_exhaustion' });
  assert.equal(parsed.exitCode, null);
  const drift = structuredClone(parsed); drift.exitCode = 137;
  assert.throws(() => validatePhase5ToolResult(drift), (error) => error.code === 'lifecycle_mismatch');
});

test('Phase 6 dangling references and conflicting identities remain bounded parser errors', () => {
  const dangling = phase6Base(); dangling.counterexamples[0].modelIds = ['missing'];
  const danglingResult = parseFormalObligationsBytes(bytes(dangling));
  assert.equal(danglingResult.outcome, 'parser_error');
  assert.equal(danglingResult.diagnostics[0].code, 'dangling_reference');

  const conflict = phase6Base(); conflict.assertions.push({...conflict.assertions[0], expression:'x >= 0'});
  const conflictResult = parseFormalObligationsBytes(bytes(conflict));
  assert.equal(conflictResult.outcome, 'parser_error');
  assert.equal(conflictResult.diagnostics[0].code, 'conflicting_duplicate');
});

test('Phase 6 clean proof cannot be substituted with counterexample evidence', () => {
  const result = parseFormalObligationsBytes(bytes({...phase6Base(), outcome:'proved'}));
  assert.equal(result.outcome, 'proved');
  assert.throws(() => createPhase6ToolResultEnvelope('formal-obligations-v1', result), (error) => error.code === 'outcome_evidence_mismatch');
});

test('Phase 7 invalid transitions and external trusted-mock substitution are rejected', () => {
  assert.throws(() => validateForkTransition('ready', 'awaiting_executor'), (error) => error.code === 'invalid_transition');
  const request = {
    schemaVersion:'fork-request-v1',tenantId:'ten_11111111111111111111111111111111',workspaceId:'ws_22222222222222222222222222222222',campaignId:'cmp_33333333333333333333333333333333',forkId:'fork_44444444444444444444444444444444',attemptId:'att_55555555555555555555555555555555',profileId:'free-development-v1',policyVersion:'fork-policy-v1',requesterId:'worker-2',scopes:['audit:submit'],chainId:1,blockNumber:1,adapterKind:'external',executionGate:'trusted_mock',createdAt:'2026-08-01T16:00:00.000Z',idempotencyKey:'x'
  };
  assert.throws(() => validateForkRequest(request), (error) => error.code === 'invalid_execution_gate');
});

test('Phase 8 custom prototypes and invalid clean-room limits are rejected', () => {
  const hostile = Object.create({ inherited: true });
  Object.assign(hostile, {tenantId:'t',workspaceId:'w',allowedScopes:['campaign:read'],maxCampaigns:1,maxMergeInputs:2,maxFindings:1,maxEvidence:1,maxRelations:1,maxBytes:1,retentionDays:1,issuedAt:'2026-08-01T16:00:00.000Z'});
  assert.throws(() => createCleanRoomPolicy(hostile), (error) => error.code === 'invalid_plain_object');
  assert.throws(() => createCleanRoomPolicy({tenantId:'t',workspaceId:'w',allowedScopes:['campaign:read'],maxCampaigns:0,maxMergeInputs:2,maxFindings:1,maxEvidence:1,maxRelations:1,maxBytes:1,retentionDays:1,issuedAt:'2026-08-01T16:00:00.000Z'}), (error) => error.code === 'invalid_integer');
});
