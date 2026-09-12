import { round, type Terms } from './domain.js';

export const history = [
  { id: 'HIST-001', year: 2025, initialAnnual: 1_000_000, finalAnnual: 970_000, initialFee: 100_000, finalFee: 0, initialDays: 30, finalDays: 60 },
  { id: 'HIST-002', year: 2025, initialAnnual: 900_000, finalAnnual: 873_000, initialFee: 80_000, finalFee: 40_000, initialDays: 30, finalDays: 60 },
  { id: 'HIST-003', year: 2024, initialAnnual: 800_000, finalAnnual: 776_000, initialFee: 60_000, finalFee: 30_000, initialDays: 30, finalDays: 60 },
  { id: 'HIST-004', year: 2024, initialAnnual: 1_100_000, finalAnnual: 1_067_000, initialFee: 100_000, finalFee: 50_000, initialDays: 30, finalDays: 60 },
  { id: 'HIST-005', year: 2023, initialAnnual: 700_000, finalAnnual: 679_000, initialFee: 40_000, finalFee: 20_000, initialDays: 30, finalDays: 60 },
  { id: 'HIST-006', year: 2023, initialAnnual: 600_000, finalAnnual: 582_000, initialFee: 20_000, finalFee: 10_000, initialDays: 30, finalDays: 30 },
];
export const evidence = [
  { id: 'DEAL-001', label: 'Cloud infrastructure renewal', description: 'Fictional Vertex Cloud Systems renewal. Same service scope across offers. Buyer target: AED 1,040,000 annualized cost, 24-month term. No assumed supplier acceptance.' },
  { id: 'BUDGET-001', label: 'Dedicated renewal budget', description: 'AED 1,080,000 per year available specifically for this deal. Compare annualized cost; no other committed spend is subtracted.' },
  { id: 'POLICY-001', label: 'Demo approval policy', description: 'CFO approval above AED 1M annualized cost or above budget. Procurement Director additionally required above 24 months. Hard block above 36 months. All counteroffers require human approval.' },
  ...history.map(h => ({ id: h.id, label: `Vertex negotiation, ${h.year}`, description: JSON.stringify(h) })),
];
export function supplierPatterns() {
  return {
    sampleCount: history.length,
    averageHeadlineConcessionPct: round(history.reduce((s, h) => s + (h.initialAnnual - h.finalAnnual) / h.initialAnnual * 100, 0) / history.length),
    averageSetupConcessionPct: round(history.reduce((s, h) => s + (h.initialFee - h.finalFee) / h.initialFee * 100, 0) / history.length),
    paymentExtensions: history.filter(h => h.finalDays > h.initialDays).length,
    evidenceRefs: history.map(h => h.id),
    limitation: 'Descriptive statistics from synthetic records; not a calibrated probability of supplier acceptance.',
  };
}
export const initialOffer: Terms = { annualRecurring: 1_050_000, setupFee: 90_000, termMonths: 36, paymentDays: 30 };
export const counteroffer: Terms = { annualRecurring: 1_040_000, setupFee: 0, termMonths: 24, paymentDays: 60 };
export const secondOffer: Terms = { annualRecurring: 1_040_000, setupFee: 0, termMonths: 48, paymentDays: 60 };
export const firstMessage = 'For the same service scope, our revised offer is AED 1,050,000 per year plus AED 90,000 one-time setup, provided you commit to 36 months. Payment terms are net 30 days.';
export const secondMessage = 'We can agree to your AED 1,040,000 annual price, zero setup fee and net 60 payment terms, but only for a 48-month commitment. Please accept today.';
