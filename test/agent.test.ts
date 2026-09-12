import { test } from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { Engine } from '../src/engine.js';
import { Store } from '../src/store.js';
import { DealAgent } from '../src/agent.js';
import { initialOffer, counteroffer, firstMessage, evidence } from '../src/fixtures.js';

function fixture(outcome: 'completed' | 'failed' | 'idle' = 'completed') {
  const calls: { method: string; path: string; body: any }[] = [];
  let turn = 0;
  const session = { id: 'session_test', status: 'idle', required_actions: [] };
  const events = () => {
    turn++;
    const turnId = `turn_${turn}`;
    const action = (name: string, args: unknown, call: string) => ({ type: 'agent.session.requires_action', session: { ...session, required_actions: [{ type: 'function_call', turn_id: turnId, call_id: call, name, arguments: args }] } });
    return [
      { type: 'agent.session.created', session },
      { type: 'agent.session.turn.created', session_id: session.id, turn_id: turnId },
      action('get_deal_context', {}, `context_${turn}`),
      action('get_deal_context', {}, `context_${turn}`), // repeated delivery must reuse saved output
      action('evaluate_terms', initialOffer, `evaluate_${turn}`),
      action('submit_decision', { incomingTerms: initialOffer, proposedTerms: counteroffer, rationale: 'History supports fee concessions; preserve the 24-month term.', evidenceRefs: evidence.map(item => item.id) }, `submit_${turn}`),
      outcome === 'idle' ? { type: 'agent.session.idle', session } : { type: `agent.session.turn.${outcome}`, session_id: session.id, turn_id: turnId, turn: { status: outcome } },
    ];
  };
  const sse = (list: unknown[]) => new Response(list.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } });
  const client = new OpenAI({ apiKey: 'test-key-never-sent', maxRetries: 0, fetch: async (url, init) => {
    const path = new URL(String(url)).pathname;
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ method, path, body });
    if (method === 'POST' && path.endsWith('/agents/sessions')) return sse(events());
    if (method === 'GET' && path.endsWith('/events')) return sse(outcome === 'completed' ? events() : []);
    if (method === 'POST' && path.endsWith('/events')) return new Response(null, { status: 204 });
    if (method === 'GET' && path.includes('/turns/')) return Response.json({ id: `turn_${turn}`, status: outcome === 'completed' ? 'completed' : 'failed' });
    if (method === 'GET' && path.endsWith('/session_test')) return Response.json(session);
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
  assert.equal(results.length, 4);
  assert.equal(results[0]!.body.events[0].call_id, 'context_1');
  assert.equal(results[0]!.body.events[0].output, results[1]!.body.events[0].output);
  assert.equal(engine.state.audit.filter(e => e.type === 'tool_result').length, 3);
  assert.equal(p.proposedMetrics!.annualizedCost, 1040000);
  assert.equal(p.evidenceRefs.length, 9, 'The real model cited all nine known records; this must remain a valid decision.');
});
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
