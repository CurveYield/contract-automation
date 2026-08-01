import {
  Phase6ValidationError,
  publishPhase6Profile,
  validatePhase6ProfileConfiguration,
  validateFormalResult
} from '../src/index.mjs';
import { parseHalmosBytes } from '../../audit-phase6-parsers/src/index.mjs';

export {
  Phase6ValidationError,
  publishPhase6Profile,
  validatePhase6ProfileConfiguration,
  validateFormalResult,
  parseHalmosBytes
};

export const bytes = (value) => new TextEncoder().encode(JSON.stringify(value));
export const digest = `sha256:${'b'.repeat(64)}`;

export function emptyResult(overrides = {}) {
  return {
    schemaVersion: 'formal-result-v1',
    profileId: 'formal-obligations-v1',
    outcome: 'unknown',
    obligations: [],
    assertions: [],
    models: [],
    traces: [],
    counterexamples: [],
    diagnostics: [],
    sourceReferences: [],
    parserWarnings: [],
    truncated: false,
    ...overrides
  };
}

export function oldHalmosCapture(overrides = {}) {
  return {
    schemaVersion: 'halmos-capture-v1',
    fixtureOwner: 'CurveYield',
    profileId: 'halmos-v1',
    toolVersion: '0.3.3',
    outcome: 'unknown',
    obligations: [], assertions: [], models: [], traces: [], counterexamples: [],
    diagnostics: [], sourceReferences: [], parserWarnings: [], truncated: false,
    ...overrides
  };
}
