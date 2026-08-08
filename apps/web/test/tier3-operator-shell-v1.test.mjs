import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexUrl = new URL('../public/index.html', import.meta.url);
const appUrl = new URL('../public/app.js', import.meta.url);
const stylesUrl = new URL('../public/styles.css', import.meta.url);

async function source() {
  const [html, app, styles] = await Promise.all([
    readFile(indexUrl, 'utf8'),
    readFile(appUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ]);
  return { html, app, styles };
}

test('Deep Assurance is the primary browser workspace and Preflight execution remains a subsystem', async () => {
  const { html } = await source();
  assert.match(html, /<title>CurveYield Deep Assurance Console<\/title>/);
  assert.match(html, /<h1>Deep Assurance Console<\/h1>/);
  assert.match(html, /id="audit-workspace"/);
  assert.match(html, /id="execution-workspace"[^>]*class="[^"]*hidden/);
  assert.match(html, /id="show-audit-workspace"/);
  assert.match(html, /id="show-execution-workspace"/);
  assert.match(html, /Preflight Execution/);
});

test('operator shell exposes bounded controller discovery and Tier 3 summary regions', async () => {
  const { html } = await source();
  for (const id of [
    'controller-project-slug',
    'load-controller-project',
    'controller-state',
    'controller-release',
    'instruction-release',
    'active-campaign',
    'campaign-source',
    'phase-summary',
    'lane-summary',
    'instruction-proof-summary',
    'assignment-summary',
    'finding-summary',
    'remediation-summary',
    'evidence-summary',
    'finalization-summary',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
  assert.match(html, /id="controller-state"[^>]*aria-live="polite"/);
});

test('operator shell exposes one structured command request surface without mailbox routing controls', async () => {
  const { html, app } = await source();
  for (const id of [
    'controller-command-form',
    'controller-command-json',
    'queue-controller-command',
    'controller-command-state',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
  assert.match(html, /id="controller-command-state"[^>]*aria-live="polite"/);
  assert.match(html, /Queued requests are not accepted controller state until the authoritative projection changes\./);
  assert.match(app, /queueControllerCommand\(/);
  assert.match(app, /Queued .*Reload controller state to observe authoritative acceptance\./);
  assert.doesNotMatch(html, /name="issueNumber"|id="issue-number"|mailboxIssueNumber/);
  assert.doesNotMatch(app, /issues\/\$\{|mailboxIssueNumber|AUDIT_CONTROLLER_INTAKE_ISSUE/);
});

test('browser keeps the active execution network scope exactly Ethereum then Base with Base default', async () => {
  const { html } = await source();
  const chainSelect = html.match(/<select id="chain">([\s\S]*?)<\/select>/)?.[1] ?? '';
  const values = [...chainSelect.matchAll(/<option value="([^"]+)"([^>]*)>/g)].map((match) => ({
    value: match[1],
    attrs: match[2],
  }));
  assert.deepEqual(values.map((entry) => entry.value), ['ethereum', 'base']);
  assert.equal(values[0].attrs.includes('selected'), false);
  assert.equal(values[1].attrs.includes('selected'), true);
});

test('operator JavaScript loads compatibility/project state through the client and never renders controller data with innerHTML', async () => {
  const { app } = await source();
  assert.match(app, /getControllerCompatibility\(\)/);
  assert.match(app, /getControllerProject\(/);
  assert.match(app, /controller-project-slug/);
  assert.match(app, /NO_ACTIVE_CAMPAIGN/);
  assert.doesNotMatch(app, /\.innerHTML\s*=/);
});

test('Tier 3 shell includes responsive workspace, summary-grid, and command styling', async () => {
  const { styles } = await source();
  assert.match(styles, /\.workspace-nav/);
  assert.match(styles, /\.controller-grid/);
  assert.match(styles, /\.summary-card/);
  assert.match(styles, /\.command-panel/);
  assert.match(styles, /\.command-warning/);
  assert.match(styles, /@media\(max-width:850px\)/);
});
