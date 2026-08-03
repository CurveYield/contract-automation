import {exactKeys,plainObject,identifier,digest,rawDigest,integer,timestamp,nullable,boolean,enumValue,boundedString,sha256,frozenClone,fail} from '../../audit-phase78-service/src/index.mjs';

export function secondsBetween(start,end,path='$.expiresAt'){
 const seconds=(Date.parse(timestamp(end,path))-Date.parse(timestamp(start,'$.createdAt')))/1000;
 if(!Number.isSafeInteger(seconds)||seconds<0)fail('invalid_retention',path);
 return seconds;
}
export function objectKey(value,path){
 const text=boundedString(value,path,512);
 if(text.startsWith('/')||text.includes('\\')||text.includes('//')||text.split('/').includes('..')||/https?:\/\//i.test(text)||!/^[A-Za-z0-9._@+\/-]+$/.test(text))fail('invalid_object_key',path);
 return text;
}
export function stripTransportFields(value,path,fields=['etag']){
 const desc=plainObject(value,path),out={};
 for(const [key,item] of Object.entries(desc))if(!fields.includes(key))out[key]=item.value;
 return out;
}
export function serviceDigestFromRaw(value,path){return `sha256:${rawDigest(value,path)}`;}
export function finalize(kind,body){
 const core={schemaVersion:`audit-phase9-${kind}-report-v2`,...body};
 const reportDigest=sha256(core);
 return frozenClone({...core,reportId:`${kind}-report-${reportDigest.slice(7,31)}`,reportDigest});
}
export {exactKeys,plainObject,identifier,digest,rawDigest,integer,timestamp,nullable,boolean,enumValue,boundedString,sha256,frozenClone,fail};
