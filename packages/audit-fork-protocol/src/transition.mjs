import { FORK_STATES, FORK_TRANSITIONS } from './constants.mjs';
import { assertEnum, fail } from './internals.mjs';

export function validateForkTransition(from, to) {
  assertEnum(from, FORK_STATES, '$.from');
  assertEnum(to, FORK_STATES, '$.to');
  if (!FORK_TRANSITIONS[from].includes(to)) fail('invalid_transition', `${from} cannot transition to ${to}`, '$.to');
  return Object.freeze({ from, to });
}
