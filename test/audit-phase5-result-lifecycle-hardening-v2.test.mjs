import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhase5ToolResult } from '../packages/audit-phase5-result-contracts/src/index.mjs';
import { parsePhase5ToolResult } from '../packages/audit-phase5-parsers/src/index.mjs';
import { parseFixture, parseLifecycle, clone, assertCodePath } from './audit-phase5-compatibility-helpers-v2.mjs';

test('accepted timeout and cancellation parser envelopes validate exactly', () => {
  for (const name of ['timeout-v1.json','cancellation-v1.json']) {
    const parsed=parseLifecycle(name);
    assert.deepEqual(validatePhase5ToolResult(parsed), parsed);
    assert.equal(parsed.exitCode,null);
    for (const key of ['hardhatTests','echidnaProperties','mutationResults','dependencyFindings','evidence','artifacts','parserErrors']) assert.deepEqual(parsed[key],[]);
    assert.deepEqual(parsed.summary,{});
  }
});

test('resource exhaustion requires null exit code and exposes the accepted parser mismatch', () => {
  const parsed=parseLifecycle('resource-exhaustion-v1.json');
  assert.equal(parsed.classification,'resource_exhaustion');
  assert.equal(parsed.exitCode,137, 'accepted parser currently preserves raw process exit code');
  assertCodePath(assert,()=>validatePhase5ToolResult(parsed),'lifecycle_mismatch','$.exitCode');
  const repairedEnvelope={...parsed,exitCode:null};
  assert.deepEqual(validatePhase5ToolResult(repairedEnvelope),repairedEnvelope);
});

test('accepted malformed and parser-error envelopes validate', () => {
  for (const args of [
    ['malformed-output-v1.txt','hardhat-test-v1',1,'completed','malformed_output'],
    ['parser-error-unsafe-path-v1.json','hardhat-test-v1',0,'completed','parser_error'],
    ['mutation-conflicting-duplicates-v2.json','mutation-v1',1,'completed','parser_error'],
    ['dependency-conflicting-duplicates-v2.json','dependency-scan-v1',1,'completed','parser_error']
  ]) {
    const parsed=parseFixture(...args.slice(0,4));
    assert.equal(parsed.classification,args[4]);
    assert.deepEqual(validatePhase5ToolResult(parsed),parsed);
  }
});

test('invalid profile sentinel remains fixed, bounded, and validates', () => {
  const parsed=parsePhase5ToolResult('x'.repeat(100_000),{resultBytes:'{}',exitCode:0,durationMs:1,termination:'completed'});
  assert.equal(parsed.profileId,'invalid-profile-v1');
  assert.equal(parsed.parserVersion,'unknown-parser-v1');
  assert.equal(parsed.classification,'parser_error');
  assert.equal(parsed.parserErrors[0].code,'invalid_profile_id');
  assert.ok(JSON.stringify(parsed).length<3000);
  assert.deepEqual(validatePhase5ToolResult(parsed),parsed);
});

test('classification and lifecycle contradictions fail with stable paths', () => {
  const success=parseFixture('hardhat-success-v1.json','hardhat-test-v1',0);
  assertCodePath(assert,()=>validatePhase5ToolResult({...success,exitCode:null}),'lifecycle_mismatch','$.exitCode');
  assertCodePath(assert,()=>validatePhase5ToolResult({...success,classification:'findings'}),'classification_mismatch','$.classification');
  assertCodePath(assert,()=>validatePhase5ToolResult({...success,artifacts:[{}]}),'artifact_mismatch','$.artifacts');
  const findings=parseFixture('hardhat-findings-v1.json','hardhat-test-v1',1);
  assertCodePath(assert,()=>validatePhase5ToolResult({...findings,classification:'success'}),'classification_mismatch','$.classification');
  const timeout=parseLifecycle('timeout-v1.json');
  assertCodePath(assert,()=>validatePhase5ToolResult({...timeout,evidence:[{schemaVersion:'phase5-parser-evidence-v1',type:'hardhat-test-summary',recordCount:0}]}),'lifecycle_mismatch','$.evidence');
  assertCodePath(assert,()=>validatePhase5ToolResult({...timeout,hardhatTests:[success.hardhatTests[0]]}),'lifecycle_mismatch','$.hardhatTests');
  const malformed=parseFixture('malformed-output-v1.txt','hardhat-test-v1',1);
  assertCodePath(assert,()=>validatePhase5ToolResult({...malformed,parserErrors:[]}),'classification_mismatch','$.parserErrors');
  assertCodePath(assert,()=>validatePhase5ToolResult({...malformed,parserErrors:[...malformed.parserErrors,...malformed.parserErrors]}),'classification_mismatch','$.parserErrors');
});
