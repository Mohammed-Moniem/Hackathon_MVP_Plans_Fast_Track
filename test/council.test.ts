import { test } from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { CouncilError, createCouncilRunner, runCouncil, type CouncilOptions } from '../src/council.js';
import type { CouncilDecision, CouncilHooks, CouncilInput, CouncilMessage, CustomMentor } from '../src/ecosystem-types.js';
import type { SearchResult } from '../src/providers.js';

const source: SearchResult = { id: 'exa-gym', title: 'Provider-returned gym page', url: 'https://example.org/gym', snippet: 'A community gym with exercise equipment.' };
const meal = { url: '/api/ecosystem/images/00000000-0000-4000-8000-000000000001', caption: 'AI-generated meal illustration, not verified nutrition facts.', prompt: 'A bean and rice dinner', generatedAt: '2026-09-12T10:00:00Z' };
function mentor(id: string, tools: CustomMentor['tools'] = []): CustomMentor {
  return { id, name: id === 'health' ? 'Mira' : id === 'finance' ? 'Atlas' : id, domain: id, description: `${id} mentor`, instructions: `Protect ${id} goals`, goals: [`Improve ${id}`], tools, voice: 'health', color: '#234567', createdAt: '2026-09-12T10:00:00Z' };
}
function input(): CouncilInput {
  return { prompt: 'Find a gym while protecting my budget.', mentors: [mentor('health', ['search']), mentor('finance')], profile: { location: 'Dubai Marina', currency: 'AED', monthlyIncome: 5000, essentialExpenses: 4200, savingsTarget: 600, wellnessBudget: 300, preferences: 'Prefer mornings', dietaryPreferences: 'Vegetarian', goals: 'Build sustainable habits' }, memory: ['Keep the emergency fund intact.'] };
}
type Position = { assessment: string; proposal: string; concerns: string[]; peerReviews: Array<{ mentorId: string; assessment: string; disagrees: boolean; resolution: string }>; sourceIds: string[] };
type Prompt = { phase: 'proposal' | 'review'; context: CouncilInput & { request: string; affordable: number; attachment: CouncilInput['attachment'] | null }; earlierProposals: Array<{ mentorId: string; output: Position }>; sources: SearchResult[] };
type Action = { name: string; arguments: Record<string, unknown>; call_id?: string; turn_id?: string };
type Session = { id: string; mentorId: string; prompt: Prompt; turnId: string; recovery: boolean };
type FixtureOptions = {
  actions?: (session: Session) => Action[];
  position?: (session: Session, value: Position) => unknown;
  decision?: (value: CouncilDecision) => unknown;
  status?: string;
  outcome?: 'failed' | 'idle' | 'wrong-turn' | 'hang' | 'recover' | 'persisted' | 'shared-session' | 'built-in' | 'submit-interrupted' | 'submit-unaccepted' | 'recover-completed' | 'recover-tool';
  hangingCleanup?: boolean;
};
function fixture(options: FixtureOptions = {}) {
  const sessions: Session[] = [];
  const creates: Array<Record<string, any>> = [];
  const followups: Array<{ id: string; prompt: Prompt }> = [];
  const order: string[] = [];
  const results: Array<Record<string, any>> = [];
  const deletions: string[] = [], cancellations: string[] = [];
  const synthesis: Array<Record<string, any>> = [];
  const messages: CouncilMessage[] = [], sourceBatches: SearchResult[][] = [];
  let searches = 0, images = 0;
  const outputs = new Map<string, string>();
  const position = (s: Session): Position => ({
    assessment: s.mentorId === 'health' ? 'A gym could support consistent exercise.' : 'Protect savings and essential expenses.',
    proposal: s.mentorId === 'health' ? 'Compare a basic gym membership.' : 'Start with free exercise at home.',
    concerns: ['Avoid an unaffordable subscription.'],
    peerReviews: s.prompt.phase === 'review' ? s.prompt.earlierProposals.filter(p => p.mentorId !== s.mentorId).map(p => ({ mentorId: p.mentorId, assessment: `I read the actual proposal: ${p.output.proposal}`, disagrees: true, resolution: 'Start free; consider a membership only within confirmed capacity.' })) : [],
    sourceIds: [],
  });
  const turn = (s: Session, status = 'completed') => ({ id: s.turnId, session_id: s.id, status, subagent_id: null, created_at: Math.floor(Date.now() / 1000) });
  const finalItem = (s: Session) => ({ id: `${s.turnId}-item`, type: 'message', role: 'assistant', phase: 'final_answer', status: 'completed', turn_id: s.turnId, content: [{ type: 'output_text', text: outputs.get(s.turnId) }] });
  const stream = (s: Session) => ({
    controller: new AbortController(),
    async *[Symbol.asyncIterator]() {
      if (s.prompt.phase === 'proposal' && !s.recovery) yield { type: 'agent.session.created', session: { id: s.id } };
      yield { type: 'agent.session.turn.created', session_id: s.id, turn_id: s.turnId };
      if (options.outcome === 'hang') { await new Promise(() => {}); return; }
      if (options.outcome === 'recover' && !s.recovery && s.prompt.phase === 'proposal') { s.recovery = true; throw new OpenAI.APIConnectionError({ message: 'test stream interruption' }); }
      for (const [index, action] of (options.actions?.(s) ?? []).entries()) {
        yield { type: 'agent.session.requires_action', session: { id: s.id, required_actions: [{ type: 'function_call', turn_id: s.turnId, call_id: `${s.turnId}-${index}`, ...action }] } };
      }
      if (options.outcome === 'failed') { yield { type: 'agent.session.turn.failed', session_id: s.id, turn_id: s.turnId }; return; }
      if (options.outcome === 'idle') { yield { type: 'agent.session.idle', session: { id: s.id } }; return; }
      if (options.outcome === 'wrong-turn') { yield { type: 'agent.session.turn.output_text.done', session_id: s.id, turn_id: 'not-this-turn', text: '{}' }; return; }
      if (options.outcome === 'built-in') { yield { type: 'agent.session.turn.item.done', session_id: s.id, turn_id: s.turnId, item: { type: 'command_execution' } }; return; }
      const raw = options.position?.(s, position(s)) ?? position(s);
      outputs.set(s.turnId, typeof raw === 'string' ? raw : JSON.stringify(raw));
      if (options.outcome === 'recover-completed' && !s.recovery && s.prompt.phase === 'proposal') { s.recovery = true; throw new OpenAI.APIConnectionError({ message: 'final events lost after completion' }); }
      if (options.outcome !== 'persisted') {
        yield { type: 'agent.session.turn.output_text.done', session_id: s.id, turn_id: s.turnId, item_id: `${s.turnId}-item`, content_index: 0, text: outputs.get(s.turnId) };
        yield { type: 'agent.session.turn.item.done', session_id: s.id, turn_id: s.turnId, item: finalItem(s) };
      }
      yield { type: 'agent.session.turn.completed', session_id: s.id, turn_id: s.turnId, turn: turn(s) };
    },
  });
  const client = { beta: { agents: { sessions: {
    create: async (body: Record<string, any>, request: Record<string, any>) => {
      assert.equal(request.maxRetries, 0); assert.ok(request.signal instanceof AbortSignal);
      creates.push(body);
      const s: Session = { id: options.outcome === 'shared-session' ? 'session-shared' : `session-${sessions.length}`, mentorId: body.metadata.mentor, prompt: JSON.parse(body.input), turnId: `${body.metadata.mentor}-proposal`, recovery: false };
      sessions.push(s); return stream(s);
    },
    retrieve: async (id: string) => {
      const s = sessions.find(s => s.id === id)!;
      return { id, status: 'in_progress', required_actions: options.outcome === 'recover-tool' && s.recovery ? [{ type: 'function_call', turn_id: s.turnId, call_id: `${s.turnId}-0`, ...(options.actions?.(s)[0]) }] : [] };
    },
    delete: async (id: string) => { deletions.push(id); if (options.hangingCleanup) await new Promise(() => {}); return { id }; },
    events: {
      stream: async (id: string) => { order.push(`subscribe:${id}`); return stream(sessions.find(s => s.id === id)!); },
      create: async (id: string, body: Record<string, any>) => {
        for (const event of body.events) {
          if (event.type === 'agent.session.input.message') {
            order.push(`input:${id}`); const s = sessions.find(s => s.id === id)!;
            if (options.outcome === 'submit-unaccepted') throw new OpenAI.APIConnectionError({ message: 'submission did not arrive' });
            s.prompt = JSON.parse(event.input[0].content[0].text); s.turnId = `${s.mentorId}-review`; s.recovery = false;
            followups.push({ id, prompt: s.prompt });
            if (options.outcome === 'submit-interrupted') { s.recovery = true; throw new OpenAI.APIConnectionError({ message: 'accepted submission response was lost' }); }
          } else if (event.type === 'agent.session.input.cancel') cancellations.push(id);
          else {
            results.push({ sessionId: id, ...event }); const s = sessions.find(s => s.id === id)!;
            if (options.outcome === 'recover-tool' && !s.recovery && s.prompt.phase === 'proposal') { s.recovery = true; throw new OpenAI.APIConnectionError({ message: 'tool result response lost' }); }
          }
        }
      },
    },
    turns: {
      retrieve: async (_id: string, args: { session_id: string }) => { const s = sessions.find(s => s.id === args.session_id)!; return turn(s, s.recovery && options.outcome !== 'recover-completed' ? 'in_progress' : 'completed'); },
      list: async (id: string) => ({ data: [turn(sessions.find(s => s.id === id)!, 'in_progress')] }),
    },
    items: { list: async (id: string) => ({ data: [finalItem(sessions.find(s => s.id === id)!)] }) },
  } } }, responses: { create: async (body: Record<string, any>) => {
    synthesis.push(body); const data = JSON.parse(body.input);
    const decision: CouncilDecision = { title: 'Activity within your budget', summary: 'Start with a practical, affordable option.', conflicts: data.disagreements.map((d: Record<string, string>) => ({ topic: d.topic, positions: 'Placeholder overwritten by actual positions', resolution: d.suggestedResolution })), alternatives: [{ title: 'Basic gym', estimatedCost: 150, cadence: 'monthly', rationale: 'Consider this only after confirming the quote.', sourceIds: [] }], recommendation: 'Compare a basic gym with exercise at home.', cautions: ['Verify fees before committing.'] };
    const raw = options.decision?.(decision) ?? decision;
    return { status: options.status ?? 'completed', output_text: typeof raw === 'string' ? raw : JSON.stringify(raw) };
  } } } as unknown as OpenAI;
  const hooks: CouncilHooks = { message: m => messages.push(m), sources: s => sourceBatches.push(s) };
  const dependencies: CouncilOptions = { client, providerStatus: () => ({ agents: true, search: true, voice: false }), timeoutMs: 2000, roundTimeoutMs: 1000, cleanupTimeoutMs: 25, search: async () => { searches++; return [source]; }, generateMealImage: async () => { images++; return meal; } };
  return { client, hooks, dependencies, creates, followups, order, results, deletions, cancellations, synthesis, messages, sourceBatches, searches: () => searches, images: () => images };
}
const errorCode = (code: string) => (error: unknown) => error instanceof CouncilError && error.code === code;

test('distinct hosted mentors exchange actual proposals, review every peer, and synthesize all disagreements', async () => {
  const f = fixture(); const original = input(); const snapshot = structuredClone(original);
  const evidence: unknown[] = [];
  const decision = await createCouncilRunner({ ...f.dependencies, onSession: s => evidence.push(s) })(original, f.hooks);
  assert.equal(typeof runCouncil, 'function'); assert.deepEqual(original, snapshot);
  assert.equal(f.creates.length, 2); assert.equal(f.followups.length, 2); assert.equal(f.synthesis.length, 1);
  assert.equal(new Set(f.deletions).size, 2); assert.equal(f.cancellations.length, 0);
  for (const c of f.creates) {
    assert.deepEqual(c.environment, { type: 'openai_hosted' }); assert.equal(c.agent.multi_agent.enabled, false);
    assert.equal(c.agent.text.format.type, 'json_schema'); assert.equal(c.agent.text.format.schema.additionalProperties, false);
    assert.ok(c.agent.instructions.includes(c.metadata.mentor));
    const p = JSON.parse(c.input); assert.deepEqual(p.context.profile, original.profile); assert.deepEqual(p.context.memory, original.memory); assert.equal(p.context.affordable, 200);
  }
  assert.deepEqual(f.creates.map(c => c.agent.tools.map((t: { name: string }) => t.name)), [['search_options'], []]);
  for (const fup of f.followups) {
    assert.equal(fup.prompt.earlierProposals.length, 2);
    assert.equal(fup.prompt.earlierProposals[0]!.output.proposal, 'Compare a basic gym membership.');
    assert.equal(fup.prompt.earlierProposals[1]!.output.proposal, 'Start with free exercise at home.');
    assert.ok(f.order.indexOf(`subscribe:${fup.id}`) < f.order.indexOf(`input:${fup.id}`));
  }
  const final = JSON.parse(f.synthesis[0]!.input);
  assert.equal(final.proposals.length, 2); assert.equal(final.reviews.length, 2); assert.equal(final.disagreements.length, 2);
  assert.equal(f.synthesis[0]!.text.format.strict, true); assert.deepEqual(f.synthesis[0]!.tools, []);
  assert.equal(decision.conflicts.length, 2); assert.match(decision.conflicts[0]!.positions, /actual proposal/);
  assert.ok(f.messages.some(m => m.phase === 'review' && m.to === 'finance'));
  assert.equal(f.messages.filter(m => m.phase === 'resolution').length, 1); assert.equal(evidence.length, 6);
  assert.match(decision.alternatives.find(a => a.estimatedCost === 150)!.rationale, /Unverified/);
});

test('participant bounds, distinct identity and complete finite finances are enforced before API calls', async () => {
  const f = fixture(); const runner = createCouncilRunner(f.dependencies);
  for (const update of [ { mentors: [mentor('health')] }, { mentors: Array.from({ length: 5 }, (_, i) => mentor(`m${i}`)) }, { mentors: [mentor('same'), mentor('same')] }, { profile: { ...input().profile, monthlyIncome: NaN } }, { profile: { ...input().profile, wellnessBudget: -1 } }, { profile: { ...input().profile, savingsTarget: undefined } } ]) {
    await assert.rejects(runner({ ...input(), ...update } as CouncilInput, f.hooks), errorCode('INVALID_INPUT'));
  }
  assert.equal(f.creates.length, 0);
});

test('all four selected participants run, without silently truncating the council', async () => {
  const f = fixture(); const value = input(); value.mentors.push(mentor('career'), mentor('nutrition'));
  const result = await createCouncilRunner(f.dependencies)(value, f.hooks);
  assert.equal(f.creates.length, 4); assert.equal(f.followups.length, 4); assert.equal(result.conflicts.length, 12);
});

test('explicit lightweight synthesis override preserves primary Agents model and omits unsupported settings', async () => {
  const f = fixture(); await createCouncilRunner({ ...f.dependencies, model: 'gpt-6-astra', synthesisModel: 'gpt-4.1-mini' })(input(), f.hooks);
  assert.ok(f.creates.every(c => c.agent.model === 'gpt-6-astra'));
  assert.equal(f.synthesis[0]!.model, 'gpt-4.1-mini'); assert.ok(!('reasoning' in f.synthesis[0]!)); assert.ok(!('verbosity' in f.synthesis[0]!.text));
});

test('zero capacity uses exact shared-profile formula and forces free/no-spend recommendations', async () => {
  for (const profile of [{ ...input().profile, essentialExpenses: 4800 }, { ...input().profile, wellnessBudget: 0 }]) {
    const f = fixture(); const result = await createCouncilRunner(f.dependencies)({ ...input(), profile }, f.hooks);
    assert.equal(JSON.parse(f.creates[0]!.input).context.affordable, 0);
    assert.ok(result.alternatives.length > 0); assert.ok(result.alternatives.every(a => a.estimatedCost === 0));
    assert.match(result.recommendation, /no-spend/); assert.match(result.recommendation, /AED 0/);
  }
});

test('a positive but insufficient budget excludes unaffordable estimates and protects savings', async () => {
  const f = fixture(); const value = input(); value.profile.wellnessBudget = 100;
  const result = await createCouncilRunner(f.dependencies)(value, f.hooks);
  assert.equal(JSON.parse(f.creates[0]!.input).context.affordable, 100);
  assert.ok(result.alternatives.every(a => a.estimatedCost === null || a.estimatedCost <= 100));
  assert.match(result.recommendation, /above the AED 100.*excluded/);
});

test('signed receipt adjustments and intact approval memory do not alter shared-profile finances', async () => {
  const f = fixture(); const value = input(); value.mentors[0]!.tools.push('vision');
  value.memory = [`Approved earlier: ${'A'.repeat(2700)}`];
  value.attachment = { summary: 'Refund receipt', merchant: null, total: -15, currency: 'AED', items: [{ name: 'Refund', amount: -15 }], uncertainties: [] };
  await createCouncilRunner(f.dependencies)(value, f.hooks);
  const context = JSON.parse(f.creates[0]!.input).context;
  assert.equal(context.attachment.total, -15); assert.equal(context.affordable, 200); assert.deepEqual(context.memory, value.memory);
});

test('default search tool reaches the existing native-fetch Exa provider, with HTTP fully mocked', async t => {
  const previous = process.env.EXA_API_KEY; process.env.EXA_API_KEY = 'test-only-not-a-real-key';
  t.after(() => { if (previous === undefined) delete process.env.EXA_API_KEY; else process.env.EXA_API_KEY = previous; });
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(String(url), 'https://api.exa.ai/search');
    requests.push({ url: String(url), body: JSON.parse(init.body as string) });
    return new Response(JSON.stringify({ results: [{ title: source.title, url: source.url, text: source.snippet }] }), { headers: { 'content-type': 'application/json' } });
  });
  const f = fixture({ actions: s => s.mentorId === 'health' && s.prompt.phase === 'proposal' ? [{ name: 'search_options', arguments: { query: 'community gym' } }] : [] });
  await createCouncilRunner({ ...f.dependencies, search: undefined })(input(), f.hooks);
  assert.equal(requests.length, 1); assert.equal(requests[0]!.body.query, 'community gym in Dubai Marina');
  assert.equal(f.sourceBatches[0]![0]!.url, source.url); assert.match(f.sourceBatches[0]![0]!.id, /^exa-/);
});

test('timed-out search never publishes late results or mutates returned evidence', async () => {
  let finish!: (sources: SearchResult[]) => void;
  const f = fixture({ actions: s => s.mentorId === 'health' && s.prompt.phase === 'proposal' ? [{ name: 'search_options', arguments: { query: 'gym' } }] : [] });
  await createCouncilRunner({ ...f.dependencies, searchTimeoutMs: 10, search: () => new Promise(resolve => { finish = resolve; }) })(input(), f.hooks);
  const count = f.messages.length; finish([source]); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.sourceBatches.length, 0); assert.equal(f.messages.length, count);
});

test('search permission invokes injected actual provider, returns evidence, and deduplicates repeated call IDs', async () => {
  const f = fixture({ actions: s => s.mentorId === 'health' && s.prompt.phase === 'proposal' ? [0, 1].map(() => ({ name: 'search_options', arguments: { query: 'affordable gym' }, call_id: 'same-call' })) : [], position: (s, p) => ({ ...p, sourceIds: s.mentorId === 'health' || s.prompt.phase === 'review' ? [source.id] : [] }), decision: d => ({ ...d, alternatives: d.alternatives.map(a => ({ ...a, sourceIds: [source.id] })) }) });
  const result = await createCouncilRunner(f.dependencies)(input(), f.hooks);
  assert.equal(f.searches(), 1); assert.equal(f.results.length, 2); assert.equal(f.results[0]!.output, f.results[1]!.output);
  assert.deepEqual(f.sourceBatches[0], [source]); assert.deepEqual(JSON.parse(f.results[0]!.output).sources, [source]);
  assert.ok(f.messages.some(m => m.phase === 'tool' && m.text.includes(source.title)));
  assert.ok(!f.messages.some(m => m.phase === 'tool' && m.text.includes(source.id)));
  assert.match(result.alternatives.find(a => a.estimatedCost === 150)!.rationale, /Unverified price/);
});

test('only a cited retrieved excerpt with matching amount and cadence supports a price', async () => {
  const f = fixture({ actions: s => s.mentorId === 'health' && s.prompt.phase === 'proposal' ? [{ name: 'search_options', arguments: { query: 'gym monthly price' } }] : [], decision: d => ({ ...d, alternatives: d.alternatives.map(a => ({ ...a, sourceIds: [source.id] })) }) });
  const result = await createCouncilRunner({ ...f.dependencies, search: async () => [{ ...source, snippet: 'Membership is AED 150 per month. Conditions apply.' }] })(input(), f.hooks);
  assert.match(result.alternatives.find(a => a.estimatedCost === 150)!.rationale, /appears in a retrieved excerpt/);
});

test('fabricated source IDs are rejected in mentor and synthesis output', async () => {
  for (const atFinal of [false, true]) {
    const f = fixture(atFinal ? { decision: d => ({ ...d, alternatives: [{ ...d.alternatives[0]!, sourceIds: ['invented'] }] }) } : { position: (_s, p) => ({ ...p, sourceIds: ['invented'] }) });
    await assert.rejects(createCouncilRunner(f.dependencies)(input(), f.hooks), errorCode('UNKNOWN_SOURCE'));
    assert.equal(f.messages.filter(m => m.phase === 'resolution').length, 0);
  }
});

test('source existence alone is insufficient when this mentor never received it', async () => {
  const f = fixture({ actions: s => s.mentorId === 'health' ? [{ name: 'search_options', arguments: { query: 'gym' } }] : [], position: (s, p) => s.mentorId === 'finance' && s.prompt.phase === 'proposal' ? { ...p, sourceIds: [source.id] } : p });
  await assert.rejects(createCouncilRunner(f.dependencies)(input(), f.hooks), errorCode('UNKNOWN_SOURCE'));
});

test('permission violations and unexpected built-in capabilities fail without executing providers', async () => {
  for (const setup of [{ actions: (s: Session) => s.mentorId === 'finance' ? [{ name: 'search_options', arguments: { query: 'gym' } }] : [] }, { actions: () => [{ name: 'send_email', arguments: {} }] }, { outcome: 'built-in' as const }]) {
    const f = fixture(setup); await assert.rejects(createCouncilRunner(f.dependencies)(input(), f.hooks), errorCode('TOOL_PERMISSION'));
    assert.equal(f.searches(), 0); assert.equal(f.images(), 0);
  }
});

test('search budget caps actual calls and failed search never fabricates evidence', async () => {
  const f = fixture({ actions: s => s.mentorId === 'health' ? Array.from({ length: 4 }, (_, i) => ({ name: 'search_options', arguments: { query: `gym ${i}` } })) : [] });
  await createCouncilRunner({ ...f.dependencies, searchBudget: 2 })(input(), f.hooks);
  assert.equal(f.searches(), 2); assert.equal(f.results.filter(r => !r.success).length, 6);
  const bad = fixture({ actions: s => s.mentorId === 'health' && s.prompt.phase === 'proposal' ? [{ name: 'search_options', arguments: { query: 'gym' } }] : [] });
  await createCouncilRunner({ ...bad.dependencies, search: async () => { throw new Error('secret-provider-body'); } })(input(), bad.hooks);
  assert.equal(bad.sourceBatches.length, 0); assert.ok(!JSON.stringify(bad.messages).includes('secret-provider-body'));
});

test('malformed model JSON, missing peer review and omitted disagreements cannot become decisions', async () => {
  for (const setup of [{ position: () => 'not JSON' }, { position: (s: Session, p: Position) => s.prompt.phase === 'review' ? { ...p, peerReviews: [] } : p }, { decision: (d: CouncilDecision) => ({ ...d, conflicts: [] }) }, { decision: (d: CouncilDecision) => ({ ...d, inventedField: true }) }, { status: 'incomplete' }]) {
    const f = fixture(setup); await assert.rejects(createCouncilRunner(f.dependencies)(input(), f.hooks), CouncilError);
    assert.equal(f.messages.filter(m => m.phase === 'resolution').length, 0);
  }
});

test('terminal failures, idle-only streams, stale turns and reused sessions fail closed', async () => {
  for (const outcome of ['failed', 'idle', 'wrong-turn', 'shared-session'] as const) {
    const f = fixture({ outcome }); await assert.rejects(createCouncilRunner(f.dependencies)(input(), f.hooks), CouncilError);
    assert.equal(f.synthesis.length, 0); assert.equal(f.followups.length, 0);
  }
});

test('stalled streams and unresponsive cleanup have a bounded deadline and cancel accepted work', async () => {
  const f = fixture({ outcome: 'hang', hangingCleanup: true }); const started = Date.now();
  await assert.rejects(createCouncilRunner({ ...f.dependencies, timeoutMs: 30, roundTimeoutMs: 20, cleanupTimeoutMs: 15 })(input(), f.hooks), errorCode('TIMEOUT'));
  assert.ok(Date.now() - started < 700); assert.equal(f.cancellations.length, 2); assert.equal(f.creates.length, 2);
  assert.ok(f.messages.some(m => m.text.includes('cleanup was not confirmed')));
});

test('one stream reattachment observes the same turn without resending original input', async () => {
  const f = fixture({ outcome: 'recover' }); await createCouncilRunner(f.dependencies)(input(), f.hooks);
  assert.equal(f.creates.length, 2); assert.equal(f.followups.length, 2);
  assert.equal(f.messages.filter(m => m.text.includes('Reconnected')).length, 2);
  assert.equal(f.order.filter(item => item.startsWith('input:')).length, 2);
});

test('an accepted follow-up whose POST response is lost is identified without resubmitting input', async () => {
  const f = fixture({ outcome: 'submit-interrupted' }); await createCouncilRunner(f.dependencies)(input(), f.hooks);
  assert.equal(f.creates.length, 2); assert.equal(f.followups.length, 2);
  assert.equal(f.order.filter(item => item.startsWith('input:')).length, 2);
  assert.equal(f.messages.filter(m => m.text.includes('Reconnected')).length, 2);
  assert.equal(f.synthesis.length, 1);
});

test('an unaccepted follow-up cannot reuse the previous completed proposal as its review', async () => {
  const f = fixture({ outcome: 'submit-unaccepted' });
  await assert.rejects(createCouncilRunner(f.dependencies)(input(), f.hooks), errorCode('RECOVERY_UNCONFIRMED'));
  assert.equal(f.followups.length, 0); assert.equal(f.synthesis.length, 0);
  assert.equal(f.order.filter(item => item.startsWith('input:')).length, 2);
});

test('reconciliation resends the exact cached result for a confirmed pending call without repeating search', async () => {
  const f = fixture({ outcome: 'recover-tool', actions: s => s.mentorId === 'health' && s.prompt.phase === 'proposal' ? [{ name: 'search_options', arguments: { query: 'community gym' } }] : [] });
  await createCouncilRunner(f.dependencies)(input(), f.hooks);
  assert.equal(f.searches(), 1); assert.ok(f.results.length >= 2);
  assert.equal(new Set(f.results.map(r => r.output)).size, 1);
  assert.equal(new Set(f.results.map(r => `${r.turn_id}:${r.call_id}`)).size, 1);
});

test('a turn completed during disconnection is recovered from matching persisted final output', async () => {
  const f = fixture({ outcome: 'recover-completed' }); await createCouncilRunner(f.dependencies)(input(), f.hooks);
  assert.equal(f.creates.length, 2); assert.equal(f.followups.length, 2); assert.equal(f.synthesis.length, 1);
  assert.equal(f.messages.filter(m => m.phase === 'proposal').length, 2);
});

test('missing streamed output is recovered from persisted items for the completed turn', async () => {
  const f = fixture({ outcome: 'persisted' }); await createCouncilRunner(f.dependencies)(input(), f.hooks);
  assert.equal(f.messages.filter(m => m.phase === 'resolution').length, 1);
});

test('only authorized vision mentors receive existing attachment analysis, without fabricated vision traces', async () => {
  const f = fixture(); const value = input(); value.mentors[0]!.tools.push('vision');
  value.attachment = { summary: 'Receipt text already analyzed from the uploaded image.', merchant: null, total: 15, currency: 'AED', items: [], uncertainties: ['Merchant unreadable'] };
  await createCouncilRunner(f.dependencies)(value, f.hooks);
  assert.deepEqual(JSON.parse(f.creates[0]!.input).context.attachment, value.attachment);
  assert.equal(JSON.parse(f.creates[1]!.input).context.attachment, null);
  assert.ok(!f.messages.some(m => m.phase === 'tool' && /vision|upload/.test(m.text)));
});

test('explicit meal image request plus permission makes exactly one real generation and emits its actual URL', async () => {
  const f = fixture({ actions: s => s.prompt.phase === 'proposal' ? [{ name: 'generate_meal_image', arguments: { prompt: 'A bean and rice dinner' } }] : [] });
  const value = input(); value.prompt = 'Generate an image of a vegetarian dinner meal.'; value.mentors.forEach(m => m.tools.push('image'));
  await createCouncilRunner(f.dependencies)(value, f.hooks);
  assert.equal(f.images(), 1); assert.equal(f.messages.filter(m => m.imageUrl).length, 1);
  assert.equal(f.messages.find(m => m.imageUrl)!.imageUrl, meal.url);
  assert.equal(f.messages.find(m => m.imageUrl)!.text, meal.caption);
  const result = f.results.find(r => r.success)!; assert.deepEqual(JSON.parse(result.output), { url: meal.url, caption: meal.caption, generatedAt: meal.generatedAt });
});

test('image tool is absent without both explicit user request and mentor permission, including negation', async () => {
  for (const prompt of ['Find me a healthy meal.', 'Do not generate a meal image.', 'Generate a picture of a mountain.']) {
    const f = fixture(); const value = input(); value.prompt = prompt; value.mentors[0]!.tools.push('image');
    await createCouncilRunner(f.dependencies)(value, f.hooks);
    assert.ok(f.creates.every(c => !c.agent.tools.some((t: { name: string }) => t.name === 'generate_meal_image'))); assert.equal(f.images(), 0);
  }
  const f = fixture({ actions: () => [{ name: 'generate_meal_image', arguments: { prompt: 'Dinner' } }] });
  await assert.rejects(createCouncilRunner(f.dependencies)({ ...input(), prompt: 'Generate a meal image.' }, f.hooks), errorCode('TOOL_PERMISSION'));
  assert.equal(f.images(), 0);
});

test('a failed image attempt is never retried and cannot emit a fake image URL', async () => {
  const f = fixture({ actions: s => s.mentorId === 'health' ? [{ name: 'generate_meal_image', arguments: { prompt: 'Dinner' } }] : [] });
  const value = input(); value.prompt = 'Generate a meal image.'; value.mentors[0]!.tools.push('image'); let attempts = 0;
  await createCouncilRunner({ ...f.dependencies, generateMealImage: async () => { attempts++; throw new Error('image provider failed'); } })(value, f.hooks);
  assert.equal(attempts, 1); assert.ok(!f.messages.some(m => m.imageUrl)); assert.ok(f.results.every(r => !r.success));
});


test('unrelated custom mentor goals do not inherit the wellness budget just because Health is selected', async () => {
  const f = fixture(); const value = input();
  value.prompt = 'Help plan an affordable vacation from Dubai.';
  value.profile.monthlyIncome = 6000; value.profile.essentialExpenses = 4000; value.profile.savingsTarget = 1000; value.profile.wellnessBudget = 100;
  const result = await createCouncilRunner(f.dependencies)(value, f.hooks);
  assert.equal(JSON.parse(f.creates[0]!.input).context.affordable, 1000);
  assert.ok(result.cautions.some(c => /unallocated headroom/.test(c)));
  assert.ok(!result.cautions.some(c => /Monthly wellness ceiling/.test(c)));
});
