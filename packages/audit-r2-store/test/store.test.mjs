import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ConditionalWriteError,
  InMemoryAuditStore,
  R2_BILLING_CLASS,
  classifyR2Operation
} from '../src/index.mjs';

test('classifies the R2 operations used by Audit', () => {
  for (const method of ['put', 'copy', 'list', 'createMultipartUpload', 'uploadPart', 'completeMultipartUpload']) {
    assert.equal(classifyR2Operation(method), R2_BILLING_CLASS.CLASS_A);
  }
  for (const method of ['get', 'head', 'usageSummary']) {
    assert.equal(classifyR2Operation(method), R2_BILLING_CLASS.CLASS_B);
  }
  for (const method of ['delete', 'abortMultipartUpload']) {
    assert.equal(classifyR2Operation(method), R2_BILLING_CLASS.FREE);
  }
  assert.throws(() => classifyR2Operation('unknown'));
});

test('store deliberately exposes no list method', () => {
  const store = new InMemoryAuditStore();
  assert.equal(store.list, undefined);
});

test('put, get, and head record Class A and Class B usage', async () => {
  const store = new InMemoryAuditStore();
  const saved = await store.put('jobs/job_1/status-v1.json', JSON.stringify({ status: 'queued' }));
  assert.match(saved.etag, /^[a-f0-9]{64}$/);
  const head = await store.head('jobs/job_1/status-v1.json');
  const body = await store.get('jobs/job_1/status-v1.json');
  assert.equal(head.etag, saved.etag);
  assert.equal(body.value, JSON.stringify({ status: 'queued' }));
  assert.deepEqual(store.usage(), { classA: 1, classB: 2, free: 0, storedBytes: body.size });
});

test('conditional writes reject stale etags without changing the object', async () => {
  const store = new InMemoryAuditStore();
  const first = await store.put('state.json', 'one');
  const second = await store.put('state.json', 'two', { onlyIf: { etagMatches: first.etag } });
  await assert.rejects(
    store.put('state.json', 'stale', { onlyIf: { etagMatches: first.etag } }),
    (error) => error instanceof ConditionalWriteError && error.code === 'precondition_failed'
  );
  assert.equal((await store.get('state.json')).etag, second.etag);
  assert.equal((await store.get('state.json')).value, 'two');
});

test('etagDoesNotMatch supports create-only writes', async () => {
  const store = new InMemoryAuditStore();
  await store.put('immutable.json', 'first', { onlyIf: { etagDoesNotMatch: '*' } });
  await assert.rejects(
    store.put('immutable.json', 'second', { onlyIf: { etagDoesNotMatch: '*' } }),
    ConditionalWriteError
  );
});

test('delete is free and releases stored bytes', async () => {
  const store = new InMemoryAuditStore();
  await store.put('temporary.bin', new Uint8Array([1, 2, 3]));
  await store.delete('temporary.bin');
  assert.equal(await store.get('temporary.bin'), null);
  assert.deepEqual(store.usage(), { classA: 1, classB: 1, free: 1, storedBytes: 0 });
});
