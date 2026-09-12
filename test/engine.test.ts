import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { calculate, checkPolicy, termsSchema, type Decision, type Proposal } from '../src/domain.js';
import { Store } from '../src/store.js';
import { Engine, type Sender } from '../src/engine.js';
import { initialOffer, counteroffer, secondOffer, firstMessage, supplierPatterns } from '../src/fixtures.js';
import { proposalBlocks, escapeSlack } from '../src/slack-ui.js';

const decision: Decision = { incomingTerms: initialOffer, proposedTerms: counteroffer, rationale: 'Use the supplier history to request a fee waiver and a shorter term.', evidenceRefs: ['HIST-001', 'POLICY-001'] };
function setup(store = new Store()) {
  const engine = new Engine(store, { CFO: ['cfo'], 'Procurement Director': ['procurement'] });
  const thread = engine.receive({ id: 'e1', channel: 'supplier', threadTs: 'thread', user: 'supplier-user', text: firstMessage })!;
  const sent: Proposal[] = [];
  const sender: Sender = { async send(p) { sent.push(p); return { messageTs: '123', channel: 'supplier' }; }, async find() { return null; } };
  const propose = (input = decision) => { engine.propose(thread.key, thread.version, input, 'replay'); return engine.finish(thread.key, thread.version); };
  return { engine, thread, sent, sender, propose };
}

test('correct financial basis: one-time fee is amortized over the actual term', () => {
  assert.deepEqual(calculate(initialOffer), { annualizedCost: 1080000, totalCommitment: 3240000, budgetVariance: 0, budgetVariancePct: 0 });
  assert.equal(calculate(counteroffer).totalCommitment, 2080000);
  assert.equal(calculate(initialOffer).annualizedCost - calculate(counteroffer).annualizedCost, 40000);
  assert.equal(calculate({ ...counteroffer, annualRecurring: 1142000 }).budgetVariancePct, 5.74);
});
test('thresholds have no gap and term exceptions union approvers', () => {
  assert.deepEqual(checkPolicy({ ...counteroffer, annualRecurring: 1000000 }).roles, ['Procurement Director']);
  assert.deepEqual(checkPolicy({ ...counteroffer, annualRecurring: 1000001 }).roles, ['CFO']);
  assert.deepEqual(checkPolicy(initialOffer).roles, ['CFO', 'Procurement Director']);
  assert.equal(checkPolicy({ ...counteroffer, termMonths: 36 }).blocks.length, 0);
  assert.equal(checkPolicy({ ...counteroffer, termMonths: 37 }).blocks.length, 1);
});
test('invalid currency, term, non-finite numbers and extra policy fields are rejected', () => {
  for (const patch of [{ annualRecurring: Infinity }, { setupFee: -1 }, { annualRecurring: 1.1 }, { termMonths: 0 }, { approved: true }]) assert.throws(() => termsSchema.parse({ ...counteroffer, ...patch }));
});
test('history metrics are computed from six source records', () => {
  const p = supplierPatterns();
  assert.equal(p.averageHeadlineConcessionPct, 3);
  assert.equal(p.averageSetupConcessionPct, 58.33);
  assert.equal(p.paymentExtensions, 5);
});
test('wrong approver cannot approve or reject', () => {
  const { engine, propose } = setup(); const p = propose();
  assert.throws(() => engine.approve(p.id, 'supplier-user'), /not a configured approver/);
  assert.throws(() => engine.reject(p.id, 'procurement'), /not a configured approver/);
  assert.equal(p.status, 'pending');
});
test('staged decisions cannot be approved before turn completion', () => {
  const { engine, thread } = setup(); const p = engine.propose(thread.key, 1, decision, 'live');
  assert.throws(() => engine.approve(p.id, 'cfo'), /cannot be approved/);
  engine.fail(thread.key, 1, 'Model failed after staging');
  assert.equal(p.status, 'failed');
});
test('duplicate events do not alter the offer version', () => {
  const { engine, thread } = setup();
  assert.equal(engine.receive({ id: 'e1', channel: 'supplier', threadTs: 'thread', user: 'supplier-user', text: 'Duplicate' }), null);
  assert.equal(engine.thread(thread.key).version, 1);
});
test('new supplier message invalidates old pending approval and late model output', () => {
  const { engine, propose, thread } = setup(); const p = propose();
  engine.receive({ id: 'e2', channel: 'supplier', threadTs: 'thread', user: 'supplier-user', text: 'Changed to 48 months.' });
  assert.equal(p.status, 'stale');
  assert.throws(() => engine.approve(p.id, 'cfo'), /newer supplier message/);
  assert.throws(() => engine.propose(thread.key, 1, decision, 'live'), /newer supplier message/);
});
test('both approvers are required for a long-term proposal', async () => {
  const { engine, propose, sender, sent } = setup(); const p = propose({ ...decision, proposedTerms: initialOffer });
  engine.approve(p.id, 'cfo'); await engine.execute(p.id, sender); assert.equal(sent.length, 0);
  engine.approve(p.id, 'procurement'); await engine.execute(p.id, sender); assert.equal(sent.length, 1);
});
test('previous approval by a now-removed approver cannot execute', async () => {
  const { engine, propose, sender, sent } = setup(); const p = propose();
  engine.approve(p.id, 'cfo'); engine.roles.CFO = ['replacement'];
  await engine.execute(p.id, sender); assert.equal(sent.length, 0);
});
test('an uncertain earlier send blocks execution of a later counteroffer', async () => {
  const { engine, propose, thread } = setup(); const p = propose();
  engine.approve(p.id, 'cfo');
  await engine.execute(p.id, { async send() { throw new Error('network'); }, async find() { return null; } });
  engine.receive({ id: 'e2', channel: 'supplier', threadTs: 'thread', user: 'supplier-user', text: firstMessage });
  const next = engine.propose(thread.key, 2, decision, 'replay'); engine.finish(thread.key, 2); engine.approve(next.id, 'cfo');
  await assert.rejects(engine.execute(next.id, { async send() { throw new Error('Should not send'); }, async find() { return null; } }), /earlier counteroffer/);
});
test('duplicate and concurrent approvals produce a single exact send', async () => {
  const { engine, propose, sender, sent } = setup(); const p = propose();
  engine.approve(p.id, 'cfo');
  await Promise.all([engine.execute(p.id, sender), engine.execute(p.id, sender)]);
  engine.approve(p.id, 'cfo'); await engine.execute(p.id, sender);
  assert.equal(sent.length, 1); assert.equal(sent[0]!.text, p.text); assert.equal(p.status, 'sent');
  assert.equal(engine.context(p.threadKey).previousActions.length, 1);
});
test('hard-blocked source offer cannot be bypassed with an otherwise compliant counteroffer', async () => {
  const { engine, propose, sender, sent } = setup(); const p = propose({ ...decision, incomingTerms: secondOffer });
  assert.equal(p.status, 'blocked'); assert.throws(() => engine.approve(p.id, 'cfo'));
  await assert.rejects(engine.execute(p.id, sender)); assert.equal(sent.length, 0);
});
test('missing source terms hold rather than inventing an offer', () => {
  const { propose } = setup(); const p = propose({ ...decision, incomingTerms: null, proposedTerms: null });
  assert.equal(p.status, 'blocked'); assert.equal(p.text, null);
});
test('unknown evidence is rejected', () => {
  const { propose } = setup(); assert.throws(() => propose({ ...decision, evidenceRefs: ['INVENTED'] }), /Unknown evidence/);
});
test('rejection produces no message', async () => {
  const { engine, propose, sender, sent } = setup(); const p = propose(); engine.reject(p.id, 'cfo');
  await assert.rejects(engine.execute(p.id, sender)); assert.equal(sent.length, 0);
});
test('ambiguous send cannot be retried and is reconciled only with a receipt', async () => {
  const { engine, propose } = setup(); const p = propose(); let attempts = 0;
  const sender: Sender = { async send() { attempts++; throw new Error('Connection dropped after send'); }, async find() { return null; } };
  engine.approve(p.id, 'cfo'); await engine.execute(p.id, sender);
  assert.equal(p.status, 'uncertain'); assert.equal(p.receipt, undefined);
  await assert.rejects(engine.execute(p.id, sender), /uncertain/);
  await engine.reconcile(p.id, sender); assert.equal(p.status, 'uncertain');
  sender.find = async () => ({ messageTs: 'found-123', channel: 'supplier' });
  await engine.reconcile(p.id, sender); assert.equal(p.status, 'sent'); assert.equal(attempts, 1);
});
test('restart preserves receipts and approvals; interrupted sends become uncertain', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dealguard-test-'));
  try {
    const path = join(dir, 'state.json'); const { engine, propose } = setup(new Store(path));
    const p = propose(); engine.approve(p.id, 'cfo'); p.status = 'sending'; engine.store.save();
    const restarted = new Store(path);
    assert.equal(restarted.state.proposals[p.id]!.status, 'uncertain');
    assert.equal(restarted.state.proposals[p.id]!.approvals.CFO, 'cfo');
    assert.deepEqual(restarted.state.seenEvents, ['e1']);
  } finally { rmSync(dir, { recursive: true }); }
});
test('Slack cards show source mode and controlled action states without parsing mentions', () => {
  const { propose } = setup(); const p = propose();
  const blocks = JSON.stringify(proposalBlocks(p));
  assert.match(blocks, /OFFLINE REPLAY/); assert.match(blocks, /Approve counteroffer/);
  p.status = 'blocked'; p.policy.blocks.push('Long term');
  assert.doesNotMatch(JSON.stringify(proposalBlocks(p)), /Approve counteroffer/);
  assert.equal(escapeSlack('<!channel> & <@U123>'), '&lt;!channel&gt; &amp; &lt;@U123&gt;');
});
