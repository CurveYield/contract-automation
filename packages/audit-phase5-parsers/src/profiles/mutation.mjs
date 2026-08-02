import {
  MAX_DURATION_MS,
  MAX_COUNTEREXAMPLE_STEPS,
  MAX_ALIASES,
  MUTATION_OPERATORS,
  SEVERITIES,
  deepFreeze,
  fault,
  plainObject,
  exactKeys,
  array,
  integer,
  cleanString,
  cleanMessage,
  safePath,
  stringArray,
  baseResult,
  dedupeAndSort,
  canonicalizeByIdentity,
  evidenceFor
} from '../common.mjs';

export function parseMutation(profileId, parserVersion, prepared, root) {
  plainObject(root, '$.result');
  exactKeys(root, new Set(['mutants']), '$.result');
  const records = array(root.mutants, '$.result.mutants').map((item, index) => {
    const path = `$.result.mutants[${index}]`;
    plainObject(item, path);
    exactKeys(item, new Set(['id', 'status', 'operator', 'file', 'line', 'column', 'killedBy']), path);
    const status = cleanString(item.status, `${path}.status`, 32, false);
    if (!['killed', 'survived', 'timeout', 'invalid'].includes(status)) throw fault('invalid_status', '$.result.mutants contains an invalid status');
    const operator = cleanString(item.operator, `${path}.operator`, 80, false);
    if (!MUTATION_OPERATORS.has(operator)) throw fault('invalid_mutation_operator', '$.result.mutants contains an invalid mutation operator');
    return {
      id: cleanString(item.id, `${path}.id`, 160, false),
      status,
      operator,
      file: safePath(item.file, `${path}.file`),
      line: integer(item.line, `${path}.line`, 1, 10_000_000),
      column: integer(item.column, `${path}.column`, 1, 1_000_000),
      killedBy: item.killedBy === undefined ? null : cleanString(item.killedBy, `${path}.killedBy`, 512, false)
    };
  });
  const mutationResults = canonicalizeByIdentity(
    records,
    (item) => item.id,
    'mutation',
    (a, b) => a.id.localeCompare(b.id)
  );
  const killed = mutationResults.filter((item) => item.status === 'killed').length;
  const survived = mutationResults.filter((item) => item.status === 'survived').length;
  const timedOut = mutationResults.filter((item) => item.status === 'timeout').length;
  const invalid = mutationResults.filter((item) => item.status === 'invalid').length;
  const denominator = killed + survived;
  const mutationScore = denominator === 0 ? 100 : Math.round((killed / denominator) * 10_000) / 100;
  const summary = { killed, survived, timedOut, invalid, total: mutationResults.length, mutationScore };
  const classification = prepared.exitCode !== 0 || survived > 0 || timedOut > 0 || invalid > 0 ? 'findings' : 'success';
  return deepFreeze({
    ...baseResult(profileId, parserVersion, prepared, classification),
    mutationResults,
    evidence: evidenceFor('mutation-summary', mutationResults.length),
    summary
  });
}
