import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import OpenAI from 'openai';
import { MentorService, validateMentorPlan, type MentorChange, type MentorOptions, type MentorState } from '../src/mentor.js';
import { getProviderStatus } from '../src/providers.js';

const configured = () => ({ agents: true, search: true, voice: true });
const source = { id: 'exa_source_1', title: 'Actual provider result in the test transport', url: 'https://example.org/togaf', snippet: 'An excerpt returned by the injected Exa provider.' };
function fixture(t: { after(fn: () => void): void }, options: MentorOptions = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'mentoros-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const statePath = join(dir, '.mentor', 'state.json');
  return { dir, statePath, service: new MentorService({ statePath, providerStatus: configured, now: () => new Date('2026-09-12T09:00:00Z'), ...options }) };
}
function change(state: MentorState, id: string, start: string, end: string, title?: string): MentorChange {
  const old = state.events.find(e => e.id === id)!;
  return { eventId: id, title: title ?? old.title, fromStart: old.start, fromEnd: old.end, toStart: start, toEnd: end, reason: 'Test a concrete schedule constraint.' };
}

test('synthetic initial day is labelled, detached, and capabilities are configuration only', t => {
  const { service, statePath } = fixture(t);
  const state = service.getState();
  assert.equal(state.day, '2026-09-12');
  assert.deepEqual(state.recovery, { canRetry: false, unresolved: false });
  assert.equal(state.coaches.length, 2);
  assert.deepEqual(state.coaches.map(c => [c.name, c.portrait]), [['Mira', '/assets/coach-health.png'], ['Atlas', '/assets/coach-career.png']]);
  assert.match(state.history[0]!.text, /Synthetic/);
  assert.ok(state.audit.some(a => /configuration only/.test(a.detail)));
  state.events[0]!.title = 'Mutated outside';
  assert.notEqual(service.getState().events[0]!.title, 'Mutated outside');
  assert.equal(statSync(statePath).mode & 0o777, 0o600);
  assert.throws(() => service.calendarICS(), /Approve/);
});

test('replay disruption, exact approval, persistence and home follow-up operate on real local state', async t => {
  const { service, statePath } = fixture(t);
  const pending = await service.disrupt();
  assert.equal(pending.status, 'pending');
  assert.equal(pending.events.find(e => e.id === 'study')!.start, '19:30');
  assert.match(pending.proposal!.summary, /Scripted/);
  assert.deepEqual(pending.proposal!.sources, []);
  assert.equal(pending.proposal!.changes.find(c => c.eventId === 'study')!.toEnd, '22:30');
  assert.equal(pending.proposal!.changes.find(c => c.eventId === 'study')!.toStart, '21:00');
  assert.throws(() => service.approve('wrong-id'), /ID/);
  const approved = service.approve(pending.proposal!.id);
  assert.equal(approved.status, 'approved');
  const memoryLength = approved.memory.length;
  assert.equal(service.approve(pending.proposal!.id).memory.length, memoryLength);
  assert.equal(approved.events.find(e => e.id === 'study')!.start, '21:00');
  const restarted = new MentorService({ statePath, providerStatus: configured });
  assert.deepEqual(restarted.getState().events, approved.events);
  const followup = await restarted.message('Keep the workout at home instead', 'JLT');
  assert.equal(followup.area, 'JLT');
  assert.match(followup.proposal!.healthNote, /at home/);
  assert.deepEqual(followup.proposal!.changes.map(c => c.eventId), ['workout']);
  assert.equal(followup.proposal!.changes[0]!.fromStart, '19:45');
  assert.equal(followup.proposal!.changes[0]!.toEnd, '20:30');
  assert.throws(() => restarted.approve(pending.proposal!.id), /ID/);
  const final = restarted.approve(followup.proposal!.id);
  assert.match(final.events.find(e => e.id === 'workout')!.title, /at home/);
  assert.equal(readdirSync(join(statePath, '..')).filter(name => name.endsWith('.tmp')).length, 0);
});

test('rejected and superseded proposals never apply; the export retains the last approved snapshot', async t => {
  const { service } = fixture(t);
  const first = await service.disrupt();
  assert.equal(first.calendar.canExport, false);
  service.approve(first.proposal!.id);
  const exported = service.calendarICS();
  const second = await service.message('Keep activity at home');
  const third = await service.message('Find an indoor activity');
  assert.equal(third.calendar.canExport, true);
  assert.equal(typeof third.calendar.approvedAt, 'string');
  assert.throws(() => service.approve(second.proposal!.id), /ID/);
  const before = service.getState().events;
  service.reject(third.proposal!.id);
  assert.deepEqual(service.getState().events, before);
  assert.equal(service.calendarICS(), exported);
  assert.throws(() => service.approve(third.proposal!.id), /eligible/);
  service.reset('replay');
  assert.equal(service.getState().calendar.canExport, false);
  assert.throws(() => service.approve(first.proposal!.id), /ID/);
  assert.throws(() => service.calendarICS(), /Approve/);
});

test('deterministic validator rejects overlaps, invalid times, fixed edits, stale values and shorter study', t => {
  const { service } = fixture(t);
  const state = service.getState();
  const errors = (changes: unknown) => validateMentorPlan(state.events, changes);
  assert.match(errors([change(state, 'work', '09:00', '18:00')]).errors.join(' '), /Fixed/);
  assert.match(errors([change(state, 'study', '18:30', '20:00')]).errors.join(' '), /Overlap/);
  assert.equal(errors([change(state, 'study', '24:00', '25:00')]).valid, false);
  assert.equal(errors([change(state, 'study', '21:00', '20:00')]).valid, false);
  assert.match(errors([{ ...change(state, 'study', '20:00', '21:30'), fromStart: '18:00' }]).errors.join(' '), /Stale/);
  assert.match(errors([change(state, 'study', '19:30', '20:15')]).errors.join(' '), /90-minute study block fits/);
  assert.match(errors([change(state, 'study', '22:00', '23:30')]).errors.join(' '), /wind-down/);
  assert.match(errors([change(state, 'dinner', '19:00', '19:20')]).errors.join(' '), /30-minute dinner/);
  assert.equal(errors([change(state, 'study', '21:00', '22:30')]).valid, true);
});

test('calendar uses UTC instants, CRLF, escaping, and UTF-8 octet folding', async t => {
  const { service, statePath } = fixture(t);
  const pending = await service.disrupt(); service.approve(pending.proposal!.id);
  // A persisted approved snapshot with user-authored punctuation exercises the iCalendar serializer.
  const stored = JSON.parse(readFileSync(statePath, 'utf8'));
  stored.approved.events.find((e: { id: string }) => e.id === 'workout').title = 'Activity, home; \\ training\r\n' + 'تمرين'.repeat(60);
  writeFileSync(statePath, JSON.stringify(stored));
  const ics = new MentorService({ statePath }).calendarICS();
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(ics.replace(/\r\n/g, '').includes('\n'), false);
  assert.equal(ics.replace(/\r\n/g, '').includes('\r'), false);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  const unfolded = ics.replace(/\r\n /g, '');
  assert.match(unfolded, /DTSTART:20260912T154500Z/);
  assert.match(unfolded, /DTEND:20260912T163000Z/);
  assert.ok(unfolded.includes('SUMMARY:Activity\\, home\\; \\\\ training\\n'));
  assert.ok(unfolded.includes('تمرين'.repeat(60)));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 3);
});

type Outcome = 'completed' | 'failed' | 'idle' | 'unknown-source' | 'different-changes' | 'wrong-turn' | 'search-failed' | 'long-speech' | 'many-sources';
function sdkFixture(outcome: Outcome = 'completed', gate?: Promise<void>) {
  const calls: { method: string; path: string; body: any }[] = [];
  const contexts: any[] = [];
  let turn = 0, searchCalls = 0;
  const session = { id: 'session_mentor_test', status: 'idle', required_actions: [] };
  const makeEvents = () => {
    const turnId = `turn_${++turn}`;
    const changes: MentorChange[] = [{ eventId: 'workout', title: `At home, active plan ${turn}`, fromStart: '18:00', fromEnd: '19:00', toStart: '18:00', toEnd: '19:00', reason: 'Use the user-requested activity at home.' }];
    if (turn > 1) { changes[0]!.fromStart = '18:00'; changes[0]!.fromEnd = '19:00'; }
    const action = (name: string, args: unknown, id: string) => ({ type: 'agent.session.requires_action', session: { ...session, required_actions: [{ type: 'function_call', call_id: id, turn_id: turnId, name, arguments: args }] } });
    return [
      { type: 'agent.session.created', session },
      { type: 'agent.session.turn.created', turn_id: turnId, session_id: session.id },
      action('get_day_context', {}, `context_${turn}`), action('get_day_context', {}, `context_${turn}`),
      action('search_options', { query: 'TOGAF study resource' }, `search_${turn}`),
      action('validate_plan', { changes }, `validate_${turn}`),
      action('propose_plan', { summary: 'Live model-authored joint response preserved exactly.', healthNote: 'Health model contribution: activity at home preserves the existing plan.', careerNote: 'Career model contribution: protect the full 90-minute study block.', speech: outcome === 'long-speech' ? 's'.repeat(801) : 'Both coach roles propose activity at home with the full study block.', changes: outcome === 'different-changes' ? [{ ...changes[0], title: 'Unvalidated different title' }] : changes, sourceRefs: outcome === 'many-sources' ? Array(7).fill(source.id) : [outcome === 'unknown-source' ? 'invented' : source.id] }, `propose_${turn}`),
      outcome === 'idle' ? { type: 'agent.session.idle', session } : { type: `agent.session.turn.${outcome === 'failed' ? 'failed' : 'completed'}`, session_id: session.id, turn_id: outcome === 'wrong-turn' ? 'unrelated_turn' : turnId },
    ];
  };
  const sse = (events: unknown[]) => new Response(events.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
  const client = new OpenAI({ apiKey: 'test-key-never-sent', maxRetries: 0, timeout: 1500, fetch: async (url, init) => {
    const path = new URL(String(url)).pathname, method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ method, path, body });
    if (method === 'POST' && path.endsWith('/agents/sessions')) { if (gate) await gate; return sse(makeEvents()); }
    if (method === 'GET' && path.endsWith('/events')) return sse(makeEvents());
    if (method === 'GET' && path.endsWith('/session_mentor_test')) return Response.json(session);
    if (method === 'POST' && path.endsWith('/events')) {
      const event = body?.events?.[0];
      if (event?.call_id?.startsWith('context') && event.output) contexts.push(JSON.parse(event.output));
      return new Response(null, { status: 204 });
    }
    throw new Error('Unexpected fake transport path');
  } });
  const search = async () => { searchCalls++; if (outcome === 'search-failed') throw new Error('sensitive-key-never-expose'); return [source]; };
  return { client, calls, contexts, search, searchCount: () => searchCalls };
}

test('installed SDK parses object arguments, deduplicates calls, preserves model output and reuses one session', async t => {
  const sdk = sdkFixture();
  const { service, statePath } = fixture(t, { mode: 'live', client: sdk.client, search: sdk.search });
  const state = await service.message('Keep activity at home');
  assert.equal(state.status, 'pending');
  assert.equal(state.sessionId, 'session_mentor_test');
  assert.equal(state.proposal!.summary, 'Live model-authored joint response preserved exactly.');
  assert.deepEqual(state.proposal!.sources, [source]);
  assert.equal(sdk.searchCount(), 1);
  assert.equal(state.audit.filter(a => a.type === 'tool_result' && a.detail.startsWith('get_day_context')).length, 1);
  service.approve(state.proposal!.id);
  const reopened = new MentorService({ statePath, client: sdk.client, search: sdk.search, providerStatus: configured });
  await reopened.message('Continue from the approved home plan');
  assert.equal(sdk.calls.filter(c => c.method === 'POST' && c.path.endsWith('/agents/sessions')).length, 1);
  const input = sdk.calls.findIndex(c => c.body?.events?.[0]?.type === 'agent.session.input.message');
  assert.ok(input > 0);
  assert.equal(sdk.calls[input - 1]!.method, 'GET');
  assert.match(sdk.calls[input - 1]!.path, /events$/);
  assert.equal(sdk.contexts.at(-1).previousApproval.proposal.id, state.proposal!.id);
  assert.match(sdk.contexts.at(-1).events.find((e: { id: string }) => e.id === 'workout').title, /active plan 1/);
  assert.equal(sdk.calls[0]!.body.environment.type, 'openai_hosted');
  assert.deepEqual(sdk.calls[0]!.body.agent.tools.map((tool: { name: string }) => tool.name), ['get_day_context', 'search_options', 'validate_plan', 'propose_plan']);
});

for (const outcome of ['failed', 'idle', 'wrong-turn', 'unknown-source', 'different-changes', 'search-failed', 'long-speech', 'many-sources'] as Outcome[]) {
  test(`live ${outcome} cannot produce an approval-eligible plan or silently replay`, async t => {
    const sdk = sdkFixture(outcome);
    const { service } = fixture(t, { mode: 'live', client: sdk.client, search: sdk.search });
    await assert.rejects(service.message('Keep activity at home'));
    const state = service.getState();
    assert.equal(state.mode, 'live'); assert.equal(state.status, 'failed'); assert.equal(state.proposal, null);
    assert.equal(JSON.stringify(state).includes('sensitive-key-never-expose'), false);
    assert.throws(() => service.calendarICS(), /Approve/);
    assert.ok(sdk.calls.some(c => c.body?.events?.[0]?.type === 'agent.session.input.cancel'));
    if (outcome === 'many-sources') assert.ok(sdk.calls.some(c => /sourceRefs:.*6/.test(c.body?.events?.[0]?.error ?? '')));
    if (outcome === 'long-speech') assert.ok(sdk.calls.some(c => /speech:.*800/.test(c.body?.events?.[0]?.error ?? '')));
  });
}

test('missing Exa fails explicitly before live spending', async t => {
  const sdk = sdkFixture();
  const { service } = fixture(t, { mode: 'live', client: sdk.client, providerStatus: () => ({ agents: true, voice: true, search: false }) });
  await assert.rejects(service.disrupt(), /Exa search is not configured/);
  assert.equal(service.getState().status, 'failed');
  assert.equal(sdk.calls.length, 0);
  assert.ok(service.getState().events.some(e => e.id === 'late-meeting'));
});

test('busy requests cannot race, and a reset makes an old completion stale', async t => {
  let resolve!: () => void;
  const gate = new Promise<void>(r => { resolve = r; });
  const sdk = sdkFixture('completed', gate);
  const { service } = fixture(t, { mode: 'live', client: sdk.client, search: sdk.search });
  const running = service.message('First request');
  const rejected = assert.rejects(running, /stale/);
  assert.equal(service.getState().status, 'thinking');
  await assert.rejects(service.message('Concurrent request'), /already running/);
  await assert.rejects(service.disrupt(), /already running/);
  assert.throws(() => service.approve('anything'), /already running/);
  service.reset('replay');
  resolve(); await rejected;
  assert.equal(service.getState().mode, 'replay');
  assert.equal(service.getState().status, 'idle');
  assert.equal(service.getState().sessionId, undefined);
  assert.equal(service.getState().history.length, 1);
  assert.equal((await service.disrupt()).status, 'pending');
});

test('tool-call budget and stalled transport are bounded', async t => {
  const sdk = sdkFixture();
  const { service } = fixture(t, { mode: 'live', client: sdk.client, search: sdk.search, toolBudget: 2 });
  await assert.rejects(service.message('Recover evening'), /budget/);
  const stalled = sdkFixture('completed', new Promise<void>(() => {}));
  const other = fixture(t, { mode: 'live', client: stalled.client, search: stalled.search, timeoutMs: 150 }).service;
  const started = Date.now();
  await assert.rejects(other.message('Recover evening'), /timed out/);
  assert.ok(Date.now() - started < 1500);
});

test('restart fails interrupted review closed and corrupt JSON is never overwritten', t => {
  const { statePath } = fixture(t);
  const saved = JSON.parse(readFileSync(statePath, 'utf8'));
  saved.state.status = 'thinking'; saved.state.sessionId = 'retained-session';
  saved.state.coaches = [{ id: 'health', name: 'Outdated name', portrait: '/old.png', role: 'Health' }];
  writeFileSync(statePath, JSON.stringify(saved));
  const recovered = new MentorService({ statePath }).getState();
  assert.equal(recovered.status, 'failed'); assert.equal(recovered.sessionId, 'retained-session');
  assert.match(recovered.error!, /interrupted/);
  assert.deepEqual(recovered.coaches.map(c => c.name), ['Mira', 'Atlas']);
  writeFileSync(statePath, '{invalid');
  assert.throws(() => new MentorService({ statePath }), /not overwritten/);
  assert.equal(readFileSync(statePath, 'utf8'), '{invalid');
});

function recoverySDK(kind: 'accepted-disconnect' | 'staged-disconnect' | 'validated-disconnect' | 'resume' | 'unsafe' | 'repeat-disconnect' | 'wrong-turn') {
  const calls: { method: string; path: string; body: any }[] = [];
  let accepted = kind === 'resume' || kind === 'unsafe', reads = 0, observers = 0, searches = 0;
  const sessionId = 'session_mentor_test', turnId = 'turn_recovery';
  const pending = { type: 'function_call', call_id: 'recover_context', turn_id: turnId, name: kind === 'unsafe' ? 'propose_plan' : 'get_day_context', arguments: {} };
  const changes = [{ eventId: 'workout', title: 'Activity at home after recovery', fromStart: '18:00', fromEnd: '19:00', toStart: '18:00', toEnd: '19:00', reason: 'Preserve our approved times and keep activity at home.' }];
  const action = (name: string, arguments_: unknown, call_id: string) => ({ type: 'agent.session.requires_action', session: { id: sessionId, required_actions: [{ type: 'function_call', name, arguments: arguments_, call_id, turn_id: turnId }] } });
  const body = [
    { type: 'agent.session.turn.created', session_id: sessionId, turn_id: turnId },
    action('get_day_context', {}, 'recover_context'),
    action('search_options', { query: 'TOGAF official study guide' }, 'recover_search'),
    action('validate_plan', { changes }, 'recover_validate'),
    action('propose_plan', { changes, summary: 'Keep activity at home and preserve study.', healthNote: 'Keep the existing activity time at home.', careerNote: 'Protect all 90 minutes of planned study.', speech: 'Keep activity at home and preserve dinner and study. Please review this plan.', sourceRefs: [source.id] }, 'recover_propose'),
  ];
  const complete = { type: 'agent.session.turn.completed', session_id: sessionId, turn_id: turnId };
  const sse = (events: unknown[], disconnect = false) => {
    let index = 0;
    return new Response(new ReadableStream({ pull(controller) {
      if (index < events.length) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(events[index++])}\n\n`));
      else if (disconnect) controller.error(new TypeError('terminated', { cause: Object.assign(new Error('socket closed'), { code: 'UND_ERR_SOCKET' }) }));
      else controller.close();
    } }, { highWaterMark: 0 }), { headers: { 'content-type': 'text/event-stream' } });
  };
  const client = new OpenAI({ apiKey: 'test-key-never-sent', maxRetries: 0, timeout: 1500, fetch: async (url, init) => {
    const path = new URL(String(url)).pathname, method = init?.method ?? 'GET';
    const posted = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ method, path, body: posted });
    if (method === 'GET' && path.endsWith('/events')) {
      observers++;
      if (kind === 'repeat-disconnect' && observers === 2) throw new Error('second connection interruption');
      if (kind === 'staged-disconnect') return observers === 1 ? sse(body, true) : sse([]);
      if (kind === 'validated-disconnect') return observers === 1 ? sse(body.slice(0, -1), true) : sse([complete]);
      return observers === 1 && !['resume', 'unsafe'].includes(kind) ? sse([]) : sse([...body, complete]);
    }
    if (method === 'GET' && path.includes('/turns/')) return Response.json({ id: kind === 'wrong-turn' ? 'another_turn' : turnId, session_id: sessionId, created_at: Date.parse('2026-09-12T09:00:00Z') / 1000, subagent_id: null, status: kind === 'staged-disconnect' ? 'completed' : 'waiting' });
    if (method === 'GET' && path.endsWith(`/${sessionId}`)) {
      reads++;
      return Response.json({ id: sessionId, status: accepted && kind !== 'staged-disconnect' ? 'requires_action' : 'idle', required_actions: accepted && kind !== 'staged-disconnect' ? kind === 'validated-disconnect' ? (body.at(-1) as any).session.required_actions : [pending] : [] });
    }
    if (method === 'POST' && path.endsWith('/events')) {
      if (posted.events[0].type === 'agent.session.input.message') {
        accepted = true;
        if (!['staged-disconnect', 'validated-disconnect'].includes(kind)) throw new Error('connection lost after input accepted');
      }
      return new Response(null, { status: 204 });
    }
    throw new Error('Unexpected recovery fixture request');
  } });
  return { client, calls, search: async () => { searches++; return [source]; }, searchCount: () => searches, observerCount: () => observers };
}

async function approvedRecoveryFixture(t: Parameters<typeof fixture>[0]) {
  const original = sdkFixture();
  const f = fixture(t, { mode: 'live', client: original.client, search: original.search });
  const proposal = await f.service.message('Keep activity at home'); f.service.approve(proposal.proposal!.id);
  return f;
}

for (const kind of ['accepted-disconnect', 'validated-disconnect', 'staged-disconnect'] as const) test(`reattach ${kind} preserves the intended turn without resubmitting input`, async t => {
  const f = await approvedRecoveryFixture(t), sdk = recoverySDK(kind);
  const service = new MentorService({ statePath: f.statePath, client: sdk.client, search: sdk.search, providerStatus: configured, now: () => new Date('2026-09-12T09:00:00Z') });
  const state = await service.message('Keep activity at home and remember the approved plan');
  assert.equal(state.status, 'pending'); assert.deepEqual(state.proposal!.sources, [source]);
  assert.equal(sdk.calls.filter(c => c.body?.events?.[0]?.type === 'agent.session.input.message').length, 1);
  assert.equal(sdk.calls.filter(c => c.path.endsWith('/agents/sessions')).length, 0);
  assert.equal(sdk.observerCount(), 2); assert.equal(sdk.searchCount(), 1);
  assert.equal(state.audit.filter(a => a.type === 'stream_reattached').length, 1);
  assert.ok(!sdk.calls.some(c => c.body?.events?.[0]?.type === 'agent.session.input.cancel'));
});

test('explicit retry resumes a zero-tool failed turn without changing history, revision or approved events', async t => {
  const f = await approvedRecoveryFixture(t), sdk = recoverySDK('resume');
  const stored = JSON.parse(readFileSync(f.statePath, 'utf8'));
  stored.revision++; stored.state.status = 'failed'; delete stored.activeTurnId; delete stored.unresolvedTurn; delete stored.reviewBase; stored.toolResults = {};
  stored.state.history.push({ id: 'original-followup', role: 'user', text: 'Keep activity at home', at: '2026-09-12T09:00:00Z' });
  writeFileSync(f.statePath, JSON.stringify(stored));
  const service = new MentorService({ statePath: f.statePath, client: sdk.client, search: sdk.search, providerStatus: configured });
  assert.deepEqual(service.getState().recovery, { canRetry: true, unresolved: true });
  await assert.rejects(service.message('Do not submit this'), /unresolved/);
  const state = await service.retry();
  assert.equal(state.status, 'pending'); assert.deepEqual(state.events, stored.state.events);
  assert.deepEqual(state.recovery, { canRetry: false, unresolved: false });
  const after = JSON.parse(readFileSync(f.statePath, 'utf8'));
  assert.equal(after.revision, stored.revision); assert.deepEqual(after.approved, stored.approved);
  assert.deepEqual(state.history.filter(h => h.role === 'user'), stored.state.history.filter((h: any) => h.role === 'user'));
  assert.ok(!sdk.calls.some(c => c.body?.events?.[0]?.type === 'agent.session.input.message'));
  assert.ok(!sdk.calls.some(c => c.path.endsWith('/agents/sessions')));
});

test('unsafe explicit resume cannot answer tools, cancel a foreign turn or submit input', async t => {
  const f = await approvedRecoveryFixture(t), sdk = recoverySDK('unsafe');
  const stored = JSON.parse(readFileSync(f.statePath, 'utf8'));
  stored.state.status = 'failed'; stored.unresolvedTurn = true; delete stored.activeTurnId; stored.toolResults = {}; delete stored.reviewBase;
  stored.state.history.push({ id: 'followup', role: 'user', text: 'Original pending request', at: '2026-09-12T09:00:00Z' });
  writeFileSync(f.statePath, JSON.stringify(stored));
  const service = new MentorService({ statePath: f.statePath, client: sdk.client, search: sdk.search, providerStatus: configured });
  await assert.rejects(service.retry(), /exactly one pending get_day_context/);
  assert.ok(!sdk.calls.some(c => c.method === 'POST'));
});

for (const kind of ['repeat-disconnect', 'wrong-turn'] as const) test(`recovery ${kind} fails closed without a third observer or duplicate input`, async t => {
  const f = await approvedRecoveryFixture(t), sdk = recoverySDK(kind);
  const service = new MentorService({ statePath: f.statePath, client: sdk.client, search: sdk.search, providerStatus: configured, now: () => new Date('2026-09-12T09:00:00Z') });
  await assert.rejects(service.message('Keep activity at home'));
  assert.equal(service.getState().status, 'failed');
  assert.equal(sdk.observerCount(), 2);
  assert.equal(sdk.calls.filter(c => c.body?.events?.[0]?.type === 'agent.session.input.message').length, 1);
  assert.equal(sdk.searchCount(), 0);
  assert.ok(!sdk.calls.some(c => c.body?.events?.[0]?.type === 'agent.session.input.cancel'));
});

// Opt in explicitly: MENTOR_LIVE_CHECK=1 node scripts/test.mjs mentor
// Two bounded turns in one real session, Exa retrieval, local approval and export; no external calendar writes.
test('optional real Agents and Exa flow: disruption, approval, persistent home follow-up and ICS', { skip: process.env.MENTOR_LIVE_CHECK !== '1', timeout: 250_000 }, async t => {
  const { config } = await import('dotenv');
  config({ path: ['.env.local', '.env'] });
  const status = getProviderStatus();
  assert.ok(status.agents && status.search, 'Real OpenAI and Exa configuration are required; this check never uses fixtures.');
  const { service } = fixture(t, { mode: 'live', providerStatus: getProviderStatus });
  t.after(async () => {
    const id = service.getState().sessionId;
    if (!id) return;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: 'https://api.openai.com/v1', logLevel: 'off', maxRetries: 0 });
    try { await client.beta.agents.sessions.delete(id, { signal: AbortSignal.timeout(5000), timeout: 5000, maxRetries: 0 }); t.diagnostic(`Live QA session cleanup succeeded: ${id}`); }
    catch { t.diagnostic(`Live QA session cleanup unconfirmed: ${id}`); }
  });
  const initial = await service.disrupt();
  assert.equal(initial.status, 'pending'); assert.ok(initial.proposal!.sources.length > 0);
  assert.ok(initial.proposal!.speech.length <= 800);
  assert.equal(validateMentorPlan(initial.events, initial.proposal!.changes).valid, true);
  const sessionId = initial.sessionId;
  assert.ok(sessionId);
  service.approve(initial.proposal!.id);
  const next = await service.message('Keep the workout at home instead. Preserve the full study block and dinner. Use an actual retrieved TOGAF study resource to support our joint plan.', 'Dubai Marina');
  assert.equal(next.sessionId, sessionId); assert.equal(next.status, 'pending');
  assert.ok(next.proposal!.sources.length > 0);
  assert.ok(next.proposal!.changes.some(c => c.eventId === 'workout' && /home/i.test(c.title)));
  assert.equal(validateMentorPlan(next.events, next.proposal!.changes).valid, true);
  const saved = service.approve(next.proposal!.id);
  assert.equal(saved.status, 'approved'); assert.ok(saved.memory.filter(m => m.startsWith('Approved locally')).length === 2);
  assert.match(service.calendarICS(), /BEGIN:VEVENT\r\n/);
  t.diagnostic(JSON.stringify({ live: true, sessionId, proposalIds: [initial.proposal!.id, next.proposal!.id], sources: next.proposal!.sources.map(s => ({ id: s.id, url: s.url })), calendarExport: true, externalCalendarWrites: false }));
});
