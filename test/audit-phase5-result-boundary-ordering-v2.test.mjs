import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhase5ToolResult } from '../packages/audit-phase5-result-contracts/src/index.mjs';
import { parseFixture, clone, assertCodePath } from './audit-phase5-compatibility-helpers-v2.mjs';

const cases=[
 ['hardhat-success-v1.json','hardhat-test-v1',0,'hardhatTests'],
 ['echidna-success-v1.json','echidna-v1',0,'echidnaProperties'],
 ['mutation-success-v1.json','mutation-v1',0,'mutationResults'],
 ['dependency-findings-v1.json','dependency-scan-v1',1,'dependencyFindings']
];

test('normalized record arrays require accepted parser canonical ordering',()=>{
 for(const [name,profile,exit,key] of cases){const base=parseFixture(name,profile,exit);if(base[key].length<2)continue;const bad=clone(base);bad[key].reverse();assertCodePath(assert,()=>validatePhase5ToolResult(bad),'noncanonical_order',`$.${key}`);}
});

test('exact duplicates reject and conflicting logical identities are distinguished',()=>{
 for(const [name,profile,exit,key] of cases){const base=parseFixture(name,profile,exit);if(!base[key].length)continue;const bad=clone(base);bad[key].push(clone(bad[key][0]));assertCodePath(assert,()=>validatePhase5ToolResult(bad),'duplicate_result',`$.${key}`);}
 const mutation=parseFixture('mutation-success-v1.json','mutation-v1',0);const conflict=clone(mutation);conflict.mutationResults.push({...clone(conflict.mutationResults[0]),status:'survived',killedBy:null});assertCodePath(assert,()=>validatePhase5ToolResult(conflict),'conflicting_duplicate','$.mutationResults');
 const dependency=parseFixture('dependency-findings-v1.json','dependency-scan-v1',1);const conflictD=clone(dependency);conflictD.dependencyFindings.push({...clone(conflictD.dependencyFindings[0]),severity:'critical'});assertCodePath(assert,()=>validatePhase5ToolResult(conflictD),'conflicting_duplicate','$.dependencyFindings');
});

test('dependency aliases are unique and canonically sorted',()=>{
 const base=parseFixture('dependency-findings-v1.json','dependency-scan-v1',1);const item=base.dependencyFindings.find(x=>x.aliases.length);const unsorted=clone(base);const target=unsorted.dependencyFindings.find(x=>x.id===item.id);target.aliases=['ZZZ','AAA'];assertCodePath(assert,()=>validatePhase5ToolResult(unsorted),'noncanonical_order',`$.dependencyFindings[${unsorted.dependencyFindings.indexOf(target)}].aliases`);const duplicate=clone(base);const d=duplicate.dependencyFindings.find(x=>x.aliases.length);d.aliases=[d.aliases[0],d.aliases[0]];assertCodePath(assert,()=>validatePhase5ToolResult(duplicate),'duplicate_result',`$.dependencyFindings[${duplicate.dependencyFindings.indexOf(d)}].aliases`);
});

test('external object and array boundaries reject prototypes, accessors, and exotic values',()=>{
 const base=parseFixture('hardhat-success-v1.json','hardhat-test-v1',0);
 class Result{};Object.assign(Result.prototype,base);assertCodePath(assert,()=>validatePhase5ToolResult(Object.assign(new Result(),base)),'invalid_object','$');
 const custom=clone(base);Object.setPrototypeOf(custom.summary,{attacker:true});assertCodePath(assert,()=>validatePhase5ToolResult(custom),'invalid_object','$.summary');
 class WeirdArray extends Array{};const exotic=clone(base);exotic.hardhatTests=WeirdArray.from(exotic.hardhatTests);assertCodePath(assert,()=>validatePhase5ToolResult(exotic),'invalid_array','$.hardhatTests');
 const getter=clone(base);Object.defineProperty(getter.summary,'passed',{enumerable:true,get(){throw new Error('getter executed');}});assertCodePath(assert,()=>validatePhase5ToolResult(getter),'accessor_not_allowed','$.summary.passed');
 for(const [value,code] of [[-0,'invalid_integer'],[NaN,'invalid_integer'],[Infinity,'invalid_integer'],[Number.MAX_SAFE_INTEGER+1,'invalid_integer']]){const bad=clone(base);bad.durationMs=value;assertCodePath(assert,()=>validatePhase5ToolResult(bad),code,'$.durationMs');}
 const control=clone(base);control.hardhatTests[0].name='bad\u0001name';assertCodePath(assert,()=>validatePhase5ToolResult(control),'invalid_string','$.hardhatTests[0].name');
 const long=clone(base);long.hardhatTests[0].name='x'.repeat(513);assertCodePath(assert,()=>validatePhase5ToolResult(long),'invalid_string','$.hardhatTests[0].name');
 const unsafe=clone(base);unsafe.hardhatTests[0].file='../secret.js';assertCodePath(assert,()=>validatePhase5ToolResult(unsafe),'unsafe_path','$.hardhatTests[0].file');
});

test('defensive clone is recursively frozen and does not retain null prototypes',()=>{
 const base=parseFixture('hardhat-success-v1.json','hardhat-test-v1',0);const source=clone(base);source.summary=Object.assign(Object.create(null),source.summary);const validated=validatePhase5ToolResult(source);assert.equal(Object.getPrototypeOf(validated.summary),Object.prototype);assert.equal(Object.isFrozen(validated),true);assert.equal(Object.isFrozen(validated.summary),true);assert.equal(Object.isFrozen(validated.hardhatTests),true);assert.equal(Object.isFrozen(validated.hardhatTests[0]),true);source.summary.passed=99;assert.equal(validated.summary.passed,2);
});

test('transparent and revoked proxies plus oversized collections are rejected',()=>{
 const base=parseFixture('hardhat-success-v1.json','hardhat-test-v1',0);
 assertCodePath(assert,()=>validatePhase5ToolResult(new Proxy(base,{})),'invalid_object','$');
 const revoked=Proxy.revocable(base,{});revoked.revoke();assertCodePath(assert,()=>validatePhase5ToolResult(revoked.proxy),'invalid_object','$');
 const oversized=clone(base);oversized.hardhatTests=Array.from({length:10_001},()=>clone(base.hardhatTests[0]));assertCodePath(assert,()=>validatePhase5ToolResult(oversized),'invalid_array','$.hardhatTests');
});
