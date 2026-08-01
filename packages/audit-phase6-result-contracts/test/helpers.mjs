import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSoliditySmtBytes, parseHalmosBytes, parseFormalObligationsBytes } from '../../audit-phase6-parsers/src/index.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export const fixtureDir=path.resolve(here,'../../../test/fixtures/audit-phase6');
export const inventory=JSON.parse(fs.readFileSync(path.join(fixtureDir,'FIXTURE_INVENTORY_v2.json'),'utf8'));
export const parsers=Object.freeze({'solidity-smt-v1':parseSoliditySmtBytes,'halmos-v1':parseHalmosBytes,'formal-obligations-v1':parseFormalObligationsBytes});
export function bytes(name){return new Uint8Array(fs.readFileSync(path.join(fixtureDir,name)));}
export function resultFor(name){const item=inventory.fixtures.find(x=>x.file===name);return parsers[item.profileId](bytes(name));}
export function captureFor(name){return JSON.parse(fs.readFileSync(path.join(fixtureDir,name),'utf8'));}
export function assertCode(assert,fn,code,path){assert.throws(fn,e=>e?.code===code&&(path===undefined||e?.path===path),`expected ${code}${path?` at ${path}`:''}`)}
