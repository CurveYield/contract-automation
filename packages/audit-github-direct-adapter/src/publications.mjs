import {
  DIRECT_MODE_ID,
  exactKeys,
  plainObject,
  validateDirectRequest,
  boundedString,
  enumValue,
  timestamp,
  sha256,
  frozenClone,
  canonicalJson,
  fail,
  integer,
  fullName,
  commitSha,
  identifier,
  digest
} from '../../audit-github-direct-protocol/src/index.mjs';

const PUBLICATION_KINDS = Object.freeze(['check', 'comment', 'status']);

function base(requestInput, kind, at) {
  const request = validateDirectRequest(requestInput);
  return {
    request,
    base: {
      schemaVersion: 'github-direct-publication-plan-v1',
      modeId: request.modeId,
      kind,
      repositoryId: request.repositoryId,
      installationId: request.installationId,
      repositoryFullName: request.repositoryFullName,
      targetCommitSha: request.targetCommitSha,
      jobId: request.jobId,
      idempotencyKey: `${kind}-${request.jobId}`,
      at: timestamp(at, '$.at')
    }
  };
}

function finish(body) {
  const publicationDigest = sha256(body);
  return frozenClone({
    ...body,
    publicationId: `direct-${body.kind}-${publicationDigest.slice(7, 31)}`,
    publicationDigest
  });
}

export function planCheckPublication(input) {
  const v = exactKeys(input, ['request', 'name', 'summary', 'conclusion', 'at'], '$');
  const { base: body } = base(v.request, 'check', v.at);
  return finish({
    ...body,
    name: boundedString(v.name, '$.name', 100),
    summary: boundedString(v.summary, '$.summary', 65_535, true),
    conclusion: enumValue(
      v.conclusion,
      ['success', 'failure', 'neutral', 'cancelled', 'timed_out', 'action_required'],
      '$.conclusion'
    )
  });
}

export function planCommentPublication(input) {
  const v = exactKeys(input, ['request', 'body', 'at'], '$');
  const { base: body } = base(v.request, 'comment', v.at);
  return finish({ ...body, body: boundedString(v.body, '$.body', 65_535) });
}

export function planStatusPublication(input) {
  const v = exactKeys(input, ['request', 'state', 'description', 'context', 'at'], '$');
  const { base: body } = base(v.request, 'status', v.at);
  return finish({
    ...body,
    state: enumValue(v.state, ['error', 'failure', 'pending', 'success'], '$.state'),
    description: boundedString(v.description, '$.description', 140),
    context: boundedString(v.context, '$.context', 100)
  });
}

function publicationKind(input) {
  const descriptors = plainObject(input, '$');
  if (!Object.hasOwn(descriptors, 'kind')) fail('missing_field', '$.kind');
  return enumValue(descriptors.kind.value, PUBLICATION_KINDS, '$.kind');
}

export function validatePublicationPlan(input) {
  const common = [
    'schemaVersion', 'modeId', 'kind', 'repositoryId', 'installationId',
    'repositoryFullName', 'targetCommitSha', 'jobId', 'idempotencyKey', 'at'
  ];
  const kind = publicationKind(input);
  const extra = kind === 'check'
    ? ['name', 'summary', 'conclusion']
    : kind === 'comment'
      ? ['body']
      : ['state', 'description', 'context'];
  const v = exactKeys(input, [...common, ...extra, 'publicationId', 'publicationDigest'], '$');
  if (v.schemaVersion !== 'github-direct-publication-plan-v1') fail('invalid_schema', '$.schemaVersion');
  if (v.modeId !== DIRECT_MODE_ID) fail('invalid_mode', '$.modeId');

  const body = {
    schemaVersion: v.schemaVersion,
    modeId: v.modeId,
    kind,
    repositoryId: integer(v.repositoryId, '$.repositoryId', 1),
    installationId: integer(v.installationId, '$.installationId', 1),
    repositoryFullName: fullName(v.repositoryFullName, '$.repositoryFullName'),
    targetCommitSha: commitSha(v.targetCommitSha, '$.targetCommitSha'),
    jobId: identifier(v.jobId, '$.jobId'),
    idempotencyKey: boundedString(v.idempotencyKey, '$.idempotencyKey', 160),
    at: timestamp(v.at, '$.at')
  };
  const wanted = `${kind}-${body.jobId}`;
  if (body.idempotencyKey !== wanted) fail('idempotency_mismatch', '$.idempotencyKey');

  if (kind === 'check') {
    body.name = boundedString(v.name, '$.name', 100);
    body.summary = boundedString(v.summary, '$.summary', 65_535, true);
    body.conclusion = enumValue(
      v.conclusion,
      ['success', 'failure', 'neutral', 'cancelled', 'timed_out', 'action_required'],
      '$.conclusion'
    );
  } else if (kind === 'comment') {
    body.body = boundedString(v.body, '$.body', 65_535);
  } else {
    body.state = enumValue(v.state, ['error', 'failure', 'pending', 'success'], '$.state');
    body.description = boundedString(v.description, '$.description', 140);
    body.context = boundedString(v.context, '$.context', 100);
  }

  const publicationDigest = digest(v.publicationDigest, '$.publicationDigest');
  const expected = sha256(body);
  if (publicationDigest !== expected) fail('digest_mismatch', '$.publicationDigest');
  const publicationId = identifier(v.publicationId, '$.publicationId');
  if (publicationId !== `direct-${kind}-${expected.slice(7, 31)}`) {
    fail('identity_mismatch', '$.publicationId');
  }
  return frozenClone({ ...body, publicationId, publicationDigest });
}

export function reconcilePublication(input) {
  const v = exactKeys(input, ['plan', 'observed'], '$');
  const plan = validatePublicationPlan(v.plan);
  if (v.observed === null) return frozenClone({ action: 'create', plan });
  let observed;
  try {
    observed = validatePublicationPlan(v.observed);
  } catch {
    fail('publication_conflict', '$.observed');
  }
  if (canonicalJson(observed) !== canonicalJson(plan)) fail('publication_conflict', '$.observed');
  return frozenClone({ action: 'noop', plan });
}
