import { mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { resolve } from 'node:path';
import { Store } from './store.js';
import { Engine, type Sender } from './engine.js';
import { aed, type Proposal } from './domain.js';
import { firstMessage, secondMessage, initialOffer, counteroffer, secondOffer, supplierPatterns } from './fixtures.js';
import { proposalBlocks } from './slack-ui.js';

const interactive = process.argv.includes('--interactive');
const rl = interactive ? createInterface({ input: stdin, output: stdout }) : undefined;
const pause = async (label: string) => { if (rl) await rl.question(`\n${label} [Enter] `); };
const store = new Store(); // An isolated reset on every run; never touch live state.
const engine = new Engine(store, { CFO: ['DEMO-CFO'], 'Procurement Director': ['DEMO-PROCUREMENT'] });
const sent: Proposal[] = [];
const sender: Sender = {
  async send(p) { sent.push(structuredClone(p)); return { messageTs: `replay-${sent.length}`, channel: 'DEMO-SUPPLIER' }; },
  async find(p) { return sent.some(s => s.id === p.id) ? { messageTs: 'replay-1', channel: 'DEMO-SUPPLIER' } : null; },
};
console.log('\nDEALGUARD  /  OFFLINE REPLAY\nSynthetic data · scripted decisions · simulated Slack delivery\nNo API key, network, live AI, or external messages used.\n');
await pause('Receive the first supplier offer');
const thread = engine.receive({ id: 'demo-event-1', channel: 'DEMO-SUPPLIER', threadTs: 'DEMO-THREAD', user: 'DEMO-SUPPLIER', text: firstMessage })!;
console.log(`SUPPLIER\n${firstMessage}\n`);
const pattern = supplierPatterns();
console.log(`EVIDENCE\n${pattern.sampleCount} synthetic historical deals: ${pattern.averageHeadlineConcessionPct}% average headline concession; ${pattern.averageSetupConcessionPct}% average setup-fee concession. Payment terms extended in ${pattern.paymentExtensions}/${pattern.sampleCount}.\n`);
engine.propose(thread.key, thread.version, {
  incomingTerms: initialOffer, proposedTerms: counteroffer,
  rationale: 'Preserve a 24-month term. Across six sample negotiations, Vertex conceded 3% on headline price and 58.33% on setup fees, with payment extensions in five. Request a modest annual reduction, waive setup, and ask for net 60. Fee waiver is a request, not a forecast of acceptance.',
  evidenceRefs: ['HIST-001', 'HIST-002', 'HIST-003', 'HIST-004', 'HIST-005', 'HIST-006', 'POLICY-001', 'BUDGET-001'],
}, 'replay');
const p = engine.finish(thread.key, thread.version);
const pendingBlocks = proposalBlocks(p);
console.log(`BUYER-ONLY REVIEW\nSupplier: ${aed(p.incomingMetrics!.annualizedCost)} annualized / ${aed(p.incomingMetrics!.totalCommitment)} total / 36 months\nCounteroffer: ${aed(p.proposedMetrics!.annualizedCost)} annualized / ${aed(p.proposedMetrics!.totalCommitment)} total / 24 months\n${aed(p.incomingMetrics!.annualizedCost - p.proposedMetrics!.annualizedCost)} lower annualized cost REQUESTED\nRequired approval: ${p.policy.roles.join(' + ')}\n`);
await pause('Approve the exact counteroffer as the demo CFO');
engine.approve(p.id, 'DEMO-CFO');
await engine.execute(p.id, sender);
console.log(`APPROVED → SIMULATED DELIVERY\n${p.text}\nReceipt: ${p.receipt!.messageTs}\n`);
engine.approve(p.id, 'DEMO-CFO');
await engine.execute(p.id, sender);
console.log(`Duplicate approval checked: ${sent.length} message sent, not two.\n`);
await pause('Receive the supplier follow-up');
const followup = engine.receive({ id: 'demo-event-2', channel: thread.channel, threadTs: thread.threadTs, user: 'DEMO-SUPPLIER', text: secondMessage })!;
const remembered = engine.context(thread.key).previousActions;
engine.propose(thread.key, followup.version, { incomingTerms: secondOffer, proposedTerms: null, rationale: `The supplier matched the price and fee terms in our previously sent counteroffer (${remembered[0]!.id}), but added a 48-month commitment. That exceeds the maximum 36-month policy. Hold for human review; no acceptance or reply will be sent.`, evidenceRefs: ['POLICY-001'] }, 'replay');
const blocked = engine.finish(thread.key, followup.version);
console.log(`SUPPLIER FOLLOW-UP\n${secondMessage}\n\nPOLICY BLOCK\n${blocked.rationale}\nRemembered actions: ${remembered.length}\nExternal messages: 0. Simulated messages: ${sent.length}.\n`);
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/replay-state.json', JSON.stringify(store.state, null, 2));
writeFileSync('artifacts/slack-blocks-preview.json', JSON.stringify({ pending: pendingBlocks, sent: proposalBlocks(p), blocked: proposalBlocks(blocked) }, null, 2));
writeFileSync('artifacts/replay-report.md', `# DealGuard offline rehearsal\n\n**Scripted replay. No live AI or Slack integration was exercised. All business records are synthetic.**\n\n## Initial offer\n\n${firstMessage}\n\n## Recommendation\n\n${p.rationale}\n\n| Metric | Supplier | Counteroffer |\n|---|---:|---:|\n| Annualized cost | ${aed(p.incomingMetrics!.annualizedCost)} | ${aed(p.proposedMetrics!.annualizedCost)} |\n| Total commitment | ${aed(p.incomingMetrics!.totalCommitment)} | ${aed(p.proposedMetrics!.totalCommitment)} |\n| Term | 36 months | 24 months |\n\n## Approved counteroffer\n\n${p.text}\n\nSimulated delivery receipt: ${p.receipt!.messageTs}. Duplicate approval produced no second send. Supplier acceptance remains unconfirmed.\n\n## Follow-up\n\n${secondMessage}\n\n${blocked.rationale}\n\n## Audit\n\n${store.state.audit.map(e => `- ${e.type}: ${e.detail}`).join('\n')}\n`);
console.log(`Replay report: ${resolve('artifacts/replay-report.md')}`);
rl?.close();
