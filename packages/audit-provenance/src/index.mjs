import { canonicalJson, frozenClone, sha256 } from '../../audit-clean-room-protocol/src/index.mjs';

export const PROVENANCE_EVENT_SCHEMA_VERSION = 'phase8-provenance-event-v1';
export const PROVENANCE_CHAIN_SCHEMA_VERSION = 'phase8-provenance-chain-v1';
function error(code, message = code) { return Object.assign(new Error(message), { code }); }
function parse(record) { return record ? JSON.parse(typeof record.value === 'string' ? record.value : new TextDecoder().decode(record.value)) : null; }

export function createProvenanceEvent(input) {
  const body = {
    schemaVersion: PROVENANCE_EVENT_SCHEMA_VERSION,
    eventId: input.eventId,
    sequence: input.sequence,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    campaignId: input.campaignId ?? null,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    subjectDigest: input.subjectDigest,
    action: input.action,
    actorId: input.actorId,
    policyId: input.policyId,
    previousDigest: input.previousDigest ?? null,
    occurredAt: input.occurredAt,
    executionEnabled: false
  };
  if (!Number.isSafeInteger(body.sequence) || body.sequence < 1) throw error('invalid_sequence');
  body.eventDigest = sha256(body);
  return frozenClone(body);
}

export function validateProvenanceEvent(value) {
  if (!value || value.schemaVersion !== PROVENANCE_EVENT_SCHEMA_VERSION || value.executionEnabled !== false) throw error('invalid_provenance_event');
  const digest = value.eventDigest;
  const body = structuredClone(value); delete body.eventDigest;
  if (digest !== sha256(body)) throw error('provenance_digest_mismatch');
  return frozenClone(value);
}

export function validateProvenanceChain(events) {
  if (!Array.isArray(events)) throw error('invalid_provenance_chain');
  const ordered = events.map(validateProvenanceEvent).sort((a,b)=>a.sequence-b.sequence);
  for (let index=0; index<ordered.length; index+=1) {
    const expectedSequence=index+1;
    if (ordered[index].sequence!==expectedSequence) throw error('provenance_sequence_gap');
    const expectedPrevious=index===0?null:ordered[index-1].eventDigest;
    if (ordered[index].previousDigest!==expectedPrevious) throw error('provenance_chain_mismatch');
  }
  const chain = { schemaVersion: PROVENANCE_CHAIN_SCHEMA_VERSION, events: ordered, headDigest: ordered.at(-1)?.eventDigest ?? null, executionEnabled: false };
  chain.chainDigest = sha256(chain);
  return frozenClone(chain);
}

export class ProvenanceService {
  constructor(store) { if (!store || typeof store.get !== 'function' || typeof store.put !== 'function') throw new TypeError('ProvenanceService requires an Audit store'); this.store=store; }
  eventKey(workspaceId,sequence){ return `provenance/workspaces/${workspaceId}/events/${String(sequence).padStart(12,'0')}-v1.json`; }
  headKey(workspaceId){ return `provenance/workspaces/${workspaceId}/head-v1.json`; }
  async append(input) {
    const headRecord=await this.store.get(this.headKey(input.workspaceId));
    const head=parse(headRecord) ?? { schemaVersion:'phase8-provenance-head-v1', workspaceId:input.workspaceId, sequence:0, eventDigest:null };
    if (input.sequence!==head.sequence+1 || (input.previousDigest??null)!==head.eventDigest) throw error('provenance_stale_head');
    const event=createProvenanceEvent(input);
    await this.store.put(this.eventKey(input.workspaceId,event.sequence),canonicalJson(event),{onlyIf:{etagDoesNotMatch:'*'}});
    const next={schemaVersion:'phase8-provenance-head-v1',workspaceId:input.workspaceId,sequence:event.sequence,eventDigest:event.eventDigest,updatedAt:event.occurredAt};
    await this.store.put(this.headKey(input.workspaceId),canonicalJson(next),headRecord?{onlyIf:{etagMatches:headRecord.etag}}:{onlyIf:{etagDoesNotMatch:'*'}});
    return event;
  }
  async readHead(workspaceId){ const record=await this.store.get(this.headKey(workspaceId)); return frozenClone(parse(record) ?? {schemaVersion:'phase8-provenance-head-v1',workspaceId,sequence:0,eventDigest:null}); }
}

export * from './contracts.mjs';
export * from './graph.mjs';
