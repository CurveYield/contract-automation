import {exactKeys,identifier,digest,rawDigest,integer,timestamp,nullable,boolean,enumValue,sha256,frozenClone,fail} from '../../audit-phase78-service/src/index.mjs';
export function secondsBetween(start,end,path='$.expiresAt'){const seconds=(Date.parse(timestamp(end,path))-Date.parse(timestamp(start,'$.createdAt')))/1000;if(!Number.isSafeInteger(seconds)||seconds<0)fail('invalid_retention',path);return seconds;}
export function finalize(kind,body){const core={schemaVersion:`audit-phase9-${kind}-report-v1`,...body};const reportDigest=sha256(core);return frozenClone({...core,reportId:`${kind}-report-${reportDigest.slice(7,31)}`,reportDigest});}
export {exactKeys,identifier,digest,rawDigest,integer,timestamp,nullable,boolean,enumValue,frozenClone,fail};
