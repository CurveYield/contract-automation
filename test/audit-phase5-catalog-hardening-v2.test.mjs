import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASE5_PROFILE_IDS,PHASE5_PROFILE_TEMPLATES,createPublishedPhase5ProfileContract } from '../packages/audit-phase5-profile-contracts/src/index.mjs';
import { PHASE5_PARSER_VERSIONS } from '../packages/audit-phase5-parsers/src/index.mjs';
import { createPhase5ToolCatalog,assertPhase5PackageCompatibility,validatePhase5Catalog } from '../packages/audit-phase5-tool-catalog/src/index.mjs';
import { assertCodePath,clone } from './audit-phase5-compatibility-helpers-v2.mjs';

const digest=`sha256:${'a'.repeat(64)}`;const published=()=>createPublishedPhase5ProfileContract('hardhat-test-v1',{digest,publishedAt:'2026-08-01T00:00:00.000Z'});

test('catalog contains exactly four sorted immutable identities and truthful inert states',()=>{
 const catalog=createPhase5ToolCatalog();assert.equal(catalog.length,4);assert.deepEqual(catalog.map(x=>x.profileId),[...PHASE5_PROFILE_IDS].sort());assert.equal(new Set(catalog.map(x=>x.profileId)).size,4);
 for(const entry of catalog){const template=PHASE5_PROFILE_TEMPLATES.find(t=>t.profileId===entry.profileId);assert.equal(entry.parserVersion,template.parserVersion);assert.equal(entry.adapterVersion,template.adapterVersion);assert.equal(entry.toolName,template.tool.name);assert.equal(entry.toolVersion,template.tool.version);assert.equal(entry.registryRepository,template.registryRepository);assert.equal(entry.publicationState,'unpublished');assert.equal(entry.digestRequired,true);assert.equal(entry.digest,null);assert.equal(entry.publishedAt,null);assert.equal(entry.runnable,false);assert.equal(entry.executionEnabled,false);assert.equal(entry.executorState,'unavailable');}
 assert.deepEqual(validatePhase5Catalog(catalog),catalog);assert.equal(Object.isFrozen(catalog),true);assert.equal(catalog.every(Object.isFrozen),true);
});

test('published catalog entry retains digest requirement and immutable identity',()=>{
 const contract=published();const catalog=createPhase5ToolCatalog([contract]);const entry=catalog.find(x=>x.profileId==='hardhat-test-v1');assert.equal(entry.publicationState,'published');assert.equal(entry.digestRequired,true);assert.equal(entry.digest,digest);assert.equal(entry.publishedAt,contract.publishedAt);assert.equal(entry.runnable,false);assert.equal(entry.executionEnabled,false);assert.equal(entry.executorState,'unavailable');
});

test('catalog rejects duplicate, malformed, custom-prototype, and drifted publications',()=>{
 assert.throws(()=>createPhase5ToolCatalog([published(),published()]),e=>e.code==='catalog_duplicate');class WeirdArray extends Array{};assertCodePath(assert,()=>createPhase5ToolCatalog(WeirdArray.of(published())),'invalid_array','$.publishedProfiles');const hostile=clone(published());Object.setPrototypeOf(hostile,{attacker:true});assertCodePath(assert,()=>createPhase5ToolCatalog([hostile]),'invalid_object','$.publishedProfiles[0]');
 for(const [field,value] of [['profileId','echidna-v1'],['parserVersion','echidna-parser-v1'],['adapterVersion','x'],['registryRepository','ghcr.io/evil/x'],['executionEnabled',true],['executorState','available']]){const drift=clone(published());drift[field]=value;assert.throws(()=>createPhase5ToolCatalog([drift]));}
 const nested=clone(published());Object.setPrototypeOf(nested.networkPolicy,{attacker:true});assertCodePath(assert,()=>createPhase5ToolCatalog([nested]),'invalid_object','$.publishedProfiles[0].networkPolicy');
 const nestedArray=clone(published());class Destinations extends Array{};nestedArray.networkPolicy.allowedDestinations=Destinations.from([]);assertCodePath(assert,()=>createPhase5ToolCatalog([nestedArray]),'invalid_array','$.publishedProfiles[0].networkPolicy.allowedDestinations');
});

test('catalog validation catches one-field mutations with stable bounded paths',()=>{
 const base=createPhase5ToolCatalog();const fields=Object.keys(base[0]);for(const field of fields){const mutated=clone(base);const value=mutated[0][field];mutated[0][field]=typeof value==='boolean'?!value:typeof value==='string'?`${value}-drift`:value===null?'drift':0;assert.throws(()=>validatePhase5Catalog(mutated),e=>typeof e.code==='string'&&e.path===`$[0].${field}`);}
});

test('cross-package compatibility reports exact result, evidence, parser, and catalog mappings',()=>{
 const result=assertPhase5PackageCompatibility();assert.equal(result.compatible,true);assert.deepEqual(result.profileIds,[...PHASE5_PROFILE_IDS].sort());assert.deepEqual(result.parserVersions,Object.fromEntries([...PHASE5_PROFILE_IDS].sort().map(id=>[id,PHASE5_PARSER_VERSIONS[id]])));assert.deepEqual(result.evidenceTypes,{'dependency-scan-v1':'dependency-scan-summary','echidna-v1':'echidna-campaign-summary','hardhat-test-v1':'hardhat-test-summary','mutation-v1':'mutation-summary'});assert.equal(result.executionEnabled,false);assert.equal(result.executorState,'unavailable');assert.equal(Object.isFrozen(result),true);
});
