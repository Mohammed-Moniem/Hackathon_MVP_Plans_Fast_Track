import { test } from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { Engine } from '../src/engine.js';
import { Store } from '../src/store.js';
import { DealAgent } from '../src/agent.js';
import { initialOffer, counteroffer, firstMessage, evidence } from '../src/fixtures.js';

type FixtureOptions = {
  events?: (events: any[], turn: number) => any[];
  recovery?: { turn?: (turn: any) => any; session?: (session: any, events: any[]) => any; events?: (events: any[]) => any[] };
  failToolResultOnce?: string;
};
function fixture(outcome: 'completed' | 'failed' | 'idle' = 'completed', options: FixtureOptions = {}) {
  const calls: { method: string; path: string; body: any }[] = [];
  let turn = 0;
  let fullEvents: any[] = [], recovering = false, failedToolResult = false;
  const session = { id: 'session_test', status: 'idle', required_actions: [] };
  const remoteTurn = (status: string) => ({ id: `turn_${turn}`, session_id: session.id, status, subagent_id: null, created_at: Math.floor(Date.now() / 1000) });
  const events = () => {
    turn++;
    const turnId = `turn_${turn}`;
    const action = (name: string, args: unknown, call: string) => ({ type: 'agent.session.requires_action', session: { ...session, required_actions: [{ type: 'function_call', turn_id: turnId, call_id: call, name, arguments: args }] } });
    fullEvents = [
      { type: 'agent.session.created', session },
      { type: 'agent.session.turn.created', session_id: session.id, turn_id: turnId, turn: remoteTurn('in_progress') },
      action('get_deal_context', {}, `context_${turn}`),
      action('get_deal_context', {}, `context_${turn}`), // repeated delivery must reuse saved output
      action('evaluate_terms', initialOffer, `evaluate_${turn}`),
      action('evaluate_terms', counteroffer, `evaluate_proposed_${turn}`),
      action('submit_decision', { incomingTerms: initialOffer, proposedTerms: counteroffer, rationale: 'History supports fee concessions; preserve the 24-month term.', evidenceRefs: evidence.map(item => item.id) }, `submit_${turn}`),
      outcome === 'idle' ? { type: 'agent.session.idle', session } : { type: `agent.session.turn.${outcome}`, session_id: session.id, turn_id: turnId, turn: remoteTurn(outcome) },
    ];
    return options.events?.(structuredClone(fullEvents), turn) ?? fullEvents;
  };
  const sse = (list: unknown[]) => new Response(list.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } });
  const client = new OpenAI({ apiKey: 'test-key-never-sent', maxRetries: 0, fetch: async (url, init) => {
    const path = new URL(String(url)).pathname;
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ method, path, body });
    if (method === 'POST' && path.endsWith('/agents/sessions')) return sse(events());
    if (method === 'GET' && path.endsWith('/events')) {
      if (options.recovery) { recovering = true; return sse(options.recovery.events?.(fullEvents) ?? []); }
      return sse(outcome === 'completed' ? events() : []);
    }
    if (method === 'POST' && path.endsWith('/events')) {
      if (options.failToolResultOnce && !failedToolResult && body?.events?.[0]?.call_id === options.failToolResultOnce) {
        failedToolResult = true;
        throw new OpenAI.APIConnectionError({ message: 'Synthetic lost tool-result response' });
      }
      return new Response(null, { status: 204 });
    }
    if (method === 'GET' && path.includes('/turns/')) {
      const value = remoteTurn(outcome === 'completed' ? 'completed' : 'failed');
      return Response.json(options.recovery?.turn?.(value) ?? value);
    }
    if (method === 'GET' && path.endsWith('/session_test')) return Response.json(recovering && options.recovery?.session ? options.recovery.session(session, fullEvents) : session);
    throw new Error(`Unexpected fake transport call ${method} ${path}`);
  } });
  const engine = new Engine(new Store(), { CFO: ['cfo'], 'Procurement Director': ['procurement'] });
  const thread = engine.receive({ id: 'event1', channel: 'CDEMO', threadTs: '123', user: 'supplier', text: firstMessage })!;
  return { engine, thread, agent: new DealAgent(engine, client, 'gpt-6-astra', 5000), calls };
}

test('actual SDK handles session SSE and tool results, then promotes a staged proposal', async () => {
  const { agent, engine, thread, calls } = fixture();
  const p = await agent.run(thread.key, 1);
  assert.equal(p.status, 'pending'); assert.equal(p.mode, 'live');
  assert.equal(engine.thread(thread.key).sessionId, 'session_test');
  assert.equal(calls[0]!.body.environment.type, 'openai_hosted');
  assert.equal(calls[0]!.body.agent.tools.length, 3);
  const results = calls.filter(c => c.body?.events?.[0]?.type === 'agent.session.input.tool_result');
  assert.equal(results.length, 5);
  assert.equal(results[0]!.body.events[0].call_id, 'context_1');
  assert.equal(results[0]!.body.events[0].output, results[1]!.body.events[0].output);
  assert.equal(engine.state.audit.filter(e => e.type === 'tool_result').length, 4);
  assert.equal(p.proposedMetrics!.annualizedCost, 1040000);
  assert.equal(p.evidenceRefs.length, 9, 'The real model cited all nine known records; this must remain a valid decision.');
});

const tool = (event: any) => event.session?.required_actions?.[0];
const submit = (events: any[]) => events.find(e => tool(e)?.name === 'submit_decision');
const results = (calls: { body: any }[]) => calls.flatMap(c => c.body?.events ?? []).filter(e => e.type === 'agent.session.input.tool_result');

for (const mismatch of ['tool-turn', 'session', 'concurrent-turn', 'completion-turn', 'completion-resource', 'completion-status', 'subagent', 'old-root'] as const) {
  test(`rejects ${mismatch} identity before promotion without recovering into success`, async () => {
    const f = fixture('completed', { events: events => {
      if (mismatch === 'tool-turn') tool(submit(events)).turn_id = 'foreign-turn';
      if (mismatch === 'session') submit(events).session.id = 'foreign-session';
      if (mismatch === 'concurrent-turn') events.splice(-1, 0, { ...events[1], turn_id: 'foreign-turn', turn: { ...events[1].turn, id: 'foreign-turn' } });
      if (mismatch === 'completion-turn') events.at(-1).turn_id = 'foreign-turn';
      if (mismatch === 'completion-resource') events.at(-1).turn.session_id = 'foreign-session';
      if (mismatch === 'completion-status') events.at(-1).turn.status = 'failed';
      if (mismatch === 'subagent') events.at(-1).turn.subagent_id = 'unexpected-child';
      if (mismatch === 'old-root') events[1].turn.created_at = 1;
      return events;
    } });
    await assert.rejects(f.agent.run(f.thread.key, 1), /different|intended|concurrent/);
    assert.equal(f.engine.thread(f.thread.key).sessionId, 'session_test');
    assert.ok(Object.values(f.engine.state.proposals).every(p => !['pending', 'sent'].includes(p.status)));
    assert.ok(!results(f.calls).some(r => r.turn_id === 'foreign-turn'));
    assert.ok(!f.calls.some(c => c.path.includes('foreign-session')));
    assert.ok(!f.calls.some(c => c.method === 'GET' && c.path.endsWith('/events')), 'Protocol failure must not enter recovery');
  });
}

test('a reused tool-call ID with altered arguments cannot reuse successful context output', async () => {
  const f = fixture('completed', { events: events => {
    tool(events[3]).name = 'submit_decision';
    tool(events[3]).arguments = tool(submit(events)).arguments;
    return events;
  } });
  await assert.rejects(f.agent.run(f.thread.key, 1), /repeated tool call changed/);
  assert.equal(results(f.calls).length, 1);
  assert.equal(Object.keys(f.engine.state.proposals).length, 0);
});

for (const omitted of ['context', 'incoming-evaluation', 'proposed-evaluation'] as const) {
  test(`cannot stage without this turn's ${omitted}`, async () => {
    const f = fixture('completed', { events: events => events.filter(e => omitted === 'context'
      ? tool(e)?.name !== 'get_deal_context'
      : tool(e)?.call_id !== (omitted === 'incoming-evaluation' ? 'evaluate_1' : 'evaluate_proposed_1')) });
    await assert.rejects(f.agent.run(f.thread.key, 1), /did not stage/);
    assert.equal(Object.keys(f.engine.state.proposals).length, 0);
    const result = results(f.calls).find(r => r.call_id === 'submit_1');
    assert.equal(result.success, false);
    assert.match(result.error, omitted === 'context' ? /get_deal_context/ : /exact.*terms/);
  });
}

for (const field of ['incomingTerms', 'proposedTerms'] as const) {
  test(`evaluated terms must exactly match ${field}, including payment days`, async () => {
    const f = fixture('completed', { events: events => {
      const args = tool(submit(events)).arguments;
      args[field] = { ...args[field], paymentDays: args[field].paymentDays + 1 };
      return events;
    } });
    await assert.rejects(f.agent.run(f.thread.key, 1), /did not stage/);
    assert.equal(Object.keys(f.engine.state.proposals).length, 0);
    assert.match(results(f.calls).find(r => r.call_id === 'submit_1').error, /exact.*terms/);
  });
}

test('context and evaluations from a previous completed turn do not authorize a follow-up', async () => {
  const f = fixture('completed', { events: (events, turn) => turn === 1 ? events : events.filter(e => !tool(e) || tool(e).name === 'submit_decision') });
  await f.agent.run(f.thread.key, 1);
  f.engine.receive({ id: 'event2', channel: 'CDEMO', threadTs: '123', user: 'supplier', text: 'Review the next version.' });
  await assert.rejects(f.agent.run(f.thread.key, 2), /did not stage/);
  assert.equal(Object.values(f.engine.state.proposals).length, 1);
  assert.equal(Object.values(f.engine.state.proposals)[0]!.status, 'stale');
});

test('a null-terms clarification hold requires context but no invented evaluation', async () => {
  const f = fixture('completed', { events: events => {
    const args = tool(submit(events)).arguments;
    args.incomingTerms = null; args.proposedTerms = null;
    return events.filter(e => tool(e)?.name !== 'evaluate_terms');
  } });
  assert.equal((await f.agent.run(f.thread.key, 1)).status, 'blocked');
});

test('invalid context and failed evaluations do not satisfy staging prerequisites', async () => {
  for (const invalid of ['context', 'evaluation']) {
    const f = fixture('completed', { events: events => {
      if (invalid === 'context') for (const event of events.filter(e => tool(e)?.name === 'get_deal_context')) tool(event).arguments = { unexpected: true };
      else tool(events.find(e => tool(e)?.call_id === 'evaluate_proposed_1')).arguments = { ...counteroffer, paymentDays: -1 };
      return events;
    } });
    await assert.rejects(f.agent.run(f.thread.key, 1), /did not stage/);
    assert.equal(Object.keys(f.engine.state.proposals).length, 0);
    assert.equal(results(f.calls).find(r => r.call_id === 'submit_1').success, false);
  }
});

test('a rejected premature submit can be corrected by evaluating both terms before a fresh call', async () => {
  const f = fixture('completed', { events: events => {
    const premature = structuredClone(submit(events)); tool(premature).call_id = 'premature-submit';
    events.splice(4, 0, premature); return events;
  } });
  assert.equal((await f.agent.run(f.thread.key, 1)).status, 'pending');
  assert.equal(results(f.calls).find(r => r.call_id === 'premature-submit').success, false);
  assert.equal(results(f.calls).find(r => r.call_id === 'submit_1').success, true);
});

test('matching completed-turn recovery retains staged decision without resubmitting input', async () => {
  const f = fixture('completed', { events: events => events.slice(0, -1), recovery: {} });
  assert.equal((await f.agent.run(f.thread.key, 1)).status, 'pending');
  assert.equal(f.calls.filter(c => c.method === 'POST' && c.path.endsWith('/agents/sessions')).length, 1);
  assert.equal(f.calls.filter(c => c.body?.events?.[0]?.type === 'agent.session.input.message').length, 0);
});

test('recovery resends the exact cached result and continues the same turn with retained validation', async () => {
  const f = fixture('completed', { failToolResultOnce: 'evaluate_proposed_1', recovery: {
    turn: turn => ({ ...turn, status: 'waiting' }),
    session: (session, events) => {
      const pending = tool(events.find(e => tool(e)?.call_id === 'evaluate_proposed_1'));
      return { ...session, status: 'requires_action', required_actions: [{ ...pending, arguments: Object.fromEntries(Object.entries(pending.arguments).reverse()) }] };
    },
    events: events => events.slice(-2),
  } });
  assert.equal((await f.agent.run(f.thread.key, 1)).status, 'pending');
  const repeated = results(f.calls).filter(r => r.call_id === 'evaluate_proposed_1');
  assert.equal(repeated.length, 2); assert.deepEqual(repeated[0], repeated[1]);
  assert.equal(f.engine.state.audit.filter(e => e.type === 'tool_result' && e.detail.includes('evaluate_proposed_1')).length, 1);
  assert.equal(f.calls.filter(c => c.body?.events?.[0]?.type === 'agent.session.input.message').length, 0);
});

for (const mismatch of ['turn-id', 'session-id', 'subagent', 'old-turn', 'retrieved-session', 'pending-action'] as const) {
  test(`recovery rejects ${mismatch} without accepting foreign output`, async () => {
    const f = fixture('completed', { events: events => events.slice(0, -1), recovery: {
      turn: turn => ({ ...turn,
        ...(mismatch === 'turn-id' ? { id: 'foreign-turn' } : {}),
        ...(mismatch === 'session-id' ? { session_id: 'foreign-session' } : {}),
        ...(mismatch === 'subagent' ? { subagent_id: 'unexpected-child' } : {}),
        ...(mismatch === 'old-turn' ? { created_at: 1 } : {}),
        ...(mismatch === 'pending-action' ? { status: 'waiting' } : {}),
      }),
      session: (session, events) => ({ ...session,
        ...(mismatch === 'retrieved-session' ? { id: 'foreign-session' } : {}),
        ...(mismatch === 'pending-action' ? { required_actions: [{ ...tool(submit(events)), call_id: 'foreign-action', turn_id: 'foreign-turn' }] } : {}),
      }),
    } });
    await assert.rejects(f.agent.run(f.thread.key, 1), /different|intended/);
    assert.equal(Object.values(f.engine.state.proposals)[0]!.status, 'failed');
    assert.ok(!results(f.calls).some(r => r.call_id === 'foreign-action'));
  });
}
test('follow-up reuses the same session and subscribes before posting the new message', async () => {
  const { agent, engine, thread, calls } = fixture();
  await agent.run(thread.key, 1);
  engine.receive({ id: 'event2', channel: 'CDEMO', threadTs: '123', user: 'supplier', text: 'The same service scope still applies.' });
  await agent.run(thread.key, 2);
  assert.equal(calls.filter(c => c.method === 'POST' && c.path.endsWith('/agents/sessions')).length, 1);
  const input = calls.findIndex(c => c.body?.events?.[0]?.type === 'agent.session.input.message');
  assert.ok(input > 0);
  assert.equal(calls[input - 1]!.method, 'GET'); assert.match(calls[input - 1]!.path, /\/events$/);
  assert.match(calls[input]!.body.events[0].input[0].content[0].text, /version 2/);
});
test('an idle notification cannot turn a partial run into an actionable proposal', async () => {
  const { agent, engine, thread } = fixture('idle');
  await assert.rejects(agent.run(thread.key, 1), /before the intended turn completed/);
  assert.equal(Object.values(engine.state.proposals)[0]!.status, 'failed');
});
test('failed model turn leaves staged output non-executable and cancels pending work', async () => {
  const { agent, engine, thread, calls } = fixture('failed');
  await assert.rejects(agent.run(thread.key, 1), /Agent stopped/);
  assert.equal(Object.values(engine.state.proposals)[0]!.status, 'failed');
  assert.ok(calls.some(c => c.body?.events?.[0]?.type === 'agent.session.input.cancel'));
});
