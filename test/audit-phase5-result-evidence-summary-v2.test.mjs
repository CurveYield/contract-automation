import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhase5ToolResult } from '../packages/audit-phase5-result-contracts/src/index.mjs';
import { parseFixture, clone, assertCodePath } from './audit-phase5-compatibility-helpers-v2.mjs';

const normal=[
 ['hardhat-success-v1.json','hardhat-test-v1',0],['hardhat-findings-v1.json','hardhat-test-v1',1],
 ['echidna-success-v1.json','echidna-v1',0],['echidna-findings-v1.json','echidna-v1',1],
 ['mutation-success-v1.json','mutation-v1',0],['mutation-findings-v1.json','mutation-v1',1],
 ['dependency-success-v1.json','dependency-scan-v1',0],['dependency-findings-v1.json','dependency-scan-v1',1]
];

test('all four accepted profile evidence and summary envelopes validate',()=>{
 for(const args of normal){const parsed=parseFixture(...args);assert.deepEqual(validatePhase5ToolResult(parsed),parsed);assert.equal(parsed.evidence.length,1);}
});

test('evidence schema, type, count, and cardinality are exact',()=>{
 const cases=[
  [parseFixture('hardhat-success-v1.json','hardhat-test-v1',0),'hardhat-test-summary','hardhatTests'],
  [parseFixture('echidna-success-v1.json','echidna-v1',0),'echidna-campaign-summary','echidnaProperties'],
  [parseFixture('mutation-success-v1.json','mutation-v1',0),'mutation-summary','mutationResults'],
  [parseFixture('dependency-findings-v1.json','dependency-scan-v1',1),'dependency-scan-summary','dependencyFindings']
 ];
 for(const [base,type,arrayKey] of cases){
   const badSchema=clone(base);badSchema.evidence[0].schemaVersion='wrong-v1';assertCodePath(assert,()=>validatePhase5ToolResult(badSchema),'evidence_mismatch','$.evidence[0].schemaVersion');
   const badType=clone(base);badType.evidence[0].type='wrong-summary';assertCodePath(assert,()=>validatePhase5ToolResult(badType),'evidence_mismatch','$.evidence[0].type');
   const badCount=clone(base);badCount.evidence[0].recordCount=base[arrayKey].length+1;assertCodePath(assert,()=>validatePhase5ToolResult(badCount),'evidence_mismatch','$.evidence[0].recordCount');
   const duplicate=clone(base);duplicate.evidence.push(clone(base.evidence[0]));assertCodePath(assert,()=>validatePhase5ToolResult(duplicate),'evidence_mismatch','$.evidence');
 }
});

test('Hardhat and Echidna summary counts and seed are exact',()=>{
 const hardhat=parseFixture('hardhat-findings-v1.json','hardhat-test-v1',1);
 for(const key of ['passed','failed','skipped','total']){const bad=clone(hardhat);bad.summary[key]++;assertCodePath(assert,()=>validatePhase5ToolResult(bad),'summary_mismatch',`$.summary.${key}`);}
 const echidna=parseFixture('echidna-findings-v1.json','echidna-v1',1);
 for(const key of ['passed','failed','total']){const bad=clone(echidna);bad.summary[key]++;assertCodePath(assert,()=>validatePhase5ToolResult(bad),'summary_mismatch',`$.summary.${key}`);}
 for(const seed of [-0,-1,4_294_967_296,1.5]){const bad=clone(echidna);bad.summary.seed=seed;assertCodePath(assert,()=>validatePhase5ToolResult(bad),'invalid_integer','$.summary.seed');}
});

test('mutation counts and exact deterministic score are enforced',()=>{
 const base=parseFixture('mutation-findings-v1.json','mutation-v1',1);
 for(const key of ['killed','survived','timedOut','invalid','total']){const bad=clone(base);bad.summary[key]++;assertCodePath(assert,()=>validatePhase5ToolResult(bad),'summary_mismatch',`$.summary.${key}`);}
 for(const score of [base.summary.mutationScore+0.01,-0,NaN,Infinity]){const bad=clone(base);bad.summary.mutationScore=score;assertCodePath(assert,()=>validatePhase5ToolResult(bad),Object.is(score,-0)?'invalid_number':Number.isFinite(score)?'summary_mismatch':'invalid_number','$.summary.mutationScore');}
});

test('dependency severity counts are exact',()=>{
 const base=parseFixture('dependency-findings-v1.json','dependency-scan-v1',1);
 for(const key of ['critical','high','moderate','low','unknown','total']){const bad=clone(base);bad.summary[key]++;assertCodePath(assert,()=>validatePhase5ToolResult(bad),'summary_mismatch',`$.summary.${key}`);}
});
