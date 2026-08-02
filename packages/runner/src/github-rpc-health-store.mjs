import {
  disabledSlotIds,
  recoveryEvent,
  reduceRpcHealth,
  sessionEventFromDiagnostics,
  validateRpcHealthEvent
} from './rpc-health-ledger.mjs';

const EVENT_MARKER = '<!-- curveyield-rpc-health-event-v1 -->';
const LEDGER_MARKER = '<!-- curveyield-rpc-health-ledger-v1 -->';
const GITHUB_ACTIONS_BOT = Object.freeze({
  login: 'github-actions[bot]',
  id: 41898282,
  type: 'Bot'
});
const TRUSTED_ADMIN_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

function dataField(value, key) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  let descriptor;
  try { descriptor = Object.getOwnPropertyDescriptor(value, key); }
  catch { return undefined; }
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) return undefined;
  return descriptor.value;
}

function encodeEvent(event) {
  const safe = validateRpcHealthEvent(event);
  return `${EVENT_MARKER}\n\`\`\`json\n${JSON.stringify(safe, null, 2)}\n\`\`\``;
}

function decodeBody(body) {
  if (typeof body !== 'string' || !body.includes(EVENT_MARKER)) return null;
  const match = body.match(/```json\s*([\s\S]*?)\s*```/i);
  if (!match) return null;
  try {
    return validateRpcHealthEvent(JSON.parse(match[1]));
  } catch {
    return null;
  }
}

function isActionsBot(comment) {
  const user = dataField(comment, 'user');
  return dataField(user, 'login') === GITHUB_ACTIONS_BOT.login
    && dataField(user, 'id') === GITHUB_ACTIONS_BOT.id
    && dataField(user, 'type') === GITHUB_ACTIONS_BOT.type;
}

function isTrustedAdministrator(comment) {
  if (isActionsBot(comment)) return true;
  return TRUSTED_ADMIN_ASSOCIATIONS.has(dataField(comment, 'author_association'));
}

function decodeComment(comment) {
  const commentId = dataField(comment, 'id');
  if (!Number.isSafeInteger(commentId) || commentId < 1) return null;
  const event = decodeBody(dataField(comment, 'body'));
  if (!event) return null;
  if (event.type === 'session' && !isActionsBot(comment)) return null;
  if (event.type !== 'session' && !isTrustedAdministrator(comment)) return null;
  return { commentId, event };
}

function repositoryParts(repository) {
  const match = String(repository ?? '').match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) throw new Error('GITHUB_REPOSITORY must be owner/repository');
  return { owner: match[1], repo: match[2] };
}

async function githubRequest({ token, url, method = 'GET', body, fetchImpl }) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let decoded;
  try { decoded = text ? JSON.parse(text) : null; } catch { decoded = null; }
  if (!response.ok) {
    const error = new Error(`GitHub RPC health request failed with HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return decoded;
}

export function createGithubRpcHealthStore({
  token,
  repository,
  chain,
  crossSessionFailureThreshold = 4,
  fetchImpl = globalThis.fetch,
  runId = process.env.GITHUB_RUN_ID
}) {
  if (typeof token !== 'string' || token.length === 0) throw new Error('GitHub health-store token is required');
  const { owner, repo } = repositoryParts(repository);
  if (typeof chain !== 'string' || chain.length === 0) throw new Error('Health-store chain is required');
  if (typeof fetchImpl !== 'function') throw new Error('fetchImpl must be a function');
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const ledgerTitle = `[RPC Health Ledger] ${chain}`;

  async function listIssues() {
    return githubRequest({ token, url: `${api}/issues?state=all&per_page=100`, fetchImpl });
  }

  async function findIssue(title) {
    const issues = await listIssues();
    return issues.find((issue) => !issue.pull_request && issue.title === title) ?? null;
  }

  async function ensureLedgerIssue() {
    const existing = await findIssue(ledgerTitle);
    if (existing) return existing;
    return githubRequest({
      token,
      url: `${api}/issues`,
      method: 'POST',
      fetchImpl,
      body: {
        title: ledgerTitle,
        body: `${LEDGER_MARKER}\nAppend-only machine ledger for redacted ${chain} simulation RPC health events. Do not paste endpoint URLs or credentials here.`
      }
    });
  }

  async function listComments(issueNumber) {
    const output = [];
    for (let page = 1; page <= 20; page += 1) {
      const comments = await githubRequest({
        token,
        url: `${api}/issues/${issueNumber}/comments?per_page=100&page=${page}`,
        fetchImpl
      });
      output.push(...comments);
      if (comments.length < 100) break;
    }
    return output;
  }

  async function events(issueNumber) {
    const comments = await listComments(issueNumber);
    const seenCommentIds = new Set();
    const output = [];
    for (const comment of comments) {
      const decoded = decodeComment(comment);
      if (!decoded || seenCommentIds.has(decoded.commentId)) continue;
      seenCommentIds.add(decoded.commentId);
      output.push(decoded.event);
    }
    return output;
  }

  async function append(issueNumber, event) {
    await githubRequest({
      token,
      url: `${api}/issues/${issueNumber}/comments`,
      method: 'POST',
      fetchImpl,
      body: { body: encodeEvent(event) }
    });
  }

  async function createIncident(slot, event) {
    const title = `[RPC Incident] ${chain} ${slot.id} disabled`;
    const existing = await findIssue(title);
    const body = [
      `The simulation RPC slot **${slot.id}** in the **${slot.pool}** pool was disabled after ${slot.consecutiveFailedSessions} consecutive failed sessions.`,
      '',
      `Last failure class: \`${slot.lastFailureClass ?? 'unknown'}\``,
      `Last run: \`${slot.lastRunId ?? event.runId ?? 'unknown'}\``,
      `Disabled at: \`${slot.disabledAt ?? event.at}\``,
      '',
      'The endpoint URL is intentionally omitted. A developer or administrator must repair or replace the corresponding repository secret and append a recovery event before this slot can be selected again.'
    ].join('\n');
    if (existing) {
      await githubRequest({ token, url: `${api}/issues/${existing.number}`, method: 'PATCH', fetchImpl, body: { state: 'open', body } });
      return existing.number;
    }
    const issue = await githubRequest({ token, url: `${api}/issues`, method: 'POST', fetchImpl, body: { title, body } });
    return issue.number;
  }

  async function load() {
    const issue = await ensureLedgerIssue();
    const allEvents = await events(issue.number);
    const state = reduceRpcHealth(allEvents, { crossSessionFailureThreshold });
    return { issueNumber: issue.number, events: allEvents, state, disabledSlotIds: disabledSlotIds(state) };
  }

  async function recordSession({ diagnostics, at = new Date().toISOString() }) {
    const before = await load();
    const event = sessionEventFromDiagnostics({ chain, runId, at, diagnostics });
    await append(before.issueNumber, event);
    const afterState = reduceRpcHealth([...before.events, event], { crossSessionFailureThreshold });
    const newlyDisabled = Object.values(afterState.slots).filter((slot) => (
      slot.disabled && !before.state.slots[slot.id]?.disabled
    ));
    const incidentIssues = [];
    for (const slot of newlyDisabled) incidentIssues.push(await createIncident(slot, event));
    return {
      backend: 'github-issue',
      ledgerIssueNumber: before.issueNumber,
      event,
      state: afterState,
      disabledSlotIds: disabledSlotIds(afterState),
      newlyDisabled: newlyDisabled.map((slot) => slot.id),
      incidentIssues
    };
  }

  async function recover({ slotId, actor = 'administrator', at = new Date().toISOString() }) {
    const current = await load();
    const event = recoveryEvent({ chain, slotId, actor, at });
    await append(current.issueNumber, event);
    const state = reduceRpcHealth([...current.events, event], { crossSessionFailureThreshold });
    return { backend: 'github-issue', ledgerIssueNumber: current.issueNumber, event, state };
  }

  return { load, recordSession, recover };
}

export function createGithubRpcHealthStoreFromEnvironment({
  environment = process.env,
  chain,
  crossSessionFailureThreshold,
  fetchImpl = globalThis.fetch
}) {
  const token = environment.SIM_RPC_HEALTH_GITHUB_TOKEN;
  const repository = environment.GITHUB_REPOSITORY;
  if (!token || !repository || environment.SIM_RPC_HEALTH_DISABLED === '1') return null;
  return createGithubRpcHealthStore({
    token,
    repository,
    chain,
    crossSessionFailureThreshold,
    fetchImpl,
    runId: environment.GITHUB_RUN_ID
  });
}