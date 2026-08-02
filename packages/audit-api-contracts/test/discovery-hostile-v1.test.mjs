import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAuditReadScope,
  validateReportReference
} from '../src/discovery.mjs';
import { validateStatusSummary } from '../src/status.mjs';
import { validateExternalValue } from '../src/index.mjs';
import {
  createAcceptedPhase5Catalog,
  createAcceptedPhase6Catalog
} from '../../audit-catalog-composition/src/index.mjs';

function validReport() {
  return {
    schemaVersion: 'audit-report-reference-v1',
    reportId: 'report-a',
    tenantId: 'tenant-a',
    workspaceId: 'workspace-a',
    campaignId: 'campaign-a',
    jobId: 'job-a',
    reportSchemaVersion: 'audit-report-v1',
    digest: `sha256:${'a'.repeat(64)}`,
    createdAt: '2026-08-01T00:00:00.000Z',
    summary: {
      classification: 'findings',
      findingCount: 2,
      evidenceCount: 3,
      truncated: false
    }
  };
}

function validStatus() {
  return {
    schemaVersion: 'audit-status-summary-v1',
    resourceType: 'job',
    resourceId: 'job-a',
    tenantId: 'tenant-a',
    workspaceId: 'workspace-a',
    state: 'completed',
    updatedAt: '2026-08-01T00:00:00.000Z',
    terminal: true,
    progress: { completed: 1, total: 1 }
  };
}

const statusOptions = {
  resourceType: 'job',
  resourceId: 'job-a',
  tenantId: 'tenant-a',
  workspaceId: 'workspace-a'
};

test('report contract rejects every one-field identity, schema, count, and shape mutation', () => {
  const mutations = [
    (value) => { value.schemaVersion = 'wrong'; },
    (value) => { value.reportId = ''; },
    (value) => { value.tenantId = 'tenant/other'; },
    (value) => { value.workspaceId = 'workspace/other'; },
    (value) => { value.campaignId = ''; },
    (value) => { value.jobId = ''; },
    (value) => { value.reportSchemaVersion = ''; },
    (value) => { value.digest = 'sha256:bad'; },
    (value) => { value.createdAt = 'not-a-date'; },
    (value) => { value.summary.classification = 'executed'; },
    (value) => { value.summary.findingCount = -1; },
    (value) => { value.summary.evidenceCount = Number.MAX_SAFE_INTEGER; },
    (value) => { value.summary.truncated = 'false'; },
    (value) => { value.url = 'https://attacker.example/report'; }
  ];
  for (const mutate of mutations) {
    const value = validReport();
    mutate(value);
    assert.throws(() => validateReportReference(value));
  }
  const valid = validateReportReference(validReport());
  assert.ok(Object.isFrozen(valid));
  assert.ok(Object.isFrozen(valid.summary));
  assert.equal(JSON.stringify(valid), JSON.stringify(validateReportReference(validReport())));
});

test('status contract rejects every one-field scope, lifecycle, progress, and shape mutation', () => {
  const mutations = [
    (value) => { value.schemaVersion = 'wrong'; },
    (value) => { value.resourceType = 'fork'; },
    (value) => { value.resourceId = 'job-other'; },
    (value) => { value.tenantId = 'tenant-other'; },
    (value) => { value.workspaceId = 'workspace-other'; },
    (value) => { value.state = 'executing'; },
    (value) => { value.updatedAt = 'yesterday'; },
    (value) => { value.terminal = 1; },
    (value) => { value.progress.completed = -1; },
    (value) => { value.progress.total = Number.MAX_SAFE_INTEGER; },
    (value) => { value.progress.completed = 2; },
    (value) => { value.debug = { token: 'secret' }; }
  ];
  for (const mutate of mutations) {
    const value = validStatus();
    mutate(value);
    assert.throws(() => validateStatusSummary(value, statusOptions));
  }
  const valid = validateStatusSummary(validStatus(), statusOptions);
  assert.ok(Object.isFrozen(valid));
  assert.ok(Object.isFrozen(valid.progress));
  assert.equal(JSON.stringify(valid), JSON.stringify(validateStatusSummary(validStatus(), statusOptions)));
});

test('read-scope and discovery boundaries reject accessors, proxies, cycles, sparse arrays, and custom prototypes without getter execution', () => {
  let getterCalls = 0;
  const getterScope = {};
  Object.defineProperty(getterScope, 'client', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return { tenantId: 'tenant-a', workspaceId: 'workspace-a' };
    }
  });
  assert.throws(
    () => resolveAuditReadScope({ identity: 'client' }, { AUDIT_READ_SCOPES: getterScope }),
    (error) => error.code === 'forbidden'
  );
  assert.equal(getterCalls, 0);

  const report = validReport();
  Object.defineProperty(report, 'reportId', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'report-a';
    }
  });
  assert.throws(
    () => validateReportReference(report),
    (error) => error.code === 'hostile_object'
  );
  assert.equal(getterCalls, 0);

  const hostileProxy = new Proxy({}, {
    ownKeys() { throw new Error('attacker text must not escape'); }
  });
  assert.throws(
    () => validateExternalValue(hostileProxy),
    (error) => error.code === 'hostile_object' && !error.message.includes('attacker text')
  );

  const cycle = {};
  cycle.self = cycle;
  assert.throws(() => validateExternalValue(cycle), (error) => error.code === 'cyclic_value');

  const sparse = [];
  sparse.length = 3;
  sparse[2] = 'x';
  assert.throws(() => validateExternalValue(sparse), (error) => error.code === 'sparse_array');
  assert.throws(
    () => validateExternalValue(Object.create({ inherited: true })),
    (error) => error.code === 'invalid_plain_object'
  );
});

test('hostile reflection is single-pass, normalized, and never reads array values through proxy get traps', () => {
  let ownKeysCalls = 0;
  const unstableKeys = new Proxy({}, {
    ownKeys() {
      ownKeysCalls += 1;
      if (ownKeysCalls === 1) return [];
      throw new Error('second reflection must not occur');
    }
  });
  assert.deepEqual(validateExternalValue(unstableKeys), {});
  assert.equal(ownKeysCalls, 1);

  const badPrototype = new Proxy({}, {
    ownKeys() { return []; },
    getPrototypeOf() { throw new Error('prototype trap text'); }
  });
  assert.throws(
    () => validateExternalValue(badPrototype),
    (error) => error.code === 'hostile_object' && !error.message.includes('prototype trap text')
  );

  let getCalls = 0;
  const arrayProxy = new Proxy(['a', 'b'], {
    get(target, key, receiver) {
      getCalls += 1;
      return Reflect.get(target, key, receiver);
    }
  });
  assert.deepEqual(validateExternalValue(arrayProxy), ['a', 'b']);
  assert.equal(getCalls, 0);
});

test('external value bounds reject oversized strings, arrays, objects, and depth', () => {
  assert.throws(
    () => validateExternalValue('x'.repeat(8_193)),
    (error) => error.code === 'invalid_string'
  );
  assert.throws(
    () => validateExternalValue(Array.from({ length: 1_001 }, () => 0)),
    (error) => error.code === 'collection_too_large'
  );
  assert.throws(
    () => validateExternalValue(Object.fromEntries(
      Array.from({ length: 1_001 }, (_, index) => [`k${index}`, index])
    )),
    (error) => error.code === 'collection_too_large'
  );
  let nested = null;
  for (let index = 0; index < 26; index += 1) nested = { nested };
  assert.throws(
    () => validateExternalValue(nested),
    (error) => error.code === 'value_too_deep'
  );
});

test('accepted catalog snapshots are defensive, recursively frozen, and fresh per call', () => {
  for (const create of [createAcceptedPhase5Catalog, createAcceptedPhase6Catalog]) {
    const first = create();
    const serialized = JSON.stringify(first);
    assert.ok(Object.isFrozen(first));
    assert.ok(first.every((entry) => Object.isFrozen(entry)));
    assert.throws(() => { first[0].profileId = 'mutated'; }, TypeError);
    assert.equal(JSON.stringify(create()), serialized);
  }
});
