import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_ROUTE_SCOPES,
  authorizeAuditReadRequest
} from '../src/authorization.mjs';

const request = (token, path = '/audit/v1/resource', extraHeaders = {}) => new Request(
  `https://api.example${path}`,
  { headers: { authorization: `Bearer ${token}`, ...extraHeaders } }
);

const baseEnv = {
  AUDIT_CLIENT_API_KEY: 'client-secret',
  AUDIT_GPT_API_KEY: 'gpt-secret',
  AUDIT_READ_API_KEY: 'legacy-read-secret',
  AUDIT_SUBMIT_API_KEY: 'legacy-submit-secret',
  AUDIT_ADMIN_API_KEY: 'legacy-admin-secret',
  AUDIT_SERVICE_READ_API_KEY: 'service-secret',
  AUDIT_AUTHORIZATION_NOW: '2026-08-02T02:45:00.000Z',
  AUDIT_READ_SCOPES: {
    client: { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
    gpt: { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
    'legacy-read': { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
    'legacy-submit': { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
    'legacy-admin': { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
    'service-read': {
      tenantId: 'tenant-a',
      workspaceId: 'workspace-a',
      scopes: ['job.status.read', 'reports.read'],
      resourceBindings: ['job:job-a', 'report:report-a'],
      expiresAt: '2026-08-02T03:00:00.000Z',
      revoked: false
    }
  }
};

test('route-scope registry is closed, stable, and recursively frozen', () => {
  assert.deepEqual(AUDIT_ROUTE_SCOPES, {
    catalogRead: 'catalog.read',
    capabilitiesRead: 'capabilities.read',
    reportsList: 'reports.list',
    reportRead: 'reports.read',
    workspaceStatusRead: 'workspace.status.read',
    campaignStatusRead: 'campaign.status.read',
    jobStatusRead: 'job.status.read',
    evidenceSummaryRead: 'evidence.summary.read',
    forkStatusRead: 'fork.status.read',
    cleanRoomStatusRead: 'clean-room.status.read'
  });
  assert.ok(Object.isFrozen(AUDIT_ROUTE_SCOPES));
});

test('client and GPT identities receive only their compile-time route allowlist', async () => {
  for (const token of ['client-secret', 'gpt-secret']) {
    for (const routeScope of Object.values(AUDIT_ROUTE_SCOPES)) {
      const context = await authorizeAuditReadRequest(request(token), baseEnv, { routeScope });
      assert.equal(context.tenantId, 'tenant-a');
      assert.equal(context.workspaceId, 'workspace-a');
      assert.equal(context.routeScope, routeScope);
      assert.equal('credentialName' in context, false);
      assert.ok(Object.isFrozen(context));
    }
  }
});

test('legacy aliases remain limited to catalog and report discovery and cannot use GPT status scopes', async () => {
  for (const token of ['legacy-read-secret', 'legacy-submit-secret', 'legacy-admin-secret']) {
    for (const routeScope of [
      AUDIT_ROUTE_SCOPES.catalogRead,
      AUDIT_ROUTE_SCOPES.reportsList,
      AUDIT_ROUTE_SCOPES.reportRead
    ]) {
      assert.equal((await authorizeAuditReadRequest(request(token), baseEnv, { routeScope })).routeScope, routeScope);
    }
    await assert.rejects(
      () => authorizeAuditReadRequest(request(token), baseEnv, {
        routeScope: AUDIT_ROUTE_SCOPES.jobStatusRead,
        resourceType: 'job',
        resourceId: 'job-a'
      }),
      (error) => error.code === 'forbidden' && error.status === 403
    );
  }
});

test('service identity requires exact route scope, unexpired grant, and exact resource binding', async () => {
  const job = await authorizeAuditReadRequest(request('service-secret'), baseEnv, {
    routeScope: AUDIT_ROUTE_SCOPES.jobStatusRead,
    resourceType: 'job',
    resourceId: 'job-a'
  });
  assert.deepEqual(job, {
    identity: 'service-read',
    tenantId: 'tenant-a',
    workspaceId: 'workspace-a',
    routeScope: 'job.status.read',
    serviceBound: true
  });
  await assert.rejects(
    () => authorizeAuditReadRequest(request('service-secret'), baseEnv, {
      routeScope: AUDIT_ROUTE_SCOPES.jobStatusRead,
      resourceType: 'job',
      resourceId: 'job-b'
    }),
    (error) => error.code === 'not_found' && error.status === 404
  );
  await assert.rejects(
    () => authorizeAuditReadRequest(request('service-secret'), baseEnv, {
      routeScope: AUDIT_ROUTE_SCOPES.catalogRead
    }),
    (error) => error.code === 'forbidden'
  );
});

test('expired, revoked, malformed, and missing service grants fail closed without revealing grant state', async () => {
  const variants = [
    {
      ...baseEnv,
      AUDIT_AUTHORIZATION_NOW: '2026-08-02T03:00:00.000Z'
    },
    {
      ...baseEnv,
      AUDIT_READ_SCOPES: {
        ...baseEnv.AUDIT_READ_SCOPES,
        'service-read': { ...baseEnv.AUDIT_READ_SCOPES['service-read'], revoked: true }
      }
    },
    {
      ...baseEnv,
      AUDIT_READ_SCOPES: {
        ...baseEnv.AUDIT_READ_SCOPES,
        'service-read': { ...baseEnv.AUDIT_READ_SCOPES['service-read'], token: 'nested-secret' }
      }
    },
    {
      ...baseEnv,
      AUDIT_READ_SCOPES: { ...baseEnv.AUDIT_READ_SCOPES, 'service-read': undefined }
    }
  ];
  const serialized = [];
  for (const env of variants) {
    try {
      await authorizeAuditReadRequest(request('service-secret'), env, {
        routeScope: AUDIT_ROUTE_SCOPES.jobStatusRead,
        resourceType: 'job',
        resourceId: 'job-a'
      });
      assert.fail('authorization must fail');
    } catch (error) {
      assert.equal(error.code, 'forbidden');
      assert.equal(error.status, 403);
      serialized.push(JSON.stringify({ code: error.code, status: error.status, message: error.message }));
    }
  }
  assert.equal(new Set(serialized).size, 1);
  assert.equal(serialized.join('').includes('nested-secret'), false);
});

test('query and header substitutions cannot change server-owned tenant, workspace, route scope, or resource binding', async () => {
  const context = await authorizeAuditReadRequest(
    request(
      'service-secret',
      '/audit/v1/gpt/jobs/job-b/status?tenantId=tenant-b&workspaceId=workspace-b&scope=catalog.read',
      {
        'x-audit-tenant': 'tenant-b',
        'x-audit-workspace': 'workspace-b',
        'x-audit-scope': 'catalog.read',
        'x-audit-resource-id': 'job-b'
      }
    ),
    baseEnv,
    {
      routeScope: AUDIT_ROUTE_SCOPES.jobStatusRead,
      resourceType: 'job',
      resourceId: 'job-a'
    }
  );
  assert.deepEqual(context, {
    identity: 'service-read',
    tenantId: 'tenant-a',
    workspaceId: 'workspace-a',
    routeScope: 'job.status.read',
    serviceBound: true
  });
});
