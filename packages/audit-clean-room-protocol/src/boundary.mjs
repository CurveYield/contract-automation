import { sha256Hex,utf8ByteLength } from './digest.mjs';
export class CleanRoomValidationError extends Error{constructor(code,path,message=code){super(message);this.name='CleanRoomValidationError';this.code=code;this.path=path;}}
export function fail(code,path,message=code){throw new CleanRoomValidationError(code,path,message);}
const CONTROL=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
export function canonicalJson(value){if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);if(typeof value==='number'){if(!Number.isSafeInteger(value)||Object.is(value,-0))fail('invalid_number','$');return JSON.stringify(value);}if(Array.isArray(value))return`[${value.map(canonicalJson).join(',')}]`;return`{${Object.keys(value).sort().map((key)=>`${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;}
export function frozenClone(value){const clone=structuredClone(value);const freeze=(item)=>{if(item&&typeof item==='object'&&!Object.isFrozen(item)){for(const child of Object.values(item))freeze(child);Object.freeze(item);}return item;};return freeze(clone);}
function inspect(value,path){try{return{prototype:Object.getPrototypeOf(value),keys:Reflect.ownKeys(value),descriptors:Object.getOwnPropertyDescriptors(value)};}catch{fail('hostile_reflection',path);}}
export function sanitize(value,path='$',seen=new Map()){
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='string'){if(CONTROL.test(value))fail('unsafe_control',path);if(utf8ByteLength(value)>2_000_000)fail('value_too_large',path);return value;}
  if(typeof value==='number'){if(!Number.isSafeInteger(value)||Object.is(value,-0))fail('invalid_number',path);return value;}
  if(typeof value!=='object'||typeof value==='function'||typeof value==='symbol'||typeof value==='bigint')fail('invalid_type',path);
  if(seen.has(value))fail('cyclic_value',path);seen.set(value,path);
  const shape=inspect(value,path);if(shape.keys.some((key)=>typeof key==='symbol'))fail('symbol_property',path);
  if(Array.isArray(value)){if(shape.prototype!==Array.prototype)fail('invalid_array',path);const length=shape.descriptors.length?.value;if(!Number.isSafeInteger(length)||shape.keys.filter((key)=>key!=='length').length!==length)fail('sparse_array',path);const result=[];for(let index=0;index<length;index+=1){const descriptor=shape.descriptors[String(index)];if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)fail('hostile_descriptor',`${path}[${index}]`);result.push(sanitize(descriptor.value,`${path}[${index}]`,seen));}seen.delete(value);return result;}
  if(shape.prototype!==Object.prototype&&shape.prototype!==null)fail('invalid_plain_object',path);
  const result={};for(const key of shape.keys.map(String).sort()){const descriptor=shape.descriptors[key];if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)fail('hostile_descriptor',`${path}.${key}`);Object.defineProperty(result,key,{value:sanitize(descriptor.value,`${path}.${key}`,seen),enumerable:true,writable:true,configurable:true});}seen.delete(value);return result;
}
export function exactKeys(value,keys,path='$'){const safe=sanitize(value,path);const expected=new Set(keys);for(const key of Object.keys(safe))if(!expected.has(key))fail('unknown_field',`${path}.${key}`);for(const key of keys)if(!Object.hasOwn(safe,key))fail('missing_field',`${path}.${key}`);return safe;}
export function boundedString(value,path,maximum=256){if(typeof value!=='string'||value.length<1||value.length>maximum||CONTROL.test(value))fail('invalid_string',path);return value;}
export function identifier(value,path){return boundedString(value,path,128).match(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)?value:fail('invalid_identifier',path);}
export function safePath(value,path){const result=boundedString(value,path,512).replaceAll('\\','/');if(result.startsWith('/')||/^[A-Za-z]:\//.test(result)||result.includes('//')||result.split('/').includes('..')||!/^[A-Za-z0-9_.@+\/-]+$/.test(result))fail('unsafe_path',path);return result;}
export function digest(value,path){return typeof value==='string'&&/^sha256:[0-9a-f]{64}$/.test(value)?value:fail('invalid_digest',path);}
export function timestamp(value,path){boundedString(value,path,40);const date=new Date(value);if(Number.isNaN(date.getTime())||date.toISOString()!==value)fail('invalid_timestamp',path);return value;}
export function integer(value,path,minimum=0,maximum=Number.MAX_SAFE_INTEGER){if(!Number.isSafeInteger(value)||Object.is(value,-0)||value<minimum||value>maximum)fail('invalid_integer',path);return value;}
export function boolean(value,path){if(typeof value!=='boolean')fail('invalid_boolean',path);return value;}
export function enumValue(value,allowed,path){return allowed.includes(value)?value:fail('invalid_enum',path);}
export function denseArray(value,path,maximum=10_000){if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>maximum)fail('invalid_array',path);for(let index=0;index<value.length;index+=1)if(!Object.hasOwn(value,index))fail('sparse_array',path);return value;}
export function stringArray(value,path,{item=(x,p)=>boundedString(x,p),maximum=10_000}={}){const result=denseArray(value,path,maximum).map((x,index)=>item(x,`${path}[${index}]`));if(new Set(result).size!==result.length)fail('duplicate_item',path);return result.sort();}
export function sha256(value){return`sha256:${sha256Hex(canonicalJson(value))}`;}
