export function createAdversarialFixtures() {
  let calls = 0;

  const report = Object.create({ inheritedSecret: 'prototype-secret' });
  report.id = 'report-adversarial';
  report.title = '<svg onload=alert(1)>Ａudit\u0000\u0007\u202E title ' + 'x'.repeat(1000);
  report.status = 'published';
  report.createdAt = '2026-08-01T00:00:00Z';
  report.sourceUrl = 'javascript:alert(1)';
  report.evidence = [];
  report.evidence.length = 1_000_000;
  report.evidence[12] = {
    id: 'evidence-2',
    title: '<script>alert(2)</script>',
    severity: 'high',
    summary: '<img src=x onerror=alert(3)>',
    url: 'data:text/html,<script>alert(4)</script>'
  };
  report.evidence[999_999] = {
    id: 'evidence-1',
    title: 'Safe evidence',
    severity: 'low',
    summary: 'bounded',
    url: '/evidence/evidence-1'
  };
  report.self = report;
  Object.defineProperty(report, 'hostileAccessor', {
    enumerable: true,
    get() {
      calls += 1;
      throw new Error('accessor executed');
    }
  });

  const clientPayload = Object.create({ inheritedSecret: 'prototype-client-secret' });
  clientPayload.id = 'payload-adversarial';
  clientPayload.token = 'fixture-secret';
  clientPayload.items = [];
  clientPayload.items.length = 10_000;
  for (let index = 0; index < 150; index += 1) {
    clientPayload.items[index * 2] = { id: `item-${index}`, value: index };
  }
  clientPayload.self = clientPayload;
  Object.defineProperty(clientPayload, 'hostileAccessor', {
    enumerable: true,
    get() {
      calls += 1;
      throw new Error('client accessor executed');
    }
  });

  const diagnostic = {
    code: 'ADVERSARIAL',
    message: 'Bearer fixture-token failed at https://private.test/path from /home/fixture/project/file',
    details: 'token=fixture-secret password=fixture-password',
    correlationId: 'correlation-adversarial',
    retryAfterSeconds: 1,
    quotaRemaining: 1,
    retentionDays: 1,
    publicationStatus: 'partial',
    staleState: true
  };

  return Object.freeze({
    report,
    clientPayload,
    diagnostic,
    accessorCalls: () => calls
  });
}
