# DealGuard 2.0 — Hackathon MVP Plan

## 1. Goal

Build a **demoable autonomous commercial negotiation agent** that lives inside a business communication channel, understands the full commercial context of an active supplier negotiation, recommends the next move, routes the decision to the correct human approver, executes the approved response, and updates deal state and memory.

The MVP must be fully demoable by end of day and must **not depend on real Slack, Gmail, CRM, ERP, procurement, or finance integrations**. All external systems are represented by realistic mock adapters and data fixtures.

The product must feel like an agent, not a chatbot.

**Hackathon implementation rule:** choose the shortest technical path that makes the agentic behavior undeniable. Architecture sophistication that is invisible to judges is explicitly deprioritized.

Core loop:

> Incoming supplier message → context aggregation → commercial analysis → strategy generation → policy check → approval routing → approved action → deal state update → memory update

---

# 2. Hackathon positioning

## Problem

Commercial negotiations are fragmented across email, Slack/Teams, CRM, spreadsheets, procurement systems, finance rules, contracts, and historical supplier relationships. Humans often negotiate without seeing the full context.

## Product promise

**DealGuard is an autonomous commercial intelligence agent that protects margin, budget, and negotiating leverage by continuously understanding the deal and acting at the right moment.**

## Why this is not “ChatGPT writing a counteroffer”

DealGuard:

- reacts to events without waiting for a prompt;
- understands multi-source commercial context;
- computes deterministic financial metrics before LLM reasoning;
- recalls supplier-specific concession behavior;
- checks company policy before recommending action;
- chooses the correct approval path;
- pauses for human approval when required;
- executes the approved response;
- updates CRM/deal state and negotiation memory;
- shows evidence and provenance for every recommendation.

---

# 3. MVP scope

## Must work in the demo

1. A supplier sends a new offer in a Slack-style or Gmail-style mock channel.
2. DealGuard automatically detects the event.
3. The agent loads all relevant deal context into a unified Context Hub.
4. Deterministic analytics calculate:
   - effective annual cost;
   - savings/gap vs target;
   - variance vs budget;
   - historical supplier concession pattern;
   - comparable deal range;
   - supplier delivery/risk score;
   - approval threshold.
5. The LLM produces three negotiation strategies.
6. DealGuard selects a recommended strategy and explains why.
7. Policy engine determines whether approval is required and who must approve.
8. Recommendation is routed to the correct approval inbox.
9. Approver accepts, edits, or rejects.
10. If accepted, DealGuard sends the simulated counteroffer into the supplier thread.
11. CRM/deal state is updated.
12. Negotiation memory is updated.
13. The UI shows an auditable activity timeline.

## Explicitly out of scope for today

- OAuth to Slack/Gmail.
- Real Salesforce/HubSpot/SAP/Ariba/Coupa integrations.
- Real financial transactions.
- Contract signing.
- Production authentication.
- Multi-tenant billing.
- Sophisticated RBAC.
- Production-grade event infrastructure.

---

# 4. Demo-first architecture

```text
┌──────────────────────────┐
│ Mock Channel UI          │
│ Slack / Gmail selector   │
└─────────────┬────────────┘
              │ incoming event
              ▼
┌──────────────────────────┐
│ Event Adapter            │
│ normalizes all channels  │
└─────────────┬────────────┘
              ▼
┌──────────────────────────┐
│ Deal Context Hub         │
│ aggregates all mock data │
└─────────────┬────────────┘
              ▼
┌──────────────────────────┐
│ Metrics Engine           │
│ deterministic analytics  │
└─────────────┬────────────┘
              ▼
┌──────────────────────────┐
│ DealGuard Agent          │
│ reasoning + strategy     │
└─────────────┬────────────┘
              ▼
┌──────────────────────────┐
│ Policy / Approval Engine │
└─────────────┬────────────┘
              ▼
┌──────────────────────────┐
│ Approval Inbox           │
│ CFO / Procurement / VP   │
└─────────────┬────────────┘
              │ approve/edit/reject
              ▼
┌──────────────────────────┐
│ Action Executor          │
│ send/update/memorize     │
└─────────────┬────────────┘
              ▼
┌──────────────────────────┐
│ Activity + Evidence UI   │
└──────────────────────────┘
```

---

# 4A. Fastest-track architecture decision

The architecture must optimize for **hackathon speed, demo reliability, and visible agent behavior**, not production sophistication.

## Architecture principle

Build DealGuard as **one TypeScript full-stack application**. Do not create microservices, queues, separate workers, vector databases, or real enterprise integrations for the MVP.

```text
Browser
  ↓
Next.js app
  ├─ React UI
  ├─ Route handlers / server actions
  ├─ DealGuard orchestrator
  ├─ deterministic metrics + policy functions
  ├─ mock adapters
  └─ local scenario state
       ↓
OpenAI structured-output call
```

The important architectural boundary is **adapter → normalized context → deterministic calculations → agent decision → approval → action mutation**. Keep those interfaces clean so a future Slack/Gmail/CRM integration can replace the mocks without changing the agent flow.

## Fastest viable stack

```text
Language: TypeScript end to end
Framework: Next.js App Router
UI: React + Tailwind CSS
Components: shadcn/ui only where it saves time
Validation/contracts: Zod
LLM: OpenAI SDK, one structured-output/tool-capable model call for the main decision
Persistence: local JSON fixtures + in-memory mutable scenario state
Charts: none unless a single simple card/bar materially helps the demo
Testing: Vitest or lightweight unit tests only for metrics/policy functions
Deployment: local laptop first; optional Vercel only after demo is stable
```

### Why this stack

- one repo and one dev server;
- no API contract duplication between frontend and backend;
- TypeScript types can be reused across UI, tools, fixtures, and LLM output schemas;
- JSON fixtures are the fastest way to represent CRM, supplier history, policies, and negotiation threads;
- local mutable state makes approval and action effects instantly visible;
- Zod gives runtime validation and LLM output validation with minimal code;
- the demo remains fully functional even if every external integration is mocked.

## Deliberate non-choices

Do **not** add these today unless the team already has a ready-made template:

- NestJS/Express as a separate backend;
- PostgreSQL/MongoDB;
- Redis;
- Kafka/RabbitMQ;
- LangChain/LangGraph or another agent framework;
- vector DB / embeddings / RAG infrastructure;
- OAuth;
- real Slack/Gmail/Salesforce/Coupa/SAP integrations;
- Kubernetes/Docker orchestration;
- production auth/RBAC.

None of these improve the judging moment enough to justify the implementation time.

## Single-orchestrator design

Avoid building a generic autonomous-agent runtime. Use one explicit orchestration function:

```ts
async function runDealGuard(trigger: SupplierMessageEvent) {
  const context = await buildDealContext(trigger.dealId)
  const metrics = calculateDealMetrics(context)
  const decision = await generateDealDecision({ context, metrics })
  const approval = determineApprovalRoute(decision, context.policies)

  return createApprovalProposal({ decision, approval, metrics })
}
```

After approval:

```ts
async function approveDealGuardProposal(proposalId: string) {
  const proposal = getProposal(proposalId)
  sendMockCounteroffer(proposal)
  updateMockDeal(proposal)
  writeMockNegotiationMemory(proposal)
  appendAuditEvents(proposal)
}
```

This is enough to demonstrate agency while keeping the implementation deterministic and easy to debug.

## LLM call budget

For the hero flow, target **one main LLM call** after the deterministic metrics are prepared. A second call is acceptable only if needed to polish the outgoing counteroffer.

Do not make the LLM fetch every data source through ten sequential tool calls during the live demo. The application should aggregate mock data first, then provide a compact structured context to the model. This dramatically reduces latency and demo failure risk while preserving the conceptual tool architecture in the code.

## Demo-event implementation

The incoming supplier event should be simulated by a button or timed scenario trigger:

```text
Trigger Supplier Offer
  → POST /api/scenarios/DG-001/trigger
  → runDealGuard()
  → proposal returned
  → UI moves to approval state
```

The UI may animate steps such as “reading CRM” and “checking supplier history,” but the underlying execution can be a single server request. The visible steps should correspond to real calculations/data reads, not arbitrary fake messages.

## State strategy

For the hackathon:

```text
Immutable source data      → /fixtures/dealguard/*.json
Mutable current scenario   → server memory or one state.json file
Scenario reset             → deep-clone fixture seed into current state
```

If the demo runs locally, this is enough. Only introduce SQLite if the team already has a helper/template and wants safer persistence across server restarts.

## Performance target

From trigger to approval card:

- deterministic aggregation/calculation: < 300 ms;
- LLM decision: ideally < 3–5 seconds;
- total perceived flow: < 6 seconds;
- approval mutation: effectively immediate.

Use progressive UI states so the latency feels intentional.

## Fastest architecture that still proves the idea

The judges need to see:

1. an event arrives without a chat prompt;
2. multiple commercial data sources matter;
3. real calculations happen;
4. the agent makes a non-obvious recommendation;
5. policy decides the approval path;
6. a human approves;
7. the system takes a visible action and remembers it.

Everything else is optional architecture.

---

# 5. Frontend screens

## Screen A — Deal Workspace

Left column:

- active deals;
- supplier name;
- deal value;
- current stage;
- urgency/status badge.

Center:

- Slack-style or Gmail-style thread;
- incoming supplier messages;
- outgoing DealGuard messages;
- event timestamps.

Right panel:

- current offer;
- target price;
- budget;
- effective annual cost;
- savings opportunity;
- historical concession pattern;
- supplier performance score;
- risk flags;
- comparable market range;
- recommended strategy;
- approval route;
- evidence/source drawer.

## Screen B — Approval Inbox

Role switcher:

- Procurement Lead;
- CFO;
- Business Owner.

Approval card contains:

- deal summary;
- proposed counteroffer;
- financial impact;
- risk level;
- policy rule that triggered approval;
- DealGuard rationale;
- source evidence;
- Approve;
- Edit & Approve;
- Reject.

## Screen C — Deal Memory / Audit

Timeline:

- supplier offer received;
- context loaded;
- analytics computed;
- strategy generated;
- approval routed;
- approval decision;
- response sent;
- deal state updated;
- memory recorded.

## Screen D — Demo Control Panel

Hidden or judge-friendly panel:

- scenario selector;
- Reset Scenario;
- Trigger Supplier Message;
- simulate failure;
- switch Slack/Gmail shell;
- role switcher.

---

# 6. Entry points

The MVP should support three conceptual entry points through one normalized event contract.

### A. Slack-like message

```json
{
  "source": "slack",
  "type": "supplier_message",
  "dealId": "DEAL-001",
  "threadId": "THREAD-001",
  "sender": "supplier@vertexcloud.example",
  "message": "We can reduce the unit price to AED 860 if you commit to 36 months.",
  "timestamp": "2026-09-12T10:10:00+04:00"
}
```

### B. Gmail-like email

Same semantic event, different adapter.

```json
{
  "source": "gmail",
  "type": "supplier_message",
  "dealId": "DEAL-001",
  "threadId": "EMAIL-001",
  "sender": "sales@vertexcloud.example",
  "subject": "Revised commercial proposal",
  "message": "We can reduce the unit price to AED 860 if you commit to 36 months.",
  "timestamp": "2026-09-12T10:10:00+04:00"
}
```

### C. Manual deal trigger

Used only as a fallback demo trigger.

---

# 7. Unified Context Hub

All source data is normalized into one object before agent reasoning.

```ts
interface DealContext {
  deal: DealRecord
  supplier: SupplierProfile
  conversation: Array<ConversationMessage>
  supplierHistory: Array<HistoricalDeal>
  comparables: Array<ComparableContract>
  quotes: Array<CompetitiveQuote>
  budget: BudgetContext
  finance: FinanceContext
  policies: Array<CommercialPolicy>
  approvalMatrix: Array<ApprovalRule>
  supplierPerformance: SupplierPerformance
  negotiationMemory: Array<NegotiationMemory>
  derivedMetrics: DealMetrics
}
```

The LLM never receives raw disconnected fixtures. It receives this normalized, curated context.

---

# 8. Mock data required

The data must be intentionally rich enough to produce non-obvious insights.

## 8.1 CRM / Deal record

Create 3 demo deals; only one needs full polish.

Fields:

```json
{
  "dealId": "DEAL-001",
  "title": "Cloud Infrastructure Renewal",
  "supplierId": "SUP-001",
  "owner": "Mo",
  "businessUnit": "Digital Banking",
  "stage": "Commercial Negotiation",
  "currency": "AED",
  "estimatedAnnualValue": 1200000,
  "targetAnnualValue": 1000000,
  "maxApprovedAnnualValue": 1100000,
  "currentOfferAnnualValue": 1170000,
  "contractTermMonths": 36,
  "targetTermMonths": 24,
  "renewalDeadline": "2026-09-30",
  "strategicImportance": "high"
}
```

Visible demo use:

- deal header;
- target vs current offer;
- urgency;
- policy routing.

---

## 8.2 Negotiation thread

Create **20–30 messages** covering:

- original supplier proposal;
- buyer pushback;
- supplier justification;
- pricing concession;
- term-length tradeoff;
- implementation fee discussion;
- support SLA discussion;
- latest supplier offer.

Important hidden pattern:

> Supplier historically protects headline price but gives concessions on implementation fees, payment terms, and term length.

This gives DealGuard something meaningful to discover.

Fields:

```json
{
  "messageId": "MSG-019",
  "threadId": "THREAD-001",
  "senderType": "supplier",
  "senderName": "Sarah Lee",
  "timestamp": "2026-09-12T10:10:00+04:00",
  "message": "We can reduce the unit price to AED 860 if you commit to 36 months.",
  "attachments": [],
  "channel": "slack"
}
```

---

## 8.3 Supplier profile

```json
{
  "supplierId": "SUP-001",
  "name": "Vertex Cloud Systems",
  "category": "Cloud Infrastructure",
  "relationshipYears": 5,
  "criticality": "high",
  "switchingCost": "medium",
  "preferredSupplier": true,
  "riskRating": "medium"
}
```

---

## 8.4 Historical supplier deals

Create **8 historical deals**.

Fields:

```json
{
  "historicalDealId": "HIST-001",
  "supplierId": "SUP-001",
  "year": 2025,
  "initialOffer": 940000,
  "finalValue": 865000,
  "headlinePriceConcessionPct": 3.0,
  "implementationFeeConcessionPct": 35,
  "paymentTermsStartDays": 30,
  "paymentTermsFinalDays": 60,
  "initialTermMonths": 36,
  "finalTermMonths": 24,
  "negotiationRounds": 4,
  "outcome": "won"
}
```

Derived insight to surface:

> “Across the last 6 comparable negotiations, Vertex conceded an average of only 3.2% on headline price but 31% on implementation fees and extended payment terms in 5/6 cases.”

Compute this in code.

---

## 8.5 Comparable contracts

Create **10–20 comparable contracts** from fictional market peers.

Fields:

- vendor category;
- company size band;
- annual value;
- contract term;
- SLA tier;
- unit price;
- implementation fee;
- payment terms;
- date.

Demo insight:

> Current supplier offer is 9.4% above the median comparable effective annual cost.

---

## 8.6 Competitive quotes

Create **3 quotes**.

```json
{
  "vendor": "Nimbus Systems",
  "annualValue": 1020000,
  "implementationFee": 50000,
  "contractTermMonths": 24,
  "paymentTermsDays": 45,
  "migrationRisk": "high"
}
```

Used to calculate BATNA / walk-away leverage.

---

## 8.7 Budget context

```json
{
  "budgetOwner": "Infrastructure",
  "approvedBudget": 1080000,
  "committedSpend": 120000,
  "remainingBudget": 960000,
  "contingencyAvailable": 50000
}
```

---

## 8.8 Finance assumptions

Fields:

- discount rate;
- inflation assumption;
- FX exposure;
- payment timing;
- implementation capitalization treatment.

For demo, keep calculations understandable.

---

## 8.9 Commercial policies

Example fixtures:

```json
[
  {
    "policyId": "POL-001",
    "name": "Budget Variance Approval",
    "condition": "effectiveAnnualCost > approvedBudget",
    "action": "CFO_APPROVAL"
  },
  {
    "policyId": "POL-002",
    "name": "Long-Term Commitment Approval",
    "condition": "contractTermMonths > 24",
    "action": "PROCUREMENT_DIRECTOR_APPROVAL"
  }
]
```

---

## 8.10 Approval matrix

```json
[
  {
    "ruleId": "APR-001",
    "minValue": 0,
    "maxValue": 500000,
    "requiredRole": "Procurement Lead"
  },
  {
    "ruleId": "APR-002",
    "minValue": 500001,
    "maxValue": 1000000,
    "requiredRole": "Procurement Director"
  },
  {
    "ruleId": "APR-003",
    "minValue": 1000001,
    "maxValue": null,
    "requiredRole": "CFO"
  }
]
```

---

## 8.11 Supplier performance

Fields:

- on-time delivery %;
- SLA breaches;
- severity-1 incidents;
- average support response;
- invoice disputes;
- security findings;
- business satisfaction;
- renewal recommendation.

This influences risk-adjusted negotiation strategy.

---

## 8.12 Negotiation memory

Persistent-looking memory fixture:

```json
{
  "memoryId": "MEM-003",
  "supplierId": "SUP-001",
  "type": "concession_pattern",
  "observation": "Supplier resists unit-price cuts but frequently waives implementation fees late in negotiations.",
  "confidence": 0.91,
  "evidenceDealIds": ["HIST-001", "HIST-003", "HIST-006"]
}
```

---

# 9. Deterministic metrics engine

Do not ask the LLM to calculate these.

Implement functions for:

```ts
calculateEffectiveAnnualCost()
calculateBudgetVariance()
calculateSavingsVsCurrentOffer()
calculateSavingsVsTarget()
calculateComparablePercentile()
calculateSupplierConcessionPatterns()
calculateSupplierPerformanceScore()
calculateBATNAScore()
calculateNegotiationLeverageScore()
calculateApprovalRoute()
```

Example metrics result:

```json
{
  "effectiveAnnualCost": 1142000,
  "budgetVariance": 82000,
  "variancePct": 7.74,
  "marketMedian": 1044000,
  "premiumVsMarketPct": 9.39,
  "supplierPerformanceScore": 82,
  "leverageScore": 74,
  "requiredApprovalRole": "CFO"
}
```

---

# 10. Agent tool map

The agent should reason through explicit tools.

## Read tools

```text
get_deal(dealId)
get_conversation(threadId)
get_supplier_profile(supplierId)
get_supplier_history(supplierId)
get_comparable_contracts(category)
get_competitive_quotes(dealId)
get_budget_context(dealId)
get_finance_context(dealId)
get_commercial_policies()
get_approval_matrix()
get_supplier_performance(supplierId)
get_negotiation_memory(supplierId)
get_derived_metrics(dealId)
```

## Decision tools

```text
analyze_offer(dealId)
generate_strategies(dealId)
check_policy(strategyId)
determine_approval_route(strategyId)
```

## Action tools

```text
request_approval(approvalPayload)
send_counteroffer(threadId, message)
update_deal(dealId, patch)
write_negotiation_memory(memory)
append_audit_event(event)
```

The action tools should mutate local state so judges can see visible consequences.

---

# 11. Agent output contract

Force structured output.

```ts
interface DealGuardDecision {
  situationSummary: string
  keyInsights: Array<{
    insight: string
    evidenceRefs: Array<string>
  }>
  strategies: Array<{
    id: string
    name: string
    description: string
    proposedAnnualValue: number
    requestedTermMonths: number
    implementationFeeAction: string
    paymentTermsDays: number
    expectedSavings: number
    risk: 'low' | 'medium' | 'high'
    expectedSuccessProbability: number
  }>
  recommendedStrategyId: string
  recommendationReason: string
  approvalRequired: boolean
  approvalRole: string | null
  draftedResponse: string
}
```

---

# 12. Recommended demo scenario

## Scenario: “The supplier thinks we only care about price”

### Setup

- Current annual offer: AED 1.17M.
- Target: AED 1.00M.
- Budget ceiling: AED 1.08M.
- Supplier offers a price cut only if buyer accepts 36 months.
- Comparable market median: ~AED 1.044M effective annual cost.
- Historical pattern shows supplier rarely cuts headline price much further.
- Historical pattern shows supplier frequently waives implementation fees and improves payment terms.
- 36-month commitment violates policy without approval.

### Agent conclusion

DealGuard recommends:

- keep contract term at 24 months;
- accept only a modest unit-price movement;
- request full implementation-fee waiver;
- request 60-day payment terms;
- add SLA credit improvement;
- keep a competitor quote as credible BATNA.

This is far more interesting than “counter at AED X.”

---

# 13. Approval routing logic

The user should not manually guess where the output goes.

The agent determines the route from policies and approval matrix.

Example:

```text
Proposed commitment = AED 1.06M/year
Term = 24 months
Budget variance = -1.8%

→ Procurement Director approval only
```

Alternative scenario:

```text
Proposed commitment = AED 1.12M/year
Term = 36 months

→ CFO + Procurement Director approval
```

UI should show:

> “Routing to CFO because proposed annual commitment exceeds AED 1M and to Procurement Director because term exceeds 24 months.”

---

# 14. Evidence and provenance

Every important insight must be clickable.

Example:

> **Insight:** Vertex is more flexible on implementation fees than headline price.

Evidence drawer:

- HIST-001: 40% fee concession;
- HIST-003: 25% fee concession;
- HIST-006: full waiver;
- average headline price concession: 3.2%.

This is critical for trust and makes the demo feel data-rich.

---

# 15. Failure / recovery path

Have one controlled failure to prove the agent is robust.

Recommended failure:

The supplier sends:

> “We can accept AED 1.05M, but only if the contract is 48 months.”

Agent detects a policy violation and does **not** automatically send acceptance.

It responds internally:

> “Commercial target is met, but 48-month term violates maximum commitment policy. Escalating rather than executing.”

This demonstrates autonomy plus control.

---

# 16. Scenario manifests

Use resettable fixtures.

```text
/scenarios
  /dealguard
    scenario-01-standard.json
    scenario-02-policy-conflict.json
    scenario-03-supplier-risk.json
```

Each scenario manifest should define:

```json
{
  "scenarioId": "DG-001",
  "name": "Term vs Price Tradeoff",
  "initialState": {},
  "triggerEvent": {},
  "expectedInsights": [],
  "expectedApprovalRoute": ["CFO"],
  "expectedFinalState": {}
}
```

Reset = reload fixture state into memory/database.

---

# 17. Technical implementation — fastest track

This section is the implementation contract for Codex/the build team.

## Mandatory implementation shape

Use a **single Next.js TypeScript application**. The browser, mock adapters, agent orchestration, metrics engine, approval logic, and scenario mutations all live in the same project.

```text
Next.js
├─ app/                         UI + route handlers
├─ components/                  demo components
├─ lib/
│  ├─ dealguard/
│  │  ├─ orchestrator.ts
│  │  ├─ context.ts
│  │  ├─ metrics.ts
│  │  ├─ policy.ts
│  │  ├─ llm.ts
│  │  └─ actions.ts
│  ├─ repositories/             thin fixture/state access
│  └─ schemas/                  Zod + TypeScript contracts
├─ fixtures/dealguard/          immutable realistic data
└─ scenarios/dealguard/         reset manifests
```

## Minimal packages

Prefer the smallest dependency surface possible:

```text
next
react
zod
openai
(optional) shadcn/ui dependencies already used by the scaffold
(optional) date-fns
```

Avoid adding a library when 20–30 lines of plain TypeScript can do the job.

## Implementation order by value

### P0 — must exist

1. seed/reset scenario;
2. deal workspace UI;
3. context aggregator;
4. deterministic metrics functions;
5. one LLM structured decision call;
6. policy/approval routing;
7. approval button;
8. visible thread/deal/memory mutation.

### P1 — high-value polish

9. evidence drawer;
10. activity timeline;
11. Edit & Approve;
12. controlled failure scenario.

### P2 — cut first

13. Gmail/Slack shell switcher;
14. extra deals;
15. charts;
16. multiple agent personas;
17. real integrations.

## Mock adapter pattern

Define interfaces matching future integrations, but implement only local mocks:

```ts
interface ChannelAdapter {
  getThread(threadId: string): Promise<Array<ConversationMessage>>
  sendMessage(threadId: string, message: string): Promise<void>
}

interface CrmAdapter {
  getDeal(dealId: string): Promise<DealRecord>
  updateDeal(dealId: string, patch: Partial<DealRecord>): Promise<void>
}
```

For the hackathon:

```ts
const channelAdapter = new MockChannelAdapter(fixtures)
const crmAdapter = new MockCrmAdapter(scenarioState)
```

That gives the demo a credible integration architecture without spending hours on OAuth/API work.

## Agent implementation

The agent receives one curated payload:

```ts
const input = {
  deal: context.deal,
  latestOffer: context.latestOffer,
  metrics,
  supplierPattern: context.supplierPattern,
  comparablesSummary: context.comparablesSummary,
  batna: context.batna,
  policyConstraints: context.policyConstraints,
}
```

Ask the model for a Zod-validated `DealGuardDecision`. Retry once on schema failure; otherwise fall back to a precomputed safe scenario decision so the live demo cannot die because of formatting.

## Determinism strategy

The **numbers** must always be deterministic. The LLM is responsible for:

- strategy synthesis;
- ranking tradeoffs;
- explanation;
- response wording.

The LLM is **not** responsible for:

- arithmetic;
- budget thresholds;
- approval role selection;
- historical averages;
- comparable percentiles;
- policy enforcement.

This both improves credibility and shortens prompts.

## Demo-safe fallback

Keep a scenario-specific fallback decision in code. Use it only when the LLM times out/errors.

```ts
try {
  return await generateDealDecision(input)
} catch {
  return getFallbackDecision('DG-001')
}
```

The fallback should be visually indistinguishable from the normal flow but the team should still aim to run the live model in the demo.

## Optional real integration stretch goal

Only after the hero flow is stable, add **one** real channel integration if it takes less than ~30–45 minutes. Slack webhook/incoming message simulation is preferable to full Gmail OAuth. A real integration is a bonus, not a dependency.

## Technical success criterion

The implementation is technically sufficient when a judge can trigger the scenario, watch the agent produce a data-backed recommendation, approve it, and immediately see the mock business systems change. Production infrastructure adds no score if this loop is weaker.

---

# 18. Suggested repository structure

```text
/apps/web
  /app
  /components
  /lib

/src
  /agents/dealguard
    agent.ts
    prompts.ts
    schemas.ts
  /tools
    deal.tools.ts
    supplier.tools.ts
    analytics.tools.ts
    approval.tools.ts
    action.tools.ts
  /services
    context-hub.ts
    metrics-engine.ts
    policy-engine.ts
    scenario-engine.ts
  /repositories
    deal.repository.ts
    supplier.repository.ts
    audit.repository.ts
  /fixtures
    /dealguard
      deals.json
      suppliers.json
      messages.json
      history.json
      comparables.json
      quotes.json
      budgets.json
      policies.json
      approval-matrix.json
      performance.json
      memories.json
  /scenarios
```

---

# 19. Minimal API surface

```text
POST /api/scenarios/:id/reset
POST /api/scenarios/:id/trigger
GET  /api/deals/:id
GET  /api/deals/:id/context
GET  /api/deals/:id/analysis
POST /api/deals/:id/run-agent
GET  /api/approvals
POST /api/approvals/:id/approve
POST /api/approvals/:id/reject
POST /api/approvals/:id/edit-approve
GET  /api/audit/:dealId
```

---

# 20. End-of-day build sequence

## Phase 1 — Foundation

- scaffold UI;
- create scenario engine;
- create fixture data;
- build deal/thread screen;
- build Context Hub.

## Phase 2 — Intelligence

- build metrics engine;
- implement policy routing;
- create agent structured-output schema;
- connect tool calls.

## Phase 3 — Action

- build approval inbox;
- implement approve/edit/reject;
- simulate response sending;
- update deal state;
- write memory and audit events.

## Phase 4 — Demo polish

- evidence drawer;
- loading/progress states;
- scenario reset;
- failure path;
- deterministic demo wording where necessary;
- rehearse.

---

# 21. Team split

For 4 people:

### Person 1 — UI / demo shell

- deal workspace;
- thread;
- side panel;
- approval inbox.

### Person 2 — Data / analytics

- fixtures;
- context normalization;
- metrics engine;
- evidence mapping.

### Person 3 — Agent / orchestration

- tool calling;
- prompt;
- structured output;
- policy and routing.

### Person 4 — Actions / integration / polish

- scenario engine;
- state mutation;
- audit timeline;
- reset;
- testing and demo script.

---

# 22. 90-second demo script

### 0–10 sec — Problem

“Negotiators rarely have CRM history, budget, supplier behavior, policy, market benchmarks and approval rules in one place.”

### 10–20 sec — Trigger

Supplier sends:

> “AED 860 per unit if you sign for 36 months.”

No one prompts DealGuard.

### 20–40 sec — Agent works

Show activity stream:

```text
✓ Loaded active deal
✓ Read 24 negotiation messages
✓ Compared 8 historical supplier deals
✓ Benchmarked 14 comparable contracts
✓ Checked 3 competitive quotes
✓ Calculated effective annual cost
✓ Checked commercial policy
```

### 40–55 sec — Insight

DealGuard surfaces:

> “Do not trade a 36-month lock-in for this price reduction. Vertex historically gives more value through implementation-fee waivers and payment terms.”

Show evidence.

### 55–70 sec — Strategy + approval

Show proposed counteroffer and financial impact.

DealGuard routes to CFO/Procurement based on policy.

Approver clicks **Approve**.

### 70–82 sec — Action

DealGuard posts the counteroffer into the thread and updates the deal.

### 82–90 sec — Close

Show memory/audit:

> “Next negotiation with this supplier starts smarter than the last one.”

---

# 23. Definition of done

The DealGuard demo is ready when:

- [ ] supplier trigger starts without typing a prompt;
- [ ] at least 8 distinct mock data sources are visibly used;
- [ ] metrics are computed in code;
- [ ] the agent generates 3 strategies;
- [ ] recommendation includes evidence;
- [ ] policy engine routes to an approver;
- [ ] approval changes system state;
- [ ] simulated message is sent;
- [ ] CRM/deal state visibly changes;
- [ ] negotiation memory visibly changes;
- [ ] scenario can reset in one click;
- [ ] one failure/recovery path works;
- [ ] entire demo completes reliably in < 90 seconds.

---

# 24. Do not compromise these items

If time becomes tight, cut visual polish before cutting:

1. proactive trigger;
2. multi-source context;
3. deterministic metrics;
4. evidence/provenance;
5. approval routing;
6. visible action after approval;
7. persistent-looking memory.

Those seven elements are what make DealGuard feel like an autonomous commercial agent rather than a chat wrapper.
