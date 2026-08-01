import { LIMITS } from './constants.mjs';
import { fail } from './errors.mjs';
import { sha256Hex,utf8ByteLength } from './digest.mjs';
const reflect=(fn,path)=>{try{return fn();}catch{fail('hostile_reflection',path,'Value could not be inspected');}};
const isArray=(value,path)=>reflect(()=>Array.isArray(value),path);
const descriptors=(value,path)=>{const desc=reflect(()=>Object.getOwnPropertyDescriptors(value),path);const symbols=reflect(()=>Object.getOwnPropertySymbols(value),path);if(symbols.length)fail('symbol_field',path);return desc;};
export function plainObject(value,path='$'){if(value===null||typeof value!=='object'||isArray(value,path))fail('invalid_object',path);const proto=reflect(()=>Object.getPrototypeOf(value),path);if(proto!==Object.prototype&&proto!==null)fail('invalid_prototype',path);const desc=descriptors(value,path);for(const [key,item] of Object.entries(desc))if(!Object.hasOwn(item,'value'))fail('accessor_field',`${path}.${key}`);return desc;}
export function exactKeys(value,keys,path='$'){const desc=plainObject(value,path),actual=Object.keys(desc).sort(),expected=[...keys].sort();if(JSON.stringify(actual)!==JSON.stringify(expected)){const extra=actual.find((x)=>!expected.includes(x));const missing=expected.find((x)=>!actual.includes(x));fail(extra?'unknown_field':'missing_field',extra?`${path}.${extra}`:`${path}.${missing}`);}return Object.fromEntries(Object.entries(desc).map(([key,item])=>[key,item.value]));}
export function denseArray(value,path='$',maximum=LIMITS.array){if(!isArray(value,path))fail('invalid_array',path);if(reflect(()=>Object.getPrototypeOf(value),path)!==Array.prototype)fail('invalid_array',path);const desc=descriptors(value,path),length=desc.length?.value;if(!Number.isSafeInteger(length)||length<0)fail('invalid_array',path);if(length>maximum)fail('collection_too_large',path);const result=[];for(let i=0;i<length;i++){const item=desc[String(i)];if(!item)fail('sparse_array',`${path}[${i}]`);if(!Object.hasOwn(item,'value'))fail('accessor_field',`${path}[${i}]`);result.push(item.value);}for(const key of Object.keys(desc))if(key!=='length'&&!/^(0|[1-9][0-9]*)$/.test(key))fail('array_property',path);return result;}
export function boundedString(value,path,maximum=LIMITS.string,allowEmpty=false){if(typeof value!=='string'||value.length>maximum||(!allowEmpty&&value.length===0))fail('invalid_string',path);if(/[\u0000-\u001f\u007f]/.test(value))fail('control_character',path);return value;}
export function identifier(value,path){const v=boundedString(value,path,LIMITS.id);if(!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(v)||v.includes('..')||v==='latest')fail('invalid_identifier',path);return v;}
export function versionSlug(value,path){const v=boundedString(value,path,96);if(!/^[a-z0-9]+(?:[._-][a-z0-9]+)*-v[1-9][0-9]*$/.test(v))fail('invalid_version',path);return v;}
export function fullName(value,path){const v=boundedString(value,path,200);if(!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(v)||v.includes('..'))fail('invalid_repository_name',path);return v;}
export function commitSha(value,path){const v=boundedString(value,path,40);if(!/^[0-9a-f]{40}$/.test(v))fail('invalid_commit_sha',path);return v;}
export function digest(value,path){const v=boundedString(value,path,71);if(!/^sha256:[0-9a-f]{64}$/.test(v))fail('invalid_digest',path);return v;}
export function timestamp(value,path){const v=boundedString(value,path,32);const d=new Date(v);if(!Number.isFinite(d.getTime())||d.toISOString()!==v)fail('invalid_timestamp',path);return v;}
export function integer(value,path,min=0,max=Number.MAX_SAFE_INTEGER){if(!Number.isSafeInteger(value)||Object.is(value,-0)||value<min||value>max)fail('invalid_integer',path);return value;}
export function booleanValue(value,path){if(typeof value!=='boolean')fail('invalid_boolean',path);return value;}
export function enumValue(value,allowed,path){const v=boundedString(value,path,64);if(!allowed.includes(v))fail('invalid_enum',path);return v;}
export function nullable(value,validator,path){return value===null?null:validator(value,path);}
export function stringArray(value,path,{maximum=256,item=identifier,sorted=true}={}){const out=denseArray(value,path,maximum).map((x,i)=>item(x,`${path}[${i}]`));if(new Set(out).size!==out.length)fail('duplicate_identity',path);if(sorted)out.sort();return out;}
function canonical(value,path,seen,depth){if(depth>LIMITS.depth)fail('nesting_too_deep',path);if(value===null||typeof value==='string'||typeof value==='boolean')return value;if(typeof value==='number'){if(!Number.isSafeInteger(value)||Object.is(value,-0))fail('invalid_number',path);return value;}if(typeof value!=='object')fail('invalid_value',path);if(seen.has(value))fail('cycle',path);seen.add(value);let out;if(isArray(value,path)){out=denseArray(value,path).map((x,i)=>canonical(x,`${path}[${i}]`,seen,depth+1));}else{const desc=plainObject(value,path);out={};for(const key of Object.keys(desc).sort())out[key]=canonical(desc[key].value,`${path}.${key}`,seen,depth+1);}seen.delete(value);return out;}
function jsonOf(clone){const json=JSON.stringify(clone);if(utf8ByteLength(json)>LIMITS.bytes)fail('encoded_bytes_exceeded','$');return json;}
export function canonicalClone(value){const out=canonical(value,'$',new WeakSet(),0);jsonOf(out);return out;}
export function canonicalJson(value){return jsonOf(canonical(value,'$',new WeakSet(),0));}
export function sha256(value){const text=typeof value==='string'?value:canonicalJson(value);if(utf8ByteLength(text)>LIMITS.bytes)fail('encoded_bytes_exceeded','$');return `sha256:${sha256Hex(text)}`;}
export function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;}
export function frozenClone(value){return deepFreeze(canonicalClone(value));}

export { fail } from './errors.mjs';
