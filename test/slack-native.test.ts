import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { SlackApiError, SlackNativeApp, SlackWebClient, type SlackNativeOptions, type SlackSocket } from '../src/slack-native.js';
import { createSlackBot, SlackSender } from '../src/slack.js';
import { Engine } from '../src/engine.js';
import { Store } from '../src/store.js';
import type { Config } from '../src/config.js';
import type { Decision } from '../src/domain.js';
import { initialOffer, counteroffer, firstMessage } from '../src/fixtures.js';

// All credentials, socket frames and receipts in this file are fabricated test data.
const config: Config = {
  OPENAI_API_KEY: 'unused-test-key', OPENAI_MODEL: 'unused-test-model', AGENT_TIMEOUT_MS: 1000, DEALGUARD_STATE_PATH: 'unused',
  SLACK_BOT_TOKEN: 'xoxb-test-only', SLACK_APP_TOKEN: 'xapp-test-only', SLACK_TEAM_ID: 'TTEST',
  SLACK_APPROVAL_CHANNEL: 'CPRIVATE', SLACK_SUPPLIER_CHANNEL: 'CSUPPLIER',
  SLACK_CFO_USERS: 'UCFO', SLACK_PROCUREMENT_USERS: 'UPROC', SLACK_SUPPLIER_USERS: 'USUPPLIER',
};
const decision: Decision = { incomingTerms: initialOffer, proposedTerms: counteroffer,
  rationale: 'Use the supplier history to request a fee waiver and a shorter term.', evidenceRefs: ['HIST-001', 'POLICY-001'] };
const json = (value: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(value), { status, headers });
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
async function until(predicate: () => boolean) {
  const deadline = Date.now() + 1500;
  while (!predicate()) {
    if (Date.now() > deadline) assert.fail('Test condition did not become true.');
    await new Promise(resolve => setTimeout(resolve, 2));
  }
}

class FakeSocket implements SlackSocket {
  readyState = 1;
  readonly sent: string[] = [];
  private listeners = new Map<string, ((event: { data: unknown }) => void)[]>();
  addEventListener(type: string, listener: (event: { data: unknown }) => void) {
    this.listeners.set(type, [...this.listeners.get(type) ?? [], listener]);
  }
  send(data: string) { if (this.readyState !== 1) throw new Error('closed'); this.sent.push(data); }
  emit(frame: unknown) { this.raw(JSON.stringify(frame)); }
  raw(data: unknown) { for (const callback of this.listeners.get('message') ?? []) callback({ data }); }
  fail() { for (const callback of this.listeners.get('error') ?? []) callback({ data: undefined }); }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    for (const callback of this.listeners.get('close') ?? []) callback({ data: undefined });
  }
}
interface Call { method: string; url: URL; init: RequestInit; args: Record<string, unknown> }
function transport(overrides: Partial<SlackNativeOptions> = {}) {
  const calls: Call[] = [], sockets: FakeSocket[] = [];
  let handle: ((call: Call) => Response | Promise<Response> | undefined) | undefined;
  let posts = 0;
  const options: SlackNativeOptions = {
    reconnectBaseMs: 2, reconnectMaxMs: 8, connectionTimeoutMs: 30, maxReconnectAttempts: 2, random: () => 0,
    fetch: async (input, init = {}) => {
      const url = new URL(String(input));
      const method = url.pathname.split('/').at(-1)!;
      const args = init.body ? JSON.parse(String(init.body)) : Object.fromEntries(url.searchParams);
      const call = { method, url, init, args }; calls.push(call);
      const custom = await handle?.(call);
      if (custom) return custom;
      if (url.hostname === 'hooks.slack.com') return new Response('ok');
      assert.equal(url.origin, 'https://slack.com');
      if (method === 'auth.test') return json({ ok: true, team_id: 'TTEST', user_id: 'UBOT', bot_id: 'BBOT' });
      if (method === 'conversations.info') return json({ ok: true, channel: { id: args.channel, is_private: args.channel === 'CPRIVATE', is_member: true } });
      if (method === 'apps.connections.open') return json({ ok: true, url: `wss://wss-test.slack.com/link/?ticket=test-${calls.length}` });
      if (method === 'chat.postMessage') return json({ ok: true, channel: args.channel, ts: `123.${++posts}` });
      if (method === 'chat.update') return json({ ok: true, channel: args.channel, ts: args.ts });
      if (method === 'chat.postEphemeral') return json({ ok: true });
      if (method === 'conversations.replies') return json({ ok: true, messages: [] });
      assert.fail(`Unexpected fake endpoint: ${method}`);
    },
    createWebSocket: url => {
      assert.match(url, /^wss:\/\/wss-test\.slack\.com\//);
      const socket = new FakeSocket(); sockets.push(socket);
      queueMicrotask(() => socket.emit({ type: 'hello' }));
      return socket;
    },
    ...overrides,
  };
  return { calls, sockets, options, handle: (callback: typeof handle) => { handle = callback; } };
}
function engineFixture() {
  const engine = new Engine(new Store(), { CFO: ['UCFO'], 'Procurement Director': ['UPROC'] });
  const thread = engine.receive({ id: 'initial', channel: 'CSUPPLIER', threadTs: '100.1', user: 'USUPPLIER', text: firstMessage })!;
  const p = engine.propose(thread.key, thread.version, decision, 'live');
  engine.finish(thread.key, thread.version); p.approvalMessageTs = '101.1';
  return { engine, thread, p };
}
async function botFixture(t: TestContext) {
  const io = transport();
  const fixture = engineFixture();
  let runs = 0;
  const bot = createSlackBot(config, fixture.engine, { run: async (key, version) => {
    runs++;
    fixture.engine.propose(key, version, decision, 'live');
    return fixture.engine.finish(key, version);
  } }, io.options);
  t.after(() => bot.app.stop());
  await bot.start();
  return { ...fixture, ...io, bot, socket: io.sockets[0]!, runs: () => runs };
}
let actionNumber = 0;
function actionFrame(id: string, actionId = 'dealguard_approve', patch: Record<string, unknown> = {}) {
  const n = ++actionNumber;
  return { type: 'interactive', envelope_id: `action-${n}`, payload: {
    type: 'block_actions', team: { id: 'TTEST' }, channel: { id: 'CPRIVATE' }, user: { id: 'UCFO' },
    message: { ts: '101.1' }, response_url: 'https://hooks.slack.com/actions/test/only',
    actions: [{ type: 'button', action_id: actionId, action_ts: `200.${n}`, value: id }], ...patch,
  } };
}
function supplierFrame(eventId = 'supplier-2', patch: Record<string, unknown> = {}) {
  return { type: 'events_api', envelope_id: `envelope-${eventId}`, payload: {
    type: 'event_callback', event_id: eventId, team_id: 'TTEST',
    event: { type: 'message', channel: 'CSUPPLIER', user: 'USUPPLIER', text: firstMessage, ts: '102.1', thread_ts: '100.1' }, ...patch,
  } };
}
const supplierPosts = (calls: Call[]) => calls.filter(call => call.method === 'chat.postMessage' && call.args.channel === 'CSUPPLIER');

test('native methods use the correct endpoint, token, verb and JSON/query encoding', async () => {
  const io = transport(); const client = new SlackWebClient(config.SLACK_BOT_TOKEN, config.SLACK_APP_TOKEN, io.options);
  await client.apps.connections.open();
  await client.chat.postMessage({ channel: 'CSUPPLIER', thread_ts: '100.1', text: 'Exact & approved', unfurl_links: false });
  await client.conversations.replies({ channel: 'CSUPPLIER', ts: '100.1', cursor: 'a+/=', limit: 100, include_all_metadata: true });
  const [open, send, replies] = io.calls;
  assert.equal(open!.url.href, 'https://slack.com/api/apps.connections.open');
  assert.equal(open!.init.method, 'POST');
  assert.equal(new Headers(open!.init.headers).get('authorization'), 'Bearer xapp-test-only');
  assert.deepEqual(open!.args, {});
  assert.equal(new Headers(send!.init.headers).get('authorization'), 'Bearer xoxb-test-only');
  assert.equal(send!.args.text, 'Exact & approved');
  assert.equal(replies!.init.method, 'GET');
  assert.equal(replies!.args.cursor, 'a+/=');
  assert.equal(replies!.args.include_all_metadata, 'true');
  for (const call of io.calls) {
    assert.equal(call.init.redirect, 'error');
    assert.ok(call.init.signal instanceof AbortSignal);
    assert.doesNotMatch(call.url.href, /xoxb-|xapp-/);
    assert.equal(call.args.token, undefined);
  }
});

test('HTTP, API, invalid JSON and network failures each make one attempt with safe errors', async () => {
  for (const failure of [() => json({ ok: false, error: 'invalid_auth' }), () => json({}, 500), () => new Response('not json'),
    () => { throw new Error('secret-token https://hooks.slack.com/actions/private'); }]) {
    let calls = 0;
    const client = new SlackWebClient('xoxb-test', 'xapp-test', { fetch: async () => { calls++; return failure(); } });
    await assert.rejects(client.chat.postMessage({ channel: 'CSUPPLIER', text: 'approved' }), error => {
      assert.ok(error instanceof SlackApiError);
      assert.doesNotMatch(String(error), /secret-token|private|xoxb-/);
      return true;
    });
    assert.equal(calls, 1);
  }
});

test('rate limits are reported with Retry-After and never retried for sends', async () => {
  let calls = 0;
  const client = new SlackWebClient('xoxb-test', 'xapp-test', { fetch: async () => { calls++; return json({}, 429, { 'Retry-After': '30' }); } });
  await assert.rejects(client.chat.postMessage({ channel: 'CSUPPLIER', text: 'approved' }), error => {
    assert.ok(error instanceof SlackApiError); assert.equal(error.code, 'ratelimited'); assert.equal(error.retryAfterMs, 30_000); return true;
  });
  assert.equal(calls, 1);
});

test('request deadlines abort a stalled call without retry or raw error leakage', async () => {
  let calls = 0;
  const client = new SlackWebClient('xoxb-test', 'xapp-test', { requestTimeoutMs: 5, fetch: async (_url, init) => {
    calls++;
    return new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(new Error('private token'))));
  } });
  // Keep the event loop alive while AbortSignal.timeout's unref timer runs.
  const keepAlive = setTimeout(() => {}, 100);
  try { await assert.rejects(client.auth.test(), /network_or_timeout/); } finally { clearTimeout(keepAlive); }
  assert.equal(calls, 1);
});

test('response hooks are restricted, never receive bearer tokens, and are not receipts', async () => {
  const io = transport(); const client = new SlackWebClient('xoxb-test', 'xapp-test', io.options);
  const response = { text: 'Evidence', response_type: 'ephemeral' as const, replace_original: false as const };
  for (const url of ['http://hooks.slack.com/actions/x', 'https://hooks.slack.com.evil.test/actions/x',
    'https://hooks.slack.com@evil.test/actions/x', 'https://127.0.0.1/actions/x', 'https://hooks.slack.com/other/x']) {
    await assert.rejects(client.respond(url, response), /invalid_response_url/);
  }
  assert.equal(io.calls.length, 0);
  assert.equal(await client.respond('https://hooks.slack.com/actions/test/only', response), undefined);
  assert.equal(new Headers(io.calls[0]!.init.headers).get('authorization'), null);
});

test('socket acknowledges synchronously before work and suppresses retried events', async t => {
  const io = transport(); const app = new SlackNativeApp('xoxb-test', 'xapp-test', io.options); t.after(() => app.stop());
  let calls = 0; app.onEnvelope(async () => { calls++; });
  await app.start(); const socket = io.sockets[0]!;
  const frame = supplierFrame(); socket.emit(frame);
  assert.deepEqual(JSON.parse(socket.sent[0]!), { envelope_id: frame.envelope_id }); assert.equal(calls, 0);
  socket.emit({ ...frame, envelope_id: 'retry-envelope' });
  assert.equal(socket.sent.length, 2); await tick(); assert.equal(calls, 1);
  socket.raw('not JSON'); socket.emit({ type: 'events_api', envelope_id: 'bad-payload', payload: null });
  await tick(); assert.equal(calls, 1);
  assert.deepEqual(JSON.parse(socket.sent.at(-1)!), { envelope_id: 'bad-payload' });
});

test('duplicate interaction timestamps under different envelopes are handled once', async t => {
  const io = transport(); const app = new SlackNativeApp('xoxb-test', 'xapp-test', io.options); t.after(() => app.stop());
  let calls = 0; app.onEnvelope(async () => { calls++; }); await app.start();
  const frame = actionFrame('proposal', 'dealguard_evidence');
  io.sockets[0]!.emit(frame); io.sockets[0]!.emit({ ...frame, envelope_id: 'retry' });
  await tick(); assert.equal(calls, 1); assert.equal(io.sockets[0]!.sent.length, 2);
});

test('refresh reconnects with a fresh URL, retains deduplication and ignores old sockets', async t => {
  const io = transport(); const app = new SlackNativeApp('xoxb-test', 'xapp-test', io.options); t.after(() => app.stop());
  let calls = 0; app.onEnvelope(async () => { calls++; }); await Promise.all([app.start(), app.start()]);
  assert.equal(io.sockets.length, 1);
  const original = io.sockets[0]!; const frame = supplierFrame(); original.emit(frame); await tick();
  original.emit({ type: 'disconnect', reason: 'refresh_requested' }); original.fail(); original.close();
  await until(() => io.sockets.length === 2 && app.status === 'connected');
  original.emit(supplierFrame('ignored-old-socket'));
  io.sockets[1]!.emit(frame); await tick();
  assert.equal(calls, 1); assert.equal(io.calls.filter(c => c.method === 'apps.connections.open').length, 2);
  await app.stop(); assert.equal(app.status, 'stopped'); assert.equal(io.sockets[1]!.readyState, 3);
});

test('link_disabled stops reconnecting and reports an actionable failure', async t => {
  const io = transport(); const app = new SlackNativeApp('xoxb-test', 'xapp-test', io.options); t.after(() => app.stop());
  let errors = 0; app.error(() => { errors++; }); await app.start();
  io.sockets[0]!.emit({ type: 'disconnect', reason: 'link_disabled' }); await tick();
  assert.equal(app.status, 'failed'); assert.equal(errors, 1);
  assert.equal(io.calls.filter(c => c.method === 'apps.connections.open').length, 1);
});

test('consecutive connection failures exhaust a bounded reconnect budget', async t => {
  const io = transport(); const app = new SlackNativeApp('xoxb-test', 'xapp-test', io.options); t.after(() => app.stop());
  await app.start();
  io.handle(call => call.method === 'apps.connections.open' ? json({}, 503) : undefined);
  io.sockets[0]!.close(); await until(() => app.status === 'failed');
  assert.equal(io.calls.filter(c => c.method === 'apps.connections.open').length, 3);
});

test('stop cancels pending reconnect without opening another socket', async () => {
  const io = transport({ reconnectBaseMs: 20 }); const app = new SlackNativeApp('xoxb-test', 'xapp-test', io.options);
  await app.start(); io.sockets[0]!.close(); await app.stop();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(io.sockets.length, 1); assert.equal(app.status, 'stopped');
});

test('stop settles an incomplete handshake and allows a clean restart', async t => {
  let firstSocket: FakeSocket | undefined;
  const io = transport({ createWebSocket: () => {
    const socket = new FakeSocket();
    if (firstSocket) queueMicrotask(() => socket.emit({ type: 'hello' }));
    else firstSocket = socket;
    return socket;
  } });
  const app = new SlackNativeApp('xoxb-test', 'xapp-test', io.options); t.after(() => app.stop());
  const opening = app.start(); const rejected = assert.rejects(opening, /connection_stopped/);
  await until(() => !!firstSocket); await app.stop(); await rejected;
  assert.equal(app.status, 'stopped'); assert.equal(firstSocket!.readyState, 3);
  await app.start(); assert.equal(app.status, 'connected');
});

test('stopping immediately after ACK prevents queued handler side effects', async t => {
  const io = transport(); const app = new SlackNativeApp('xoxb-test', 'xapp-test', io.options); t.after(() => app.stop());
  let calls = 0; app.onEnvelope(async () => { calls++; }); await app.start();
  io.sockets[0]!.emit(supplierFrame()); await app.stop(); await tick();
  assert.equal(io.sockets[0]!.sent.length, 1); assert.equal(calls, 0);
});

test('Socket Mode startup requires hello and refuses non-Slack or insecure socket URLs', async t => {
  for (const url of ['ws://wss-test.slack.com/link', 'wss://attacker.test/link', 'wss://slack.com.attacker.test/link']) {
    const io = transport(); io.handle(call => call.method === 'apps.connections.open' ? json({ ok: true, url }) : undefined);
    const app = new SlackNativeApp('xoxb-test', 'xapp-test', io.options); t.after(() => app.stop());
    await assert.rejects(app.start(), /invalid_socket_url/); assert.equal(io.sockets.length, 0);
  }
  const io = transport({ connectionTimeoutMs: 5, createWebSocket: () => new FakeSocket() });
  const app = new SlackNativeApp('xoxb-test', 'xapp-test', io.options); t.after(() => app.stop());
  await assert.rejects(app.start(), /socket_hello_timeout/); assert.equal(app.status, 'failed');
});

test('missing config fails locally without provider access', () => {
  const { engine } = engineFixture(); const io = transport();
  assert.throws(() => createSlackBot({ ...config, SLACK_APP_TOKEN: '' }, engine, { run: async () => { throw new Error('unused'); } }, io.options), /Slack is not configured.*SLACK_APP_TOKEN/);
  assert.equal(io.calls.length, 0);
});

test('concurrent bot startup performs one validation and card restoration sequence', async t => {
  const io = transport(), { engine } = engineFixture();
  const bot = createSlackBot(config, engine, { run: async () => { throw new Error('unused'); } }, io.options); t.after(() => bot.app.stop());
  await Promise.all([bot.start(), bot.start()]);
  assert.equal(io.calls.filter(call => call.method === 'auth.test').length, 1);
  assert.equal(io.calls.filter(call => call.method === 'chat.update').length, 1);
  assert.equal(io.sockets.length, 1);
});

test('startup rejects wrong workspace, public buyer channel and missing supplier membership', async t => {
  for (const invalid of ['workspace', 'private', 'member']) {
    const io = transport(), { engine } = engineFixture();
    io.handle(call => {
      if (invalid === 'workspace' && call.method === 'auth.test') return json({ ok: true, team_id: 'TOTHER', user_id: 'UBOT' });
      if (invalid === 'private' && call.method === 'conversations.info' && call.args.channel === 'CPRIVATE') return json({ ok: true, channel: { is_private: false, is_member: true } });
      if (invalid === 'member' && call.method === 'conversations.info' && call.args.channel === 'CSUPPLIER') return json({ ok: true, channel: { is_member: false } });
      return undefined;
    });
    const bot = createSlackBot(config, engine, { run: async () => { throw new Error('unused'); } }, io.options); t.after(() => bot.app.stop());
    await assert.rejects(bot.start()); assert.equal(io.sockets.length, 0);
    assert.equal(io.calls.filter(c => c.method.startsWith('chat.')).length, 0);
  }
});

test('supplier events require configured team, channel, user and a valid event id', async t => {
  const f = await botFixture(t); const base = supplierFrame().payload.event;
  const invalid = [supplierFrame('other-team', { team_id: 'TOTHER' }), supplierFrame('missing-id', { event_id: undefined }),
    supplierFrame('wrong-channel', { event: { ...base, channel: 'COTHER' } }),
    supplierFrame('wrong-user', { event: { ...base, user: 'UOTHER' } }), supplierFrame('bot', { event: { ...base, bot_id: 'BOTHER' } })];
  for (const frame of invalid) f.socket.emit(frame);
  await tick(); assert.equal(f.runs(), 0); assert.equal(f.engine.thread(f.thread.key).version, 1);
  const valid = supplierFrame(); f.socket.emit(valid); f.socket.emit({ ...valid, envelope_id: 'retry' });
  await until(() => f.runs() === 1 && Object.keys(f.engine.state.proposals).length === 2);
  assert.equal(f.engine.thread(f.thread.key).version, 2); assert.equal(f.p.status, 'stale');
  assert.equal(supplierPosts(f.calls).length, 0);
});

test('wrong workspace/channel/user and stale approval cards cannot send or reveal evidence', async t => {
  const f = await botFixture(t); const before = f.calls.length;
  for (const patch of [{ team: { id: 'TOTHER' } }, { channel: { id: 'CSUPPLIER' } }, { user: { id: 'USUPPLIER' } }]) {
    f.socket.emit(actionFrame(f.p.id, 'dealguard_evidence', patch));
    f.socket.emit(actionFrame(f.p.id, 'dealguard_approve', patch));
  }
  await tick(); assert.equal(f.calls.length, before); assert.equal(f.p.status, 'pending');
  f.socket.emit(actionFrame(f.p.id, 'dealguard_approve', { message: { ts: '999.1' } }));
  await until(() => f.calls.some(c => c.url.hostname === 'hooks.slack.com'));
  assert.match(String(f.calls.at(-1)!.args.text), /not current/); assert.equal(supplierPosts(f.calls).length, 0);
});

test('evidence is ephemeral, rejection mutates only the stored proposal', async t => {
  const f = await botFixture(t);
  f.socket.emit(actionFrame(f.p.id, 'dealguard_evidence'));
  await until(() => f.calls.some(c => c.url.hostname === 'hooks.slack.com'));
  const hook = f.calls.find(c => c.url.hostname === 'hooks.slack.com')!;
  assert.equal(hook.args.response_type, 'ephemeral'); assert.equal(hook.args.replace_original, false);
  assert.match(JSON.stringify(hook.args.blocks), /HIST-001/); assert.equal(f.p.status, 'pending');
  f.socket.emit(actionFrame(f.p.id, 'dealguard_reject')); await until(() => f.p.status === 'rejected');
  assert.equal(supplierPosts(f.calls).length, 0); assert.equal(f.p.receipt, undefined);
});

test('the configured procurement user cannot approve a CFO-only proposal', async t => {
  const f = await botFixture(t);
  f.socket.emit(actionFrame(f.p.id, 'dealguard_approve', { user: { id: 'UPROC' } }));
  await until(() => f.calls.some(c => c.url.hostname === 'hooks.slack.com'));
  assert.equal(f.p.status, 'pending'); assert.equal(supplierPosts(f.calls).length, 0);
});

test('concurrent and retried approvals send exact text once and retain only an actual receipt', async t => {
  const f = await botFixture(t); const frame = actionFrame(f.p.id);
  f.socket.emit(frame); f.socket.emit({ ...frame, envelope_id: 'retry' }); f.socket.emit(actionFrame(f.p.id));
  await until(() => f.p.status === 'sent'); await tick();
  const sends = supplierPosts(f.calls); assert.equal(sends.length, 1);
  assert.equal(sends[0]!.args.text, f.p.text); assert.equal(sends[0]!.args.thread_ts, f.thread.threadTs);
  assert.deepEqual(sends[0]!.args.metadata, { event_type: 'dealguard_counteroffer', event_payload: { proposal_id: f.p.id } });
  assert.equal(f.p.receipt?.channel, 'CSUPPLIER'); assert.match(f.p.receipt!.messageTs, /^123\./);
  assert.equal(f.engine.thread(f.thread.key).messages.filter(m => m.kind === 'buyer').length, 1);
});

test('ambiguous send stays uncertain across another approval and an empty reconciliation', async t => {
  const f = await botFixture(t);
  f.handle(call => { if (call.method === 'chat.postMessage' && call.args.channel === 'CSUPPLIER') throw new Error('ambiguous secret'); return undefined; });
  f.socket.emit(actionFrame(f.p.id)); await until(() => f.p.status === 'uncertain');
  f.socket.emit(actionFrame(f.p.id)); f.socket.emit(actionFrame(f.p.id, 'dealguard_reconcile'));
  await until(() => f.calls.some(c => c.method === 'conversations.replies')); await tick();
  assert.equal(f.p.status, 'uncertain'); assert.equal(f.p.receipt, undefined); assert.equal(supplierPosts(f.calls).length, 1);
});

test('reconciliation requires matching bot author, proposal metadata, text and thread', async () => {
  const { engine, p } = engineFixture(); const io = transport();
  const app = new SlackNativeApp('xoxb-test', 'xapp-test', io.options); const sender = new SlackSender(app, engine);
  const receipt = { user: 'UBOT', bot_id: 'BBOT', text: p.text, ts: '123.2', thread_ts: '100.1',
    metadata: { event_type: 'dealguard_counteroffer', event_payload: { proposal_id: p.id } } };
  for (const patch of [{ user: 'USUPPLIER', bot_id: undefined }, { text: 'different' }, { thread_ts: 'other' },
    { ts: '' }, { metadata: { event_type: 'other', event_payload: { proposal_id: p.id } } }]) {
    io.handle(call => call.method === 'conversations.replies' ? json({ ok: true, messages: [{ ...receipt, ...patch }] }) : undefined);
    assert.equal(await sender.find(p), null);
  }
  io.handle(call => call.method === 'conversations.replies' ? json({ ok: true, messages: [receipt] }) : undefined);
  assert.deepEqual(await sender.find(p), { messageTs: '123.2', channel: 'CSUPPLIER' });
  assert.equal(supplierPosts(io.calls).length, 0);
});

test('reconciliation pagination is bounded, encodes cursors and detects cursor loops', async () => {
  const { engine, p } = engineFixture(); const io = transport(); const sender = new SlackSender(new SlackNativeApp('xoxb-test', 'xapp-test', io.options), engine);
  let pages = 0;
  io.handle(call => call.method === 'conversations.replies' ? json({ ok: true, messages: [], response_metadata: { next_cursor: `cursor-${++pages}` } }) : undefined);
  assert.equal(await sender.find(p), null); assert.equal(pages, 10);
  pages = 0;
  io.handle(call => { if (call.method === 'conversations.replies') { pages++; return json({ ok: true, messages: [], response_metadata: { next_cursor: 'same' } }); } return undefined; });
  assert.equal(await sender.find(p), null); assert.equal(pages, 2);
  assert.equal(supplierPosts(io.calls).length, 0);
});

test('concurrent reconcile callbacks record one confirmed receipt without resending', async t => {
  const f = await botFixture(t); f.p.status = 'uncertain';
  f.handle(call => call.method === 'conversations.replies' ? json({ ok: true, messages: [{ user: 'UBOT', text: f.p.text, ts: '999.1', thread_ts: f.thread.threadTs,
    metadata: { event_type: 'dealguard_counteroffer', event_payload: { proposal_id: f.p.id } } }] }) : undefined);
  f.socket.emit(actionFrame(f.p.id, 'dealguard_reconcile')); f.socket.emit(actionFrame(f.p.id, 'dealguard_reconcile'));
  await until(() => f.p.status === 'sent'); await tick();
  assert.equal(f.engine.thread(f.thread.key).messages.filter(m => m.kind === 'buyer').length, 1);
  assert.equal(supplierPosts(f.calls).length, 0);
});

test('missing or mismatched postMessage receipts never mark delivery successful', async () => {
  for (const result of [{ ok: true }, { ok: true, channel: 'COTHER', ts: '123.1' }, { ok: true, channel: 'CSUPPLIER', ts: 'bad' }]) {
    const { engine, p } = engineFixture(); const io = transport();
    io.handle(call => call.method === 'chat.postMessage' ? json(result) : undefined);
    const sender = new SlackSender(new SlackNativeApp('xoxb-test', 'xapp-test', io.options), engine);
    engine.approve(p.id, 'UCFO'); await engine.execute(p.id, sender);
    assert.equal(p.status, 'uncertain'); assert.equal(p.receipt, undefined); assert.equal(supplierPosts(io.calls).length, 1);
  }
});

test('replay proposals cannot cross the live Slack transport', async () => {
  const { engine, p } = engineFixture(); p.mode = 'replay'; const io = transport();
  const sender = new SlackSender(new SlackNativeApp('xoxb-test', 'xapp-test', io.options), engine);
  await assert.rejects(sender.send(p), /live counteroffer/); assert.equal(await sender.find(p), null); assert.equal(io.calls.length, 0);
});
