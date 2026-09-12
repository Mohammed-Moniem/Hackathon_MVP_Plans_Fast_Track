# DealGuard: two-hour build brief

**Superseded:** The user subsequently selected MentorOS with coaches, voice, generated imagery, and Exa search. Use `MENTOROS_TWO_HOUR_BUILD_BRIEF.md` for the current proposed scope. This DealGuard review is retained as history.

Prepared 12 September 2026 after reviewing the two source plans, the existing prototype, the live event portal and handbook, current OpenAI Agents API documentation, and the user-selected Ramp procurement reference. This is a proposed implementation scope; this review has not changed application code, configured services, or run live API calls.

## Decision

Build one DealGuard negotiation workflow with a polished, single-screen buyer workspace. Use the existing TypeScript engine and Agents API integration as the starting point. Defer MentorOS: its schedule feasibility, multiple mentors, and calendar integration would add too much new work within this window.

The user requires a working demo within two hours and selected **Ramp procurement** as the UI reference. Their deadline was given at approximately 12:25 Dubai time; target a reviewable demo around **14:25 Dubai**, including review time already spent. Team size remains unconfirmed, so the scope must not depend on several human developers.

Product promise: **DealGuard catches costly changes in supplier negotiations, proposes better terms from historical evidence, and carries an approved counteroffer back into the conversation.**

## Competition fit

The published rubric scores four criteria from 1 to 5: end-to-end functionality, innovation/theme alignment, technical execution/integration, and usefulness/agent experience. A real channel event and confirmed action strengthen the submission more than extra dashboards or source counts. This is an assessment of fit, not a prediction of winning.

The event page schedules submissions at 15:30–16:00; the portal lists a 16:30 submission cutoff. Finish the demo well before either. The portal also lists team registration at 11:30, already past when reviewed: verify that the team entry exists before depending on submission access.

The handbook requires newly built core functionality during the event, while permitting reusable building blocks. The existing README says the prototype was built today, but that statement alone does not independently establish eligibility. Preserve an accurate record of what was built when.

Required submission package: title, description, public GitHub repository, two-minute video, and a public social post tagging event partners. Prepare materials within the time budget; publication and posting remain separate authorized actions.

## The complete demo

1. A fictional supplier posts a real message in a designated Slack test thread: AED 1.05M recurring per year, AED 90K setup, 36 months, net 30.
2. A message event starts the agent automatically. The web workspace shows genuine progress and the source offer.
3. The agent consults deal context, six synthetic historical negotiations, policy, and prior confirmed actions. Code computes costs and policy outcomes.
4. The workspace presents one recommended counteroffer, its evidence, and a side-by-side terms comparison. The illustrative target is AED 1.04M/year, no setup fee, 24 months, net 60; live results must be shown as actually generated.
5. The buyer opens the private Slack approval from the workspace and approves the exact stored counteroffer. Approval continues to use the Slack identity checks already in the engine.
6. The bot sends the approved text to the original supplier thread. The workspace updates only after an actual delivery receipt.
7. A second supplier reply matches the requested price but changes the term to 48 months. Show a conspicuous **24 → 48 months** difference, the previous counteroffer, and the applicable policy hold. No acceptance is sent.

The second event is the principal enhancement: it demonstrates useful continuity and makes changed terms immediately legible. A supplier message arriving while approval is pending must invalidate the older approval.

## One-screen UI

Reference: [Ramp procurement](https://ramp.com/procurement/), especially the publicly visible vendor-renewal and negotiation-briefing product illustrations. Observed at 1280×720. The authenticated application and its detailed interactions have not been inspected; those behaviors remain unknown.

Observed mechanisms to adapt: warm neutral framing around white panels; restrained black typography; prominent monetary figures with small descriptive labels; fine table dividers; compact status chips; muted green, blue, and amber indicators. Keep DealGuard branding and original content. Do not reproduce Ramp's logo, screenshots, customer names, or financial performance claims.

Proposed composition:

- **Header:** deal, supplier, current offer version, actual connection state.
- **Main area:** supplier conversation and before/after terms table, including annual recurring cost, setup fee, annualized cost, term, payment days, and total commitment.
- **Decision panel:** one recommendation, two concise reasons, required approval, and exact outgoing text; a clear link to the actual private Slack approval.
- **Evidence drawer:** the cited source records and computed historical summary.
- **Activity strip:** received → reviewed → awaiting approval → delivered, or held/failed/stale. Reflect application state rather than timed decorative steps.

Interactions: open/close evidence, inspect the prior offer, navigate to the Slack review/thread, observe live status updates, and reset an explicitly labelled offline rehearsal. Include waiting, running, pending, sent, blocked, stale, failed, and disconnected states. Prioritize the presentation laptop; ensure the layout remains usable on a narrow viewport without a second design.

Keep web approval as navigation to Slack for this build. Adding a second approval identity/authentication system is unnecessary work and could weaken the existing controls.

## Architecture

One local Node/TypeScript process owns the engine, channel connection, and a small web server. The browser reads the same engine state through a narrow API using native fetch; brief polling is sufficient for this demo. Avoid an independent state writer or a separate backend. A small static HTML/CSS/JavaScript frontend can provide the required polish without adding another build system.

Use the current public OpenAI SDK's `client.beta.agents`, one persistent session per negotiation, and the existing OpenAI-hosted environment. Keep the three tools already implemented: `get_deal_context`, `evaluate_terms`, and `submit_decision`. Human approval and message delivery remain host-controlled. API access and actual latency must be verified; the installed plugin does not establish access.

The existing Slack Bolt and Web API packages introduce the locally banned HTTP dependency. Replace that transport with a narrow native fetch/WebSocket adapter; retain event filtering, acknowledgement, private approvals, identity checks, and receipts. Remove the prohibited dependency path from the manifest/lock/install tree as part of implementation. Do not reinstall the current dependency graph unchanged.

## Preserve and cut

Preserve: one live channel, one agent, one deal, deterministic money/policy, cited evidence, exact approval, confirmed delivery, persistent follow-up, and a labelled replay fallback.

Cut from the original plans: multiple deals and channels, eight-source quota, three strategy cards, CRM/ERP connections, market research, generalized risk and success scores, autonomous purchasing, editing approved terms, multi-agent personas, onboarding, settings, cloud deployment, and a mobile application.

The original plans contain conflicting cost/approval examples and propose hidden fallback behavior. Use the corrected formulas and rules in the current engine. Annualized cost = (annual recurring × term months / 12 + one-time fees) × 12 / term months. In the illustrative scenario, the requested annualized reduction is AED 40,000. The total-commitment difference is not equivalent to cash savings. Historical concession rates are descriptive synthetic examples, not predicted acceptance probabilities. Clearly distinguish live integration, synthetic business records, and replay.

## Two-hour allocation

This allocation includes discovery already performed; do not restart the clock after planning.

| Elapsed | Required result |
|---|---|
| 0–15 min | Scope/reference fixed, local runtime blockers identified, access check prepared |
| 15–40 min | Approved transport and local UI shell; prove one real channel event and one hosted agent/tool round trip |
| 40–70 min | Wire live state, terms comparison, evidence drawer, Slack approval navigation, and delivery receipt |
| 70–90 min | Second offer, visible term difference, policy hold, stale/duplicate handling; freeze features |
| 90–105 min | Browser review, focused functional checks, independent visual critiques, corrections, and two consecutive live rehearsals |
| 105–120 min | Record the two-minute demo and finish reproducible README, description, repository preparation, and social draft |

If channel or Agents API access is blocked at minute 40, report the exact issue and preserve the working UI/replay. Do not claim live readiness or silently substitute a different API. Cut optional visual detail before sacrificing verification and recording. The two-hour window is a delivery constraint, not permission to assert that missing acceptance checks passed.

## Evidence required to call it ready

- Initial supplier event triggers an actual Agents API turn and a grounded proposal.
- Authorized Slack approval sends the exact stored counteroffer once; the UI displays a confirmed receipt.
- A second message uses the same session and prior action, exposes the changed term, and reaches the correct policy hold.
- Wrong approvers, duplicate clicks, stale offers, and failed/uncertain sends do not produce unauthorized or duplicate messages.
- Evidence links resolve; financial values come from code; no fabricated connection, savings, or prediction claims appear.
- All UI controls work and key loading/error states are visibly handled. Current vision-loop critiques and owner review apply to the same rendered candidate.
- The two-minute recording shows the actual integration and identifies synthetic data; any edited waiting time is apparent.

## Current verified state

- The folder contains both original plans, an earlier preimplementation review, DealGuard source, tests, a Slack manifest, an offline replay report, and submission-copy drafts.
- No browser frontend currently exists in the inspected source.
- Direct TypeScript checking succeeded. The normal npm check launcher reported `Operation not permitted`; the test runner then failed before tests could execute because esbuild could not spawn (`EPERM`). Tests are not verified passing in this review. Repair the development runtime without disabling machine security protections.
- Slack and OpenAI live execution are unverified. The replay explicitly uses scripted decisions and simulated delivery.
- The folder is not currently a Git repository.
- The shared ChatGPT URL exposed a title but no readable conversation through the available readers. Its contents were not used or inferred.

## Sources

- [Event](https://dubai.aitinkerers.org/p/agents-everywhere-bots-channels-more-global-hackathon)
- [Rubric and deadlines](https://dubai.aitinkerers.org/hackathons/h_07nKwzMAjWo)
- [Handbook](https://dubai.aitinkerers.org/hackathons/h_07nKwzMAjWo/handbook)
- [Agents API quickstart](https://developers.openai.com/api/docs/guides/agents-api/quickstart)
- [Agents API overview](https://developers.openai.com/api/docs/guides/agents-api/overview)
- [Selected Ramp reference](https://ramp.com/procurement/)

Local inputs: `DealGuard_2.0_Hackathon_MVP_Plan_Fast_Track.md`, `MentorOS_Hackathon_MVP_Plan_Fast_Track.md`, `Hackathon_Preimplementation_Review.md`, current `src/`, `test/`, `package.json`, `package-lock.json`, `README.md`, `DEMO_SCRIPT.md`, and the existing offline replay report.
