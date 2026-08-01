import { frozenClone,fail } from '../../audit-clean-room-protocol/src/index.mjs';
import { HIDDEN_ENVELOPE_SCHEMA,VISIBILITY_DECISION_SCHEMA } from './constants.mjs';
export function createHiddenResourceEnvelope(){return frozenClone({schemaVersion:HIDDEN_ENVELOPE_SCHEMA,status:'not_found',code:'resource_not_found',message:'Resource not found',items:[],total:0,facets:{},notifications:[],signedResource:null,relationHints:[],cacheTag:'hidden-v1',operationBudget:{classA:0,classB:0,bytes:0},timingClass:'constant-hidden-v1'});}
export function enforceHiddenResourceNonInterference(visibilityDecision){if(visibilityDecision?.schemaVersion!==VISIBILITY_DECISION_SCHEMA||visibilityDecision.visible!==false)fail('visibility_required','$.visibilityDecision');return createHiddenResourceEnvelope();}
