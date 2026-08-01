import {sha256Text,utf8ByteLength} from './digest.mjs';
export const LIMITS=Object.freeze({string:1024,id:128,array:100000,depth:32,bytes:20_000_000,pageSize:100});
const FORBIDDEN=new Set([
 ['r','p','c','u','r','l'].join(''),['private','key'].join(''),['seed','phrase'].join(''),['mne','monic'].join(''),
 ['com','mand'].join(''),['scr','ipt'].join(''),['cont','ainer'].join(''),['broa','dcast'].join(''),['deplo','yment'].join(''),
 ['sign','er'].join(''),['wall','et'].join(''),['raw','transaction'].join(''),['arbitrary','url'].join('')
]);
function norm(key){return key.replace(/[^A-Za-z0-9]/g,'').toLowerCase();}
export function fail(code,path='$',message=code){const error=new Error(message);error.code=code;error.path=path;throw error;}
function guard(fn,path){try{return fn();}catch{fail('hostile_reflection',path,'Boundary inspection failed');}}
function descriptors(value,path){const out=guard(()=>Object.getOwnPropertyDescriptors(value),path);const symbols=guard(()=>Object.getOwnPropertySymbols(value),path);if(symbols.length)fail('symbol_field',path);return out;}
function proto(value,path){return guard(()=>Object.getPrototypeOf(value),path);}
function isArray(value,path){return guard(()=>Array.isArray(value),path);}
export function plainObject(value,path='$'){
 if(value===null||typeof value!=='object'||isArray(value,path))fail('invalid_object',path);
 const p=proto(value,path);if(p!==Object.prototype&&p!==null)fail('invalid_prototype',path);
 const desc=descriptors(value,path);for(const [key,item] of Object.entries(desc)){if(!Object.hasOwn(item,'value'))fail('accessor_field',`${path}.${key}`);if(FORBIDDEN.has(norm(key)))fail('forbidden_field',`${path}.${key}`);}
 return desc;
}
export function denseArray(value,path='$',maximum=LIMITS.array){if(!isArray(value,path))fail('invalid_array',path);if(proto(value,path)!==Array.prototype)fail('invalid_array',path);const desc=descriptors(value,path);const length=desc.length?.value;if(!Number.isSafeInteger(length)||length<0)fail('invalid_array',path);if(length>maximum)fail('collection_too_large',path);for(const key of Object.keys(desc))if(key!=='length'&&!/^(0|[1-9][0-9]*)$/.test(key))fail('array_property',path);const out=[];for(let i=0;i<length;i++){const item=desc[String(i)];if(!item)fail('sparse_array',`${path}[${i}]`);if(!Object.hasOwn(item,'value'))fail('accessor_field',`${path}[${i}]`);out.push(item.value);}return out;}
export function exactKeys(value,keys,path='$'){const desc=plainObject(value,path),actual=Object.keys(desc).sort(),expected=[...keys].sort();if(JSON.stringify(actual)!==JSON.stringify(expected)){const extra=actual.find(k=>!expected.includes(k)),missing=expected.find(k=>!actual.includes(k));fail(extra?'unknown_field':'missing_field',extra?`${path}.${extra}`:`${path}.${missing}`);}return Object.fromEntries(Object.entries(desc).map(([k,v])=>[k,v.value]));}
export function boundedString(value,path,maximum=LIMITS.string,allowEmpty=false){if(typeof value!=='string'||value.length>maximum||(!allowEmpty&&value.length===0))fail('invalid_string',path);if(/[\u0000-\u001f\u007f]/.test(value))fail('control_character',path);return value;}
export function identifier(value,path){const text=boundedString(value,path,LIMITS.id);if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(text)||text.includes('..')||text==='*'||text==='latest')fail('invalid_identifier',path);return text;}
export function digest(value,path){const text=boundedString(value,path,71);if(!/^sha256:[0-9a-f]{64}$/.test(text))fail('invalid_digest',path);return text;}
export function rawDigest(value,path){const text=boundedString(value,path,64);if(!/^[0-9a-f]{64}$/.test(text))fail('invalid_digest',path);return text;}
export function timestamp(value,path){const text=boundedString(value,path,40),date=new Date(text);if(Number.isNaN(date.getTime())||date.toISOString()!==text)fail('invalid_timestamp',path);return text;}
export function integer(value,path,min=0,max=Number.MAX_SAFE_INTEGER){if(!Number.isSafeInteger(value)||Object.is(value,-0)||value<min||value>max)fail('invalid_integer',path);return value;}
export function boolean(value,path){if(typeof value!=='boolean')fail('invalid_boolean',path);return value;}
export function enumValue(value,allowed,path){const text=boundedString(value,path,80);if(!allowed.includes(text))fail('invalid_enum',path);return text;}
export function nullable(value,validator,path){return value===null?null:validator(value,path);}
export function stringArray(value,path,{allowed=null,maximum=256}={}){const items=denseArray(value,path,maximum).map((item,i)=>allowed?enumValue(item,allowed,`${path}[${i}]`):identifier(item,`${path}[${i}]`));if(new Set(items).size!==items.length)fail('duplicate_identity',path);return items.sort();}
export function digestArray(value,path,maximum=256){const items=denseArray(value,path,maximum).map((item,i)=>digest(item,`${path}[${i}]`));if(new Set(items).size!==items.length)fail('duplicate_identity',path);return items.sort();}
function canonical(value,path,seen,depth){if(depth>LIMITS.depth)fail('nesting_too_deep',path);if(value===null||typeof value==='string'||typeof value==='boolean')return value;if(typeof value==='number'){if(!Number.isSafeInteger(value)||Object.is(value,-0))fail('invalid_number',path);return value;}if(typeof value!=='object')fail('invalid_value',path);if(seen.has(value))fail('cycle',path);seen.add(value);let out;if(isArray(value,path)){out=denseArray(value,path).map((item,i)=>canonical(item,`${path}[${i}]`,seen,depth+1));}else{const desc=plainObject(value,path);out={};for(const key of Object.keys(desc).sort())out[key]=canonical(desc[key].value,`${path}.${key}`,seen,depth+1);}seen.delete(value);return out;}
export function canonicalClone(value){const out=canonical(value,'$',new WeakSet(),0);const json=JSON.stringify(out);if(utf8ByteLength(json)>LIMITS.bytes)fail('encoded_bytes_exceeded','$');return out;}
export function canonicalJson(value){return JSON.stringify(canonicalClone(value));}
export function sha256(value){const text=typeof value==='string'?value:canonicalJson(value);if(utf8ByteLength(text)>LIMITS.bytes)fail('encoded_bytes_exceeded','$');return `sha256:${sha256Text(text)}`;}
export function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;}
export function frozenClone(value){return deepFreeze(canonicalClone(value));}
export function safeMessage(value,path){const text=boundedString(value,path,256);if(/authorization|bearer|secret|private[ _-]?key|https?:\/\/|[A-Za-z]:\\|\/(?:home|mnt|Users)\//i.test(text))fail('unsafe_message',path);return text;}
