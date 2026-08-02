import { ValidationError, assertAuditId, assertProfileId } from './base-primitives.mjs';
import { sha256HexBytes } from './digest.mjs';
const FORBIDDEN_KEYS = new Set([
  'shell','command','commands','script','scripts','executable','binary',
  'image','customimage','container','containerimage','dockerfile','plugin',
  'plugins','packagecommand','packagemanagercommand','install','installer',
  'url','rpc','rpcurl','rpcendpoint','privatekey','privatekeys','mnemonic',
  'seedphrase','signer','wallet','walletmethod','rawtransaction',
  'signedtransaction','broadcast','deployment','deploy','credential',
  'credentials','password','secret','secrets','token'
]);
export const ENCODER = new TextEncoder();
const ADDRESS=/^0x[0-9a-f]{40}$/;
const BYTES32=/^0x[0-9a-f]{64}$/;
const SHA256=/^[0-9a-f]{64}$/;
const BLOCK_HASH=/^0x[0-9a-f]{64}$/;
export const ACTION_ID=/^act_[A-Za-z0-9._-]{1,80}$/;
export const TRANSITION_ID=/^(?:tr_|create:)[A-Za-z0-9._:-]{1,160}$/;
export const EXPORT_ID=/^exp_[0-9a-f]{32}$/;
export const RESTORE_ID=/^rst_[0-9a-f]{32}$/;
function normalizedKey(key){return key.replace(/[^A-Za-z0-9]/g,'').toLowerCase();}
export function fail(code,message,path='$'){throw new ValidationError(code,message,path);}
function reflect(path,fn,message=`${path} could not be inspected`){try{return fn();}catch{fail('hostile_reflection',message,path);}}
function guardedIsArray(value,path){return reflect(path,()=>Array.isArray(value));}
function guardedPrototype(value,path){return reflect(path,()=>Object.getPrototypeOf(value));}
function guardedOwnKeys(value,path){return reflect(path,()=>Reflect.ownKeys(value));}
function guardedDescriptor(value,key,path){return reflect(path,()=>Object.getOwnPropertyDescriptor(value,key));}
function dataDescriptor(value,key,path){const descriptor=guardedDescriptor(value,key,path);if(!descriptor||descriptor.get||descriptor.set||!Object.hasOwn(descriptor,'value'))fail('unsafe_object',`${path} must be a data property`,path);return descriptor;}
function arrayEntries(value,path,maximum=256){
  if(!guardedIsArray(value,path))fail('invalid_type',`${path} must be an array`,path);
  if(guardedPrototype(value,path)!==Array.prototype)fail('unsafe_object',`${path} must be an ordinary array`,path);
  const keys=guardedOwnKeys(value,path);
  for(const key of keys){if(typeof key!=='string')fail('unsafe_object',`${path} contains a symbol key`,path);if(key!=='length'&&!/^(0|[1-9][0-9]*)$/.test(key))fail('unsafe_object',`${path}.${key} is not an array index`,`${path}.${key}`);}
  const length=dataDescriptor(value,'length',`${path}.length`).value;
  if(!Number.isSafeInteger(length)||length<0||length>maximum)fail('value_too_large',`${path} has too many items`,path);
  const result=new Array(length);
  for(let index=0;index<length;index+=1){const itemPath=`${path}[${index}]`;if(!keys.includes(String(index)))fail('sparse_array',`${itemPath} is missing`,itemPath);result[index]=dataDescriptor(value,String(index),itemPath).value;}
  return result;
}
function objectEntries(value,path){
  const prototype=guardedPrototype(value,path);
  if(prototype!==Object.prototype&&prototype!==null)fail('unsafe_object',`${path} must be a plain object`,path);
  const keys=guardedOwnKeys(value,path);
  const result=[];
  for(const key of keys){
    if(typeof key!=='string')fail('unsafe_object',`${path} contains a symbol key`,path);
    const itemPath=`${path}.${key}`;
    const descriptor=dataDescriptor(value,key,itemPath);
    result.push([key,descriptor.value]);
  }
  return result;
}
export function assertSafeGraph(value,path='$',seen=new WeakSet()){
  if(value===null||typeof value==='boolean') return;
  if(typeof value==='string'){
    if(/[\u0000-\u001f\u007f]/u.test(value)) fail('invalid_control_character',`${path} contains a control character`,path);
    if(ENCODER.encode(value).byteLength>2_000_000) fail('value_too_large',`${path} is too large`,path);
    return;
  }
  if(typeof value==='number'){
    if(!Number.isSafeInteger(value)||Object.is(value,-0)) fail('invalid_integer',`${path} must be a safe integer and not negative zero`,path);
    return;
  }
  if(typeof value!=='object'||typeof value==='function') fail('invalid_type',`${path} contains an unsupported value`,path);
  if(seen.has(value)) fail('cyclic_value',`${path} contains a cycle`,path);
  seen.add(value);
  const entries=guardedIsArray(value,path)?arrayEntries(value,path):objectEntries(value,path);
  for(const [key,item] of entries.entries?entries.entries():entries){
    const itemPath=guardedIsArray(value,path)?`${path}[${key}]`:`${path}.${key}`;
    if(!guardedIsArray(value,path)&&FORBIDDEN_KEYS.has(normalizedKey(key))) fail('forbidden_field',`${itemPath} is forbidden`,itemPath);
    assertSafeGraph(item,itemPath,seen);
  }
  seen.delete(value);
}
export function assertPlainObject(value,path='$'){
  assertSafeGraph(value,path);
  if(value===null||typeof value!=='object'||guardedIsArray(value,path)) fail('invalid_type',`${path} must be an object`,path);
  return value;
}
export function strictObject(value,allowed,required=allowed,path='$'){
  assertPlainObject(value,path);
  const entries=objectEntries(value,path);
  const keys=new Set(entries.map(([key])=>key));
  for(const key of keys) if(!allowed.has(key)) fail('unknown_field',`${path}.${key} is not allowed`,`${path}.${key}`);
  for(const key of required) if(!keys.has(key)) fail('missing_field',`${path}.${key} is required`,`${path}.${key}`);
  return value;
}
export function assertString(value,path,maximum=160,pattern){
  if(typeof value!=='string'||value.length<1||value.length>maximum||(pattern&&!pattern.test(value))) fail('invalid_string',`${path} is invalid`,path);
  return value;
}
export function assertEnum(value,allowed,path){if(!allowed.includes(value)) fail('invalid_enum',`${path} is unsupported`,path);return value;}
export function assertInteger(value,path,minimum=0,maximum=Number.MAX_SAFE_INTEGER){
  if(!Number.isSafeInteger(value)||Object.is(value,-0)||value<minimum||value>maximum) fail('invalid_integer',`${path} must be an integer from ${minimum} to ${maximum}`,path);
  return value;
}
export function assertLimit(value,path,minimum,maximum){
  if(!Number.isSafeInteger(value)||Object.is(value,-0)||value<minimum||value>maximum) fail('invalid_limit',`${path} exceeds its allowed bound`,path);
  return value;
}
export function assertIso(value,path){
  assertString(value,path,40);
  const date=new Date(value);
  if(Number.isNaN(date.getTime())||date.toISOString()!==value) fail('invalid_timestamp',`${path} must be a canonical ISO instant`,path);
  return value;
}
export function assertSha(value,path){return assertString(value,path,64,SHA256);}
export function assertBlockHash(value,path){return assertString(value,path,66,BLOCK_HASH);}
export function assertAddress(value,path){return assertString(value,path,42,ADDRESS);}
export function assertBytes32(value,path){return assertString(value,path,66,BYTES32);}
export function assertForkId(value,path='$.forkId'){return assertAuditId(value,'fork',path);}
export function assertAttemptId(value,path='$.attemptId'){return assertAuditId(value,'attempt',path);}
export function assertCheckpointId(value,path='$.checkpointId'){return assertAuditId(value,'snapshot',path);}
export function assertRequester(value,path){return assertString(value,path,96,/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/);}
export function assertScopes(value,path){
  const items=arrayEntries(value,path,4);if(items.length<1)fail('invalid_scope',`${path} must be a bounded scope array`,path);
  const allowed=['audit:read','audit:submit','audit:admin','audit:internal']; const unique=new Set();
  for(let index=0;index<items.length;index+=1){const scope=assertEnum(items[index],allowed,`${path}[${index}]`);if(unique.has(scope)) fail('duplicate_scope',`${path} contains a duplicate scope`,path);unique.add(scope);}
  return [...items];
}
function canonicalValue(value,path='$',seen=new WeakSet()){
  if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number')return value;
  if(seen.has(value))fail('cyclic_value',`${path} contains a cycle`,path);seen.add(value);
  let result;
  if(guardedIsArray(value,path))result=arrayEntries(value,path).map((item,index)=>canonicalValue(item,`${path}[${index}]`,seen));
  else{result={};for(const [key,item] of objectEntries(value,path).sort(([a],[b])=>a.localeCompare(b)))result[key]=canonicalValue(item,`${path}.${key}`,seen);}
  seen.delete(value);return result;
}
export function clone(value){assertSafeGraph(value);return canonicalValue(value);}
export function canonicalJson(value){assertSafeGraph(value);return JSON.stringify(canonicalValue(value));}
export async function sha256Hex(value){const bytes=typeof value==='string'?ENCODER.encode(value):value;if(!(bytes instanceof Uint8Array)) fail('invalid_type','$.bytes must be Uint8Array','$.bytes');return sha256HexBytes(bytes);}
export { assertAuditId, assertProfileId };