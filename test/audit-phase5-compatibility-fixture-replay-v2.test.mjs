import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parsePhase5ToolResult } from '../packages/audit-phase5-parsers/src/index.mjs';
import { validatePhase5ToolResult } from '../packages/audit-phase5-result-contracts/src/index.mjs';
import { FIXTURE_ROOT,FIXTURE_CASES,readJson,readText,parseFixture,parseLifecycle,reverseRawFixture } from './audit-phase5-compatibility-helpers-v2.mjs';

const V1=readJson('fixture-manifest-v1.json').fixtures;const V2=readJson('fixture-manifest-v2.json').fixtures;const PAYLOADS=[...V1,...V2].sort();

test('authoritative fixture inventory is complete, unique, owned, and explicitly classified',()=>{
 assert.equal(readJson('fixture-manifest-v1.json').owner,'CurveYield');assert.equal(readJson('fixture-manifest-v2.json').owner,'CurveYield');assert.equal(new Set(PAYLOADS).size,PAYLOADS.length);assert.equal(PAYLOADS.length,16);
 const actual=fs.readdirSync(FIXTURE_ROOT).filter(n=>!n.startsWith('fixture-manifest-')).sort();assert.deepEqual(actual,PAYLOADS);
 const classified=new Set([...FIXTURE_CASES.map(x=>x[0]),'timeout-v1.json','cancellation-v1.json','resource-exhaustion-v1.json']);assert.deepEqual([...classified].sort(),PAYLOADS);
 for(const name of PAYLOADS.filter(n=>n.endsWith('.json'))) assert.doesNotThrow(()=>JSON.parse(readText(name)));
});

test('all normal, malformed, parser-error, and non-resource lifecycle outputs replay byte-identically and validate',()=>{
 for(const [name,profile,exit,termination,classification] of FIXTURE_CASES){const a=parseFixture(name,profile,exit,termination);const b=parseFixture(name,profile,exit,termination);assert.equal(JSON.stringify(a),JSON.stringify(b),name);assert.equal(a.profileId,profile);assert.equal(a.classification,classification);assert.deepEqual(validatePhase5ToolResult(a),a,name);}
 for(const name of ['timeout-v1.json','cancellation-v1.json']){const a=parseLifecycle(name),b=parseLifecycle(name);assert.equal(JSON.stringify(a),JSON.stringify(b));assert.deepEqual(validatePhase5ToolResult(a),a);}
});

test('normal parser outputs are permutation-invariant',()=>{
 const cases=[['hardhat-success-v1.json','hardhat-test-v1',0],['echidna-findings-v1.json','echidna-v1',1],['mutation-findings-v1.json','mutation-v1',1],['dependency-findings-v1.json','dependency-scan-v1',1]];
 for(const [name,profile,exit] of cases){const expected=parseFixture(name,profile,exit);const permuted=parsePhase5ToolResult(profile,{resultBytes:reverseRawFixture(name),exitCode:exit,durationMs:7,termination:'completed'});assert.equal(JSON.stringify(permuted),JSON.stringify(expected),name);}
});

test('redaction and conflicting duplicates remain stable under replay and reversal',()=>{
 const sensitive=parseFixture('hardhat-sensitive-messages-v2.json','hardhat-test-v1',1);const encoded=JSON.stringify(sensitive);assert.match(encoded,/\[redacted\]/);assert.match(encoded,/\[path\]/);for(const leaked of ['aaaaaaaaaaaaaaaa','abandon abandon','api-example','AKIAEXAMPLE','abc.def.ghi','token-example','secret-example','C:\\\\Users','/home/alice'])assert.equal(encoded.includes(leaked),false,leaked);
 for(const [name,profile] of [['mutation-conflicting-duplicates-v2.json','mutation-v1'],['dependency-conflicting-duplicates-v2.json','dependency-scan-v1']]){const a=parseFixture(name,profile,1);const b=parsePhase5ToolResult(profile,{resultBytes:reverseRawFixture(name),exitCode:1,durationMs:7,termination:'completed'});assert.equal(a.classification,'parser_error');assert.equal(a.parserErrors[0].code,'conflicting_duplicate');assert.equal(JSON.stringify(a),JSON.stringify(b));assert.deepEqual(validatePhase5ToolResult(a),a);}
});

test('resource exhaustion fixture remains stable but is rejected until upstream parser nulls exit code',()=>{
 const a=parseLifecycle('resource-exhaustion-v1.json'),b=parseLifecycle('resource-exhaustion-v1.json');assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(a.exitCode,137);assert.throws(()=>validatePhase5ToolResult(a),e=>e.code==='lifecycle_mismatch'&&e.path==='$.exitCode');
});
