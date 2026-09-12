import { createHash } from 'node:crypto';
import { calculate, checkPolicy, decisionSchema, renderCounteroffer, type Decision, type Mode, type Proposal, type Role, type Thread } from './domain.js';
import { evidence, supplierPatterns } from './fixtures.js';
import { Store } from './store.js';

export interface Sender {
  send(proposal: Proposal): Promise<{ messageTs: string; channel: string }>;
  find(proposal: Proposal): Promise<{ messageTs: string; channel: string } | null>;
}
export class Engine {
  constructor(readonly store: Store, readonly roles: Record<Role, string[]>) {}
  get state() { return this.store.state; }
  receive(event: { id: string; channel: string; threadTs: string; user: string; text: string; withdrawn?: boolean }): Thread | null {
    if (this.state.seenEvents.includes(event.id)) return null;
    const key = `${event.channel}:${event.threadTs}`;
    const thread = this.state.threads[key] ??= { key, channel: event.channel, threadTs: event.threadTs, version: 0, messages: [] };
    thread.version++;
    thread.offerWithdrawn = event.withdrawn ?? false;
    thread.messages.push({ id: event.id, user: event.user, text: event.text, at: new Date().toISOString(), kind: 'supplier' });
    this.state.seenEvents.push(event.id);
    for (const p of Object.values(this.state.proposals)) {
      if (p.threadKey === key && ['draft', 'pending', 'blocked'].includes(p.status)) p.status = 'stale';
    }
    this.store.audit(key, 'supplier_message', `Received offer version ${thread.version}; older unexecuted proposals invalidated.`);
    return structuredClone(thread);
  }
  thread(key: string): Thread {
    const thread = this.state.threads[key];
    if (!thread) throw new Error('Unknown negotiation thread.');
    return thread;
  }
  assertCurrent(key: string, version: number) {
    if (this.thread(key).version !== version) throw new Error('A newer supplier message has arrived. Review the latest offer.');
  }
  context(key: string) {
    return {
      dataMode: 'Synthetic business records; current Slack messages are live when configured.',
      thread: structuredClone(this.thread(key)),
      evidence, supplierPatterns: supplierPatterns(),
      target: { annualizedCost: 1_040_000, termMonths: 24, preferredPaymentDays: 60 },
      previousActions: Object.values(this.state.proposals).filter(p => p.threadKey === key && p.status === 'sent').map(p => ({ id: p.id, terms: p.proposedTerms, exactCounteroffer: p.text, receipt: p.receipt })),
    };
  }
  propose(key: string, version: number, input: Decision, mode: Mode): Proposal {
    this.assertCurrent(key, version);
    const decision = decisionSchema.parse(input);
    const knownRefs = new Set(evidence.map(e => e.id));
    if (decision.evidenceRefs.some(ref => !knownRefs.has(ref))) throw new Error('Unknown evidence reference. Use identifiers returned by get_deal_context.');
    const id = createHash('sha256').update(`${key}:${version}`).digest('hex').slice(0, 20);
    const existing = this.state.proposals[id];
    if (existing) return existing;
    const policy = decision.proposedTerms ? checkPolicy(decision.proposedTerms) : { roles: [] as Role[], reasons: [], blocks: ['No actionable counteroffer. Human review required.'] };
    if (this.thread(key).offerWithdrawn) policy.blocks.push('The supplier deleted a message. Obtain a fresh offer before taking action.');
    if (!decision.incomingTerms) policy.blocks.push('Incoming terms are incomplete. Obtain clarification before proposing a commitment.');
    else policy.blocks.push(...checkPolicy(decision.incomingTerms).blocks.map(b => `Supplier offer: ${b}`));
    const proposal: Proposal = {
      ...decision, id, threadKey: key, version, mode, status: 'draft',
      incomingMetrics: decision.incomingTerms ? calculate(decision.incomingTerms) : null,
      proposedMetrics: decision.proposedTerms ? calculate(decision.proposedTerms) : null,
      policy, text: decision.proposedTerms ? renderCounteroffer(decision.proposedTerms) : null,
      approvals: {}, createdAt: new Date().toISOString(),
    };
    this.state.proposals[id] = proposal;
    this.store.audit(key, 'proposal_staged', `${id}: ${mode} decision, awaiting successful agent-turn completion.`);
    return proposal;
  }
  finish(key: string, version: number): Proposal {
    this.assertCurrent(key, version);
    const p = Object.values(this.state.proposals).find(p => p.threadKey === key && p.version === version);
    if (!p || p.status !== 'draft') throw new Error('Agent did not produce a fresh validated decision. No approval is available.');
    p.status = p.policy.blocks.length ? 'blocked' : 'pending';
    this.thread(key).runStatus = 'complete';
    this.store.audit(key, p.status === 'blocked' ? 'policy_block' : 'approval_requested', `${p.id}: ${p.policy.blocks.join(' ') || p.policy.roles.join(' + ')}`);
    return p;
  }
  fail(key: string, version: number, detail: string) {
    for (const p of Object.values(this.state.proposals)) if (p.threadKey === key && p.version === version && p.status === 'draft') p.status = 'failed';
    this.thread(key).runStatus = 'failed';
    this.store.audit(key, 'agent_failed', detail);
  }
  proposal(id: string): Proposal {
    const p = this.state.proposals[id];
    if (!p) throw new Error('Unknown proposal.');
    return p;
  }
  authorizedRoles(user: string, p: Proposal): Role[] {
    return p.policy.roles.filter(role => this.roles[role].includes(user));
  }
  approve(id: string, user: string): Proposal {
    const p = this.proposal(id);
    if (!this.authorizedRoles(user, p).length) throw new Error('You are not a configured approver for this proposal.');
    if (p.status === 'sent' || p.status === 'sending' || p.status === 'uncertain') return p;
    this.assertCurrent(p.threadKey, p.version);
    if (p.status !== 'pending' || !p.proposedTerms || p.policy.blocks.length) throw new Error(`Proposal cannot be approved (${p.status}).`);
    // Recompute policy on the exact stored payload, never accept client-supplied terms.
    const policy = checkPolicy(p.proposedTerms);
    if (policy.blocks.length || JSON.stringify(policy.roles) !== JSON.stringify(p.policy.roles)) throw new Error('Policy changed; a new proposal is required.');
    for (const role of this.authorizedRoles(user, p)) p.approvals[role] = user;
    this.store.audit(p.threadKey, 'approval_recorded', `${user} approved stored proposal ${p.id}.`);
    return p;
  }
  reject(id: string, user: string) {
    const p = this.proposal(id);
    if (!this.authorizedRoles(user, p).length) throw new Error('You are not a configured approver for this proposal.');
    this.assertCurrent(p.threadKey, p.version);
    if (p.status !== 'pending') throw new Error(`Proposal cannot be rejected (${p.status}).`);
    p.status = 'rejected';
    this.store.audit(p.threadKey, 'proposal_rejected', `${user} rejected ${id}. No supplier message sent.`);
    return p;
  }
  async execute(id: string, sender: Sender): Promise<Proposal> {
    const p = this.proposal(id);
    if (p.status === 'sent' || p.status === 'sending') return p;
    if (p.status === 'uncertain') throw new Error('Delivery is uncertain. Reconcile before any further action; automatic retry is disabled.');
    this.assertCurrent(p.threadKey, p.version);
    if (p.status !== 'pending' || !p.text || p.policy.blocks.length) throw new Error('This proposal is not executable.');
    if (!p.policy.roles.every(role => this.roles[role].includes(p.approvals[role] ?? ''))) return p;
    if (Object.values(this.state.proposals).some(other => other.threadKey === p.threadKey && other.id !== p.id && ['uncertain', 'sending'].includes(other.status))) {
      throw new Error('An earlier counteroffer has unconfirmed delivery. Reconcile it before sending another.');
    }
    // Persist intent before crossing the external boundary. Single process prevents parallel sends.
    p.status = 'sending';
    this.store.audit(p.threadKey, 'send_started', `Sending exact approved proposal ${id}.`);
    try {
      const receipt = await sender.send(p);
      this.recordSent(p, receipt);
    } catch {
      p.status = 'uncertain';
      this.store.audit(p.threadKey, 'delivery_uncertain', `${id}: no confirmed receipt. Reconcile in Slack; do not resend automatically.`);
    }
    return p;
  }
  async reconcile(id: string, sender: Sender): Promise<Proposal> {
    const p = this.proposal(id);
    if (p.status !== 'uncertain') return p;
    const receipt = await sender.find(p);
    if (receipt) this.recordSent(p, receipt);
    else this.store.audit(p.threadKey, 'reconciliation_pending', `${id}: no receipt found. Remains uncertain; no resend attempted.`);
    return p;
  }
  private recordSent(p: Proposal, receipt: { messageTs: string; channel: string }) {
    const thread = this.thread(p.threadKey);
    if (receipt.channel !== thread.channel || !receipt.messageTs) throw new Error('Invalid delivery receipt.');
    p.status = 'sent';
    p.receipt = { ...receipt, at: new Date().toISOString() };
    thread.messages.push({ id: receipt.messageTs, user: 'DealGuard', text: p.text!, at: p.receipt.at, kind: 'buyer' });
    this.store.audit(p.threadKey, 'counteroffer_sent', `${p.id}: ${p.mode === 'live' ? 'confirmed Slack' : 'simulated'} receipt ${receipt.messageTs}. Requested terms recorded; supplier acceptance remains unconfirmed.`);
  }
}
