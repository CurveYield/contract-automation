import { fail } from './errors.mjs';
import {
  plainObject, ordinaryArray, exactKeys, ownValue, boundedString, nullableString,
  integer, safeRelativePath, finiteNumber
} from './boundary.mjs';
import { MAX_DURATION_MS, MAX_RECORDS } from './contracts.mjs';

const HARDHAT_STATUSES = new Set(['passed', 'failed', 'skipped']);
const ECHIDNA_STATUSES = new Set(['passed', 'failed']);
const ECHIDNA_TYPES = new Set(['property', 'assertion', 'optimization', 'exploration', 'call', 'foundry', 'overflow']);
const MUTATION_STATUSES = new Set(['killed', 'survived', 'timeout', 'invalid']);
const MUTATION_OPERATORS = new Set([
  'binary-op-mutation', 'unary-operator-mutation', 'require-mutation', 'assignment-mutation',
  'delete-expression-mutation', 'if-cond-mutation', 'swap-arguments-operator-mutation', 'elim-delegate-mutation'
]);
const DEPENDENCY_SEVERITIES = new Set(['critical', 'high', 'moderate', 'low', 'unknown']);

function enumeration(value, path, allowed, code = 'invalid_status') {
  boundedString(value, path, 80, false);
  if (!allowed.has(value)) fail(code, path, `${path} is not allowed`);
  return value;
}

function canonicalString(value) {
  return JSON.stringify(value);
}

function validateCanonicalRecords(items, path, identityOf, compare) {
  const seen = new Map();
  let previous = null;
  for (const item of items) {
    const identity = identityOf(item);
    const encoded = canonicalString(item);
    if (seen.has(identity)) {
      fail(seen.get(identity) === encoded ? 'duplicate_result' : 'conflicting_duplicate', path, `${path} has a duplicate identity`);
    }
    seen.set(identity, encoded);
    if (previous !== null && compare(previous, item) > 0) fail('noncanonical_order', path, `${path} is not canonically ordered`);
    previous = item;
  }
}

function validateStringArray(value, path, maximum = 64) {
  ordinaryArray(value, path, maximum);
  return value.map((item, index) => boundedString(item, `${path}[${index}]`, 512));
}

function hardhatRecord(item, path) {
  plainObject(item, path);
  exactKeys(item, ['file', 'suite', 'name', 'status', 'durationMs', 'errorMessage'], path);
  safeRelativePath(ownValue(item, 'file', `${path}.file`), `${path}.file`);
  boundedString(ownValue(item, 'suite', `${path}.suite`), `${path}.suite`, 512);
  boundedString(ownValue(item, 'name', `${path}.name`), `${path}.name`, 512, false);
  enumeration(ownValue(item, 'status', `${path}.status`), `${path}.status`, HARDHAT_STATUSES);
  integer(ownValue(item, 'durationMs', `${path}.durationMs`), `${path}.durationMs`, 0, MAX_DURATION_MS);
  nullableString(ownValue(item, 'errorMessage', `${path}.errorMessage`), `${path}.errorMessage`);
}

export function validateHardhatRecords(value) {
  const path = '$.hardhatTests';
  ordinaryArray(value, path);
  value.forEach((item, index) => hardhatRecord(item, `${path}[${index}]`));
  validateCanonicalRecords(
    value, path,
    (item) => JSON.stringify([item.file, item.suite, item.name]),
    (a, b) => a.file.localeCompare(b.file) || a.suite.localeCompare(b.suite) || a.name.localeCompare(b.name)
  );
  return {
    passed: value.filter((item) => item.status === 'passed').length,
    failed: value.filter((item) => item.status === 'failed').length,
    skipped: value.filter((item) => item.status === 'skipped').length,
    total: value.length
  };
}

function transaction(item, path) {
  plainObject(item, path);
  exactKeys(item, ['contract', 'function', 'arguments', 'gas', 'gasprice'], path);
  boundedString(ownValue(item, 'contract', `${path}.contract`), `${path}.contract`, 512, false);
  boundedString(ownValue(item, 'function', `${path}.function`), `${path}.function`, 512, false);
  validateStringArray(ownValue(item, 'arguments', `${path}.arguments`), `${path}.arguments`);
  integer(ownValue(item, 'gas', `${path}.gas`), `${path}.gas`);
  integer(ownValue(item, 'gasprice', `${path}.gasprice`), `${path}.gasprice`);
}

function echidnaRecord(item, path) {
  plainObject(item, path);
  exactKeys(item, ['contract', 'name', 'status', 'testType', 'error', 'counterexample'], path);
  boundedString(ownValue(item, 'contract', `${path}.contract`), `${path}.contract`, 512, false);
  boundedString(ownValue(item, 'name', `${path}.name`), `${path}.name`, 512, false);
  enumeration(ownValue(item, 'status', `${path}.status`), `${path}.status`, ECHIDNA_STATUSES);
  enumeration(ownValue(item, 'testType', `${path}.testType`), `${path}.testType`, ECHIDNA_TYPES, 'invalid_test_type');
  nullableString(ownValue(item, 'error', `${path}.error`), `${path}.error`);
  const counterexample = ownValue(item, 'counterexample', `${path}.counterexample`);
  ordinaryArray(counterexample, `${path}.counterexample`, 1_000);
  counterexample.forEach((entry, index) => transaction(entry, `${path}.counterexample[${index}]`));
}

export function validateEchidnaRecords(value) {
  const path = '$.echidnaProperties';
  ordinaryArray(value, path);
  value.forEach((item, index) => echidnaRecord(item, `${path}[${index}]`));
  validateCanonicalRecords(
    value, path,
    (item) => JSON.stringify([item.contract, item.name]),
    (a, b) => a.contract.localeCompare(b.contract) || a.name.localeCompare(b.name)
  );
  return {
    passed: value.filter((item) => item.status === 'passed').length,
    failed: value.filter((item) => item.status === 'failed').length,
    total: value.length
  };
}

function mutationRecord(item, path) {
  plainObject(item, path);
  exactKeys(item, ['id', 'status', 'operator', 'file', 'line', 'column', 'killedBy'], path);
  boundedString(ownValue(item, 'id', `${path}.id`), `${path}.id`, 160, false);
  enumeration(ownValue(item, 'status', `${path}.status`), `${path}.status`, MUTATION_STATUSES);
  enumeration(ownValue(item, 'operator', `${path}.operator`), `${path}.operator`, MUTATION_OPERATORS, 'invalid_mutation_operator');
  safeRelativePath(ownValue(item, 'file', `${path}.file`), `${path}.file`);
  integer(ownValue(item, 'line', `${path}.line`), `${path}.line`, 1, 10_000_000);
  integer(ownValue(item, 'column', `${path}.column`), `${path}.column`, 1, 1_000_000);
  nullableString(ownValue(item, 'killedBy', `${path}.killedBy`), `${path}.killedBy`, 512, false);
}

export function validateMutationRecords(value) {
  const path = '$.mutationResults';
  ordinaryArray(value, path);
  value.forEach((item, index) => mutationRecord(item, `${path}[${index}]`));
  validateCanonicalRecords(value, path, (item) => item.id, (a, b) => a.id.localeCompare(b.id));
  const killed = value.filter((item) => item.status === 'killed').length;
  const survived = value.filter((item) => item.status === 'survived').length;
  const timedOut = value.filter((item) => item.status === 'timeout').length;
  const invalid = value.filter((item) => item.status === 'invalid').length;
  const denominator = killed + survived;
  return {
    killed, survived, timedOut, invalid, total: value.length,
    mutationScore: denominator === 0 ? 100 : Math.round((killed / denominator) * 10_000) / 100
  };
}

function aliases(value, path) {
  validateStringArray(value, path, 64);
  const seen = new Set();
  let previous = null;
  for (const alias of value) {
    if (seen.has(alias)) fail('duplicate_result', path, `${path} contains a duplicate`);
    if (previous !== null && previous.localeCompare(alias) > 0) fail('noncanonical_order', path, `${path} is not canonically ordered`);
    seen.add(alias);
    previous = alias;
  }
}

function dependencyRecord(item, path) {
  plainObject(item, path);
  exactKeys(item, ['sourcePath', 'sourceType', 'package', 'id', 'aliases', 'summary', 'severity', 'fixedVersion'], path);
  safeRelativePath(ownValue(item, 'sourcePath', `${path}.sourcePath`), `${path}.sourcePath`);
  boundedString(ownValue(item, 'sourceType', `${path}.sourceType`), `${path}.sourceType`, 80, false);
  const packageValue = ownValue(item, 'package', `${path}.package`);
  plainObject(packageValue, `${path}.package`);
  exactKeys(packageValue, ['name', 'version', 'ecosystem'], `${path}.package`);
  boundedString(ownValue(packageValue, 'name', `${path}.package.name`), `${path}.package.name`, 512, false);
  boundedString(ownValue(packageValue, 'version', `${path}.package.version`), `${path}.package.version`, 160, false);
  boundedString(ownValue(packageValue, 'ecosystem', `${path}.package.ecosystem`), `${path}.package.ecosystem`, 80, false);
  boundedString(ownValue(item, 'id', `${path}.id`), `${path}.id`, 160, false);
  aliases(ownValue(item, 'aliases', `${path}.aliases`), `${path}.aliases`);
  boundedString(ownValue(item, 'summary', `${path}.summary`), `${path}.summary`);
  enumeration(ownValue(item, 'severity', `${path}.severity`), `${path}.severity`, DEPENDENCY_SEVERITIES, 'invalid_severity');
  nullableString(ownValue(item, 'fixedVersion', `${path}.fixedVersion`), `${path}.fixedVersion`, 160, false);
}

function dependencyIdentity(item) {
  return JSON.stringify([
    item.sourcePath, item.sourceType, item.package.ecosystem,
    item.package.name, item.package.version, item.id
  ]);
}

function dependencyCompare(a, b) {
  return a.sourcePath.localeCompare(b.sourcePath) ||
    a.sourceType.localeCompare(b.sourceType) ||
    a.package.ecosystem.localeCompare(b.package.ecosystem) ||
    a.package.name.localeCompare(b.package.name) ||
    a.package.version.localeCompare(b.package.version) ||
    a.id.localeCompare(b.id);
}

export function validateDependencyRecords(value) {
  const path = '$.dependencyFindings';
  ordinaryArray(value, path);
  value.forEach((item, index) => dependencyRecord(item, `${path}[${index}]`));
  validateCanonicalRecords(value, path, dependencyIdentity, dependencyCompare);
  const summary = { critical: 0, high: 0, moderate: 0, low: 0, unknown: 0, total: value.length };
  for (const item of value) summary[item.severity] += 1;
  return summary;
}

export function validateMutationScore(value, path) {
  return finiteNumber(value, path, 0, 100);
}
