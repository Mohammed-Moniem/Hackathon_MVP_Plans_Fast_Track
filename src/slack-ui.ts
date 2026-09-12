import type { KnownBlock } from '@slack/types';
import { aed, round, type Proposal } from './domain.js';
import { evidence } from './fixtures.js';

// Escape user/model/fixture text so it cannot introduce Slack mentions or links.
export const escapeSlack = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const section = (text: string): KnownBlock => ({ type: 'section', text: { type: 'mrkdwn', text } });
export function proposalBlocks(p: Proposal): KnownBlock[] {
  const mode = p.mode === 'live' ? 'LIVE AGENT · SAMPLE BUSINESS DATA' : 'OFFLINE REPLAY · NO LIVE AI OR SLACK';
  const title = p.status === 'blocked' ? 'Commitment blocked' : p.status === 'sent' ? 'Counteroffer delivered' : 'A better deal, with less lock-in';
  const blocks: KnownBlock[] = [
    { type: 'context', elements: [{ type: 'mrkdwn', text: `*DEALGUARD*  /  ${mode}` }] },
    { type: 'header', text: { type: 'plain_text', text: title } },
    section(`*Vertex Cloud Systems* · Infrastructure renewal\nOffer v${p.version} · Status: *${p.status.toUpperCase()}*`),
    { type: 'divider' },
    section(escapeSlack(p.rationale)),
  ];
  if (p.incomingMetrics) blocks.push(section(`*Supplier offer*\nAnnualized: *${aed(p.incomingMetrics.annualizedCost)}* · Total commitment: ${aed(p.incomingMetrics.totalCommitment)} · ${p.incomingTerms!.termMonths} months`));
  if (p.proposedMetrics && p.proposedTerms) {
    blocks.push(section(`*Proposed counteroffer*\nAnnualized: *${aed(p.proposedMetrics.annualizedCost)}* · Total commitment: ${aed(p.proposedMetrics.totalCommitment)} · ${p.proposedTerms.termMonths} months`));
    if (p.incomingMetrics) {
      const delta = round(p.incomingMetrics.annualizedCost - p.proposedMetrics.annualizedCost);
      blocks.push(section(`*${aed(Math.abs(delta))} ${delta >= 0 ? 'lower' : 'higher'} annualized cost requested*\nSupplier agreement is unconfirmed. A shorter commitment is not cash savings.`));
    }
  }
  if (p.policy.blocks.length) blocks.push(section(`*On hold — no supplier message will be sent*\n${p.policy.blocks.map(x => `• ${escapeSlack(x)}`).join('\n')}`));
  else blocks.push(section(`*Approval route*\n${p.policy.roles.map(role => `• ${role}: ${p.approvals[role] ? 'approved' : 'waiting'}`).join('\n')}\n${p.policy.reasons.map(escapeSlack).join('\n')}`));
  if (p.text && !p.policy.blocks.length) blocks.push(section(`*Exact outgoing counteroffer*\n>${escapeSlack(p.text)}`));
  if (p.receipt) blocks.push(section(`*Delivery confirmed* · Message ${escapeSlack(p.receipt.messageTs)}\nNegotiation history updated. Savings remain unconfirmed.`));
  const elements: Extract<KnownBlock, { type: 'actions' }>['elements'] = [];
  if (p.status === 'pending') elements.push(
    { type: 'button', text: { type: 'plain_text', text: 'Approve counteroffer' }, style: 'primary', action_id: 'dealguard_approve', value: p.id },
    { type: 'button', text: { type: 'plain_text', text: 'Reject' }, action_id: 'dealguard_reject', value: p.id },
  );
  if (p.status === 'uncertain') elements.push({ type: 'button', text: { type: 'plain_text', text: 'Check delivery' }, action_id: 'dealguard_reconcile', value: p.id });
  elements.push({ type: 'button', text: { type: 'plain_text', text: 'View evidence' }, action_id: 'dealguard_evidence', value: p.id });
  blocks.push({ type: 'actions', elements });
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `Buyer-only review · Proposal ${p.id} · Arithmetic and policy enforced by code` }] });
  return blocks;
}
export function evidenceBlocks(p: Proposal): KnownBlock[] {
  return [section('*Evidence behind this decision*\nFictional records used to demonstrate the workflow.'), ...p.evidenceRefs.map(ref => {
    const e = evidence.find(e => e.id === ref)!;
    return section(`*${escapeSlack(e.id)} · ${escapeSlack(e.label)}*\n${escapeSlack(e.description)}`);
  })];
}
