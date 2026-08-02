import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhase5ToolResult,validatePhase5ResultForProfile } from '../packages/audit-phase5-result-contracts/src/index.mjs';
import { createPhase5ToolCatalog,validatePhase5Catalog } from '../packages/audit-phase5-tool-catalog/src/index.mjs';
import { getPhase5ProfileTemplate,createPublishedPhase5ProfileContract } from '../packages/audit-phase5-profile-contracts/src/index.mjs';
import { parseFixture,clone,assertCodePath } from './audit-phase5-compatibility-helpers-v2.mjs';

const base=()=>parseFixture('hardhat-success-v1.json','hardhat-test-v1',0);

test('one-field mutations across every public result field fail deterministically',()=>{
 const mutations=[
  ['schemaVersion','wrong-v1','invalid_schema_version','$.schemaVersion'],
  ['profileId','unknown-phase5-v1','invalid_profile_id','$.profileId'],
  ['parserVersion','wrong-parser-v1','parser_profile_mismatch','$.parserVersion'],
  ['classification','findings','classification_mismatch','$.classification'],
  ['durationMs',-0,'invalid_integer','$.durationMs'],
  ['exitCode',null,'lifecycle_mismatch','$.exitCode'],
  ['hardhatTests',[], 'summary_mismatch','$.summary.passed'],
  ['echidnaProperties',[{}],'profile_substitution','$.echidnaProperties'],
  ['mutationResults',[{}],'profile_substitution','$.mutationResults'],
  ['dependencyFindings',[{}],'profile_substitution','$.dependencyFindings'],
  ['evidence',[],'evidence_mismatch','$.evidence'],
  ['artifacts',[{}],'artifact_mismatch','$.artifacts'],
  ['parserErrors',[{code:'x',message:'x'}],'classification_mismatch','$.parserErrors'],
  ['summary',{passed:0,failed:0,skipped:0,total:0},'summary_mismatch','$.summary.passed']
 ];
 for(const [field,value,code,path] of mutations){const item=clone(base());item[field]=value;assertCodePath(assert,()=>validatePhase5ToolResult(item),code,path);}
});

test('profile plan, schema, parser, and publication substitutions fail while valid bindings are byte-stable',()=>{
 const result=base();const template=getPhase5ProfileTemplate('hardhat-test-v1');
 assert.equal(JSON.stringify(validatePhase5ResultForProfile(template,result)),JSON.stringify(result));
 assertCodePath(assert,()=>validatePhase5ResultForProfile(getPhase5ProfileTemplate('echidna-v1'),result),'profile_substitution','$.profileId');
 const badSchema=clone(template);badSchema.schemaVersion='wrong-v1';assertCodePath(assert,()=>validatePhase5ResultForProfile(badSchema,result),'invalid_schema_version','$.profileContract.schemaVersion');
 const published=createPublishedPhase5ProfileContract('hardhat-test-v1',{digest:`sha256:${'b'.repeat(64)}`,publishedAt:'2026-08-01T00:00:00.000Z'});
 assert.equal(JSON.stringify(validatePhase5ResultForProfile(published,result)),JSON.stringify(result));
 const drift=clone(published);drift.parserVersion='echidna-parser-v1';assert.throws(()=>validatePhase5ResultForProfile(drift,result),e=>e.code==='immutable_profile_mismatch');
});

test('valid result and catalog variants are byte-stable and defensive',()=>{
 const result=base();assert.equal(JSON.stringify(validatePhase5ToolResult(result)),JSON.stringify(validatePhase5ToolResult(clone(result))));
 const catalog=createPhase5ToolCatalog();assert.equal(JSON.stringify(validatePhase5Catalog(catalog)),JSON.stringify(validatePhase5Catalog(clone(catalog))));
});
