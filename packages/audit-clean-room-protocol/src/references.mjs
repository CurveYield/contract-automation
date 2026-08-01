import { denseArray,exactKeys,identifier,digest } from './boundary.mjs';
export function validateReferenceList(value,path,maximum=10_000){return denseArray(value,path,maximum).map((item,index)=>{const v=exactKeys(item,['id','digest'],`${path}[${index}]`);return{id:identifier(v.id,`${path}[${index}].id`),digest:digest(v.digest,`${path}[${index}].digest`)};}).sort((a,b)=>a.id.localeCompare(b.id));}
