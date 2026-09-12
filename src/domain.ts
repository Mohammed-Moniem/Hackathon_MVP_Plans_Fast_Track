import { z } from 'zod';

// Whole AED in this prototype; never accept arbitrary floating-point currency inputs.
export const termsSchema = z.object({
  annualRecurring: z.number().int().min(1).max(100_000_000),
  setupFee: z.number().int().min(0).max(100_000_000),
  termMonths: z.number().int().min(1).max(120),
  paymentDays: z.number().int().min(0).max(180),
}).strict();
export type Terms = z.infer<typeof termsSchema>;
export const decisionSchema = z.object({
  incomingTerms: termsSchema.nullable(),
  proposedTerms: termsSchema.nullable(),
  rationale: z.string().min(10).max(1600),
  evidenceRefs: z.array(z.string().max(80)).min(1).max(12),
}).strict();
export type Decision = z.infer<typeof decisionSchema>;
export type Role = 'CFO' | 'Procurement Director';
export type Mode = 'live' | 'replay';
export type ProposalStatus = 'draft' | 'pending' | 'blocked' | 'rejected' | 'stale' | 'sending' | 'sent' | 'uncertain' | 'failed';
export interface Metrics { totalCommitment: number; annualizedCost: number; budgetVariance: number; budgetVariancePct: number }
export interface Policy { roles: Role[]; reasons: string[]; blocks: string[] }
export interface Message { id: string; user: string; text: string; at: string; kind: 'supplier' | 'buyer'; }
export interface Thread {
  key: string; channel: string; threadTs: string; version: number; messages: Message[];
  sessionId?: string; activeTurnId?: string;
  offerWithdrawn?: boolean;
  runStatus?: 'running' | 'complete' | 'failed';
}
export interface Proposal extends Decision {
  id: string; threadKey: string; version: number; mode: Mode; status: ProposalStatus;
  incomingMetrics: Metrics | null; proposedMetrics: Metrics | null; policy: Policy;
  text: string | null; createdAt: string; approvals: Partial<Record<Role, string>>;
  approvalMessageTs?: string; receipt?: { messageTs: string; channel: string; at: string };
}
export interface Audit { at: string; threadKey: string; type: string; detail: string; }
export interface State {
  schemaVersion: 1; threads: Record<string, Thread>; proposals: Record<string, Proposal>;
  seenEvents: string[]; audit: Audit[]; toolResults: Record<string, { success: boolean; output?: string; error?: string }>;
}

export const budget = 1_080_000;
export const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const aed = (value: number) => `AED ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}`;
export function calculate(terms: Terms): Metrics {
  const t = termsSchema.parse(terms);
  const totalCommitment = round(t.annualRecurring * t.termMonths / 12 + t.setupFee);
  const annualizedCost = round(totalCommitment * 12 / t.termMonths);
  return { totalCommitment, annualizedCost, budgetVariance: round(annualizedCost - budget), budgetVariancePct: round((annualizedCost - budget) / budget * 100) };
}
export function checkPolicy(terms: Terms): Policy {
  const t = termsSchema.parse(terms);
  const m = calculate(t);
  const roles = new Set<Role>();
  const reasons: string[] = [], blocks: string[] = [];
  if (m.annualizedCost > 1_000_000) { roles.add('CFO'); reasons.push('POL-VALUE: annualized cost exceeds AED 1,000,000.'); }
  if (m.annualizedCost > budget) { roles.add('CFO'); reasons.push('POL-BUDGET: annualized cost exceeds the AED 1,080,000 deal budget.'); }
  if (t.termMonths > 24) { roles.add('Procurement Director'); reasons.push('POL-TERM: term exceeds 24 months.'); }
  if (t.termMonths > 36) blocks.push('POL-MAX: commitments above 36 months are prohibited in this demo policy.');
  if (!roles.size) { roles.add('Procurement Director'); reasons.push('POL-REVIEW: all outgoing counteroffers require buyer approval.'); }
  return { roles: [...roles], reasons, blocks };
}
export function renderCounteroffer(t: Terms): string {
  termsSchema.parse(t);
  return `Thank you for the revised offer. We propose ${aed(t.annualRecurring)} per year, ${aed(t.setupFee)} in one-time setup fees, a ${t.termMonths}-month term, and net-${t.paymentDays} payment terms for the same service scope. Please confirm whether these terms are workable. This is a counterproposal, subject to final contract review; it is not acceptance of your offer.`;
}
