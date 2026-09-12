# Hackathon preimplementation review

Reviewed 12 September 2026. Recommendation for discussion; no application implementation or account/API setup performed.

**Build DealGuard as a small agent inside a real communication channel.** Preserve the contextual negotiation insight, deterministic calculations, human approval, and visible follow-through. Spend the saved dashboard time on one real integration and a convincing second event. This is a judgment about the best route under today's constraints, not a prediction of judging results.

The two source plans are `DealGuard_2.0_Hackathon_MVP_Plan_Fast_Track.md` and `MentorOS_Hackathon_MVP_Plan_Fast_Track.md`. Team capacity, existing integrations, and account access are still unconfirmed. The proposed schedule assumes two to four builders and an installable test Slack workspace.

## What the event actually rewards

The portal publishes four criteria, each scored 1–5: working end-to-end functionality in the intended environment; innovation and theme alignment; technical execution and integration; usefulness and the agent experience. In particular, environment-as-wrapper and primarily mocked implementations receive weak descriptions. No additional percentage weighting was visible. Therefore, prioritize a real event, contextual intervention, controlled action, and reliable outcome over feature count. [Published rubric](https://dubai.aitinkerers.org/hackathons/h_07nKwzMAjWo)

The event page schedules building for 11:15–15:30 and submissions for 15:30–16:00 Dubai time, followed by optional sharing without formal local judging. Submission needs a title, description, public GitHub repository, two-minute demo video, and a social post tagging partners. [Event page](https://dubai.aitinkerers.org/p/agents-everywhere-bots-channels-more-global-hackathon)

The portal's deadline modal separately shows team registration at 11:30 and submission at 16:30, plus judging timestamps that differ from the event's global-review narrative. Use 16:00 as the operational submission target; check organizer announcements before relying on the later cutoff. [Portal deadlines](https://dubai.aitinkerers.org/hackathons/h_07nKwzMAjWo)

Core functionality must be newly built during the official event. Templates, libraries, prompts, and other building blocks are permitted; extending a pre-existing product and entering it as new is not. Record what was built today. [Handbook](https://dubai.aitinkerers.org/hackathons/h_07nKwzMAjWo/handbook)

## Choosing between the plans

| Consideration | DealGuard | MentorOS |
|---|---|---|
| Immediate payoff | Avoid a costly commitment; request better terms | Recover a disrupted day while balancing goals |
| Smallest convincing implementation | One agent, one deal, one approval, one reply | Two competing objectives, feasible scheduling, approval, calendar changes |
| Strongest moment | A tempting discount hides a longer commitment; history suggests another concession | Personal history changes the compromise between study and exercise |
| Main weakness today | Simulated channel; inconsistent financial and approval examples | Platform scope; questionable predictions; schedule does not yet force the stated compromise |
| Recommendation | Primary choice | Prefer only if real calendar access and a timeline component are already working |

Both plans have strong foundations: deterministic metrics, explicit approval, evidence, resettable scenarios, and a narrow architecture. Neither needs eight visible data sources, multiple screens, or an extensive tool catalogue to demonstrate those strengths.

## Revised DealGuard scope

Product sentence: **DealGuard watches a supplier negotiation, catches an expensive tradeoff, and gets the right person to approve a better response in the tools they already use.**

1. A teammate playing a fictional supplier posts a revised offer in one designated Slack thread. The integration is real; the supplier and business records are clearly marked demonstration data.
2. A subscribed message event starts analysis without a separate prompt. Ignore the bot's own messages and duplicate deliveries. Bind the thread to the deal explicitly.
3. The agent reads one compact context bundle containing the deal, comparable supplier history, policy, and previous negotiation actions. Code computes the financial comparisons.
4. It proposes one recommended counteroffer with two concise reasons and source references. Keep any alternative strategy behind an optional detail view.
5. A private buyer-side Slack approval message shows the proposed terms, exact outgoing text, annualized cost, total commitment, policy route, and Approve/Reject buttons. Keep private budget and negotiating limits out of the supplier thread.
6. A server-side check verifies the configured approver and current proposal version. The bot sends the exact approved counteroffer into the original thread, records the actual message identifier, and updates local deal state.
7. A second supplier offer continues the same session. It demonstrates that DealGuard uses the previous counteroffer and detects a changed or impermissible term.

**Keep:** one real channel, one deal, three or four meaningful context sources, one recommendation, private approval, evidence, action receipt, reset, one follow-up event.

**Cut:** mock Slack/Gmail selector, deal list, standalone approval inbox, role-switcher theatre, full dashboard, three strategy cards, generalized risk scores, market search, CRM OAuth, extra agent personas, and sponsor integration added solely for a logo.

Slack can supply the primary interface through messages and buttons. A small web evidence view is optional after the workflow works. Socket Mode receives events over a WebSocket using a bot and app token; the local bot needs a running process and network connection. It does not require a publicly reachable inbound endpoint. [Slack Socket Mode](https://docs.slack.dev/tools/bolt-js/concepts/socket-mode/), [OpenAI Slack walkthrough](https://developers.openai.com/showcase/agents-api-slack-bot)

Budget the first 20–30 minutes for proving channel access. If Slack installation is blocked, use a channel the team already has working. Avoid making a new account/integration experiment the critical path. A clearly labelled local simulation remains a rehearsal fallback, with reduced confidence in competition fit.

## OpenAI Agents API architecture

Use **one TypeScript Node application, one agent, and one durable Agents API session per supplier thread**, with the official `openai` SDK, Slack Bolt, Zod, fixture files, and a small persisted state file. Next.js is optional for a supporting evidence page. Do not start with separate mentor services or a custom agent framework.

The Agents API provides the managed agent harness and durable sessions; it is distinct from the application-managed Agents SDK. Use `client.beta.agents` and an OpenAI-hosted environment initially. [Agents API overview](https://developers.openai.com/api/docs/guides/agents-api/overview)

Before implementation, follow credential setup and run a bounded access check. The quickstart requires agent read/write and Responses inference permissions. Confirm hosted session creation, one real file/command operation, and one application tool round trip. An installed developer plugin does not establish account access. Use the current quickstart model only after verifying access. [Agents API quickstart](https://developers.openai.com/api/docs/guides/agents-api/quickstart)

Proposed application tool contracts:

- `get_deal_context`: retrieve the scoped thread, fixture evidence, policy, state, and computed summaries in one bundle.
- `evaluate_terms`: recompute costs and the required approval set from explicit candidate terms.
- `propose_counteroffer`: validate and store a versioned proposal; return a pending-approval identifier.
- `execute_approved_proposal`: load the exact stored proposal and verify approval, freshness, and prior execution before sending.

The host owns credentials, arithmetic, policy, authorization, and action state. The model synthesizes terms, explains tradeoffs, and drafts text. Its output never grants approval. Application tools return results using the matching session turn and call IDs. [Function tools](https://developers.openai.com/api/docs/guides/agents-api/tools/functions)

Complete the proposal turn while waiting for the human. On an authorized approval callback, execute the stored proposal and feed the receipt back into the existing session. Do not leave a web request open for human approval. Keep the bot/tool responder process running independently of any browser view.

Persist thread→session IDs, proposal versions, approvals, event IDs, and action receipts. Confirm the intended turn completed successfully and reconcile saved output before retrying after a disconnect. Measure actual proposal latency; the old plans' 3–7 second targets are aspirations, not verified guarantees. A single agent turn may require several model/tool steps, so drop the strict one-model-call requirement.

The official Slack showcase is useful for the interaction pattern, but its displayed code uses a preview client and self-hosted Docker. Do not copy that runtime verbatim into the current public SDK/hosted design. [Slack walkthrough](https://developers.openai.com/showcase/agents-api-slack-bot)

## Fix these issues before coding

**DealGuard approval contradictions.** The sample matrix requires CFO approval above AED 1M, but the AED 1.06M/year example routes only to Procurement Director. Choose one authoritative policy. For the revised demo: CFO above AED 1M annualized cost; add Procurement Director for terms above 24 months; treat anything above 36 months as a hard block. These are fictional demo rules, not real procurement requirements. Evaluate the union of triggered approval requirements and re-evaluate any edited proposal.

**DealGuard financial definitions.** AED 1.142M against the listed AED 1.08M budget is AED 62,000 over, or approximately 5.74%; the example's AED 82,000/7.74% does not match. Also distinguish total budget from remaining budget. Add explicit quantity, unit billing period, annual recurring cost, numeric one-time fees, contract months, and budget basis. A displayed AED 860/unit is not enough to derive annual cost.

For fixed-price fixtures, define total commitment as annual recurring cost × months/12 + one-time fees, and annualized cost as total commitment × 12/months. Do not call a reduction in contract duration cash savings, or payment deferral a nominal discount. Remove invented success probabilities and model-supplied financial totals.

An illustrative consistent fixture: supplier requests AED 1.05M/year, AED 90,000 setup, and 36 months. Total commitment is AED 3.24M; annualized cost is AED 1.08M. A proposed AED 1.04M/year, zero setup, 24-month counteroffer has AED 2.08M total commitment and AED 1.04M annualized cost. Describe the AED 40,000 annualized difference as requested savings, pending supplier acceptance. Do not describe the entire total-commitment difference as savings. The counteroffer still requires CFO approval under the proposed policy.

**MentorOS feasibility.** The displayed 17:30–19:00 meeting does not clearly force study to shrink to 45 minutes: after the proposed dinner ending 20:10, a 20:15–21:45 study block still fits before the stated wind-down and bedtime. Introduce genuine constraints such as a fixed evening commitment and travel buffers, or allow the solver to retain the longer study block. Validate today and tomorrow before presenting a compromise.

**MentorOS evidence.** Two completed workouts out of seven is a 29% historical rate in the sample, not a validated prediction of tonight's outcome. A 41-minute average versus a 52-minute requirement is about 21% below the required daily pace; an 8% cumulative deficit needs a separate calculation. A 25-minute workout cannot be said to preserve a weekly target unless that target is explicitly defined and checked.

**Demo honesty and memory.** Replace fake “Connected” badges and visually indistinguishable model fallbacks with explicit live/sample/replay indicators. Show actual tool events and source records. A saved memory entry proves storage; a later decision using that entry proves useful continuity. Record “counteroffer sent,” not “supplier accepted” or “savings achieved.”

## Build checkpoints and delivery

| Time, Dubai | Required outcome |
|---|---|
| By 11:30 | Team registered; project chosen; channel and API access check started |
| By 11:50 | Real message received and acknowledged; hosted agent/tool round trip proven |
| By 12:30 | One offer → computed comparison → stored proposal, using consistent fixtures |
| By 13:15 | Authorized approval → actual reply → persisted receipt; freeze core scope |
| By 14:00 | Follow-up event, private evidence, stale/duplicate action handling, reset work |
| By 14:30 | Three successful rehearsals; fallback clearly labelled; recording starts |
| 14:30–15:30 | Two-minute video, reproducible README, public repo preparation, description, social copy |
| 15:30–16:00 | Complete and verify the submission; use the later portal cutoff only as contingency |

If starting late, cut optional UI and extra analytics; preserve at least 45 minutes for recording and submission. One builder owns the channel/actions, one owns agent/metrics/policy, and a third or fourth can own evidence UI, verification, and submission preparation. For a solo builder, use Slack messages as the entire interface.

Focused verification: financial/policy boundary cases; wrong approver; duplicate inbound event and approval click; new offer invalidating old approval; action failure without false success; source references resolving to real fixture records. If a send result is uncertain, reconcile before retrying.

The two-minute recording should spend approximately 15 seconds on the problem and channel, 35 seconds on the live offer and evidence, 30 seconds on approval and action, 25 seconds on the second offer and policy response, and 15 seconds on the outcome and technical proof. Keep the distinction between live integration and synthetic business data visible. The closing claim should reflect what actually ran.

Public repo preparation, social copy, and submission materials belong in the build schedule. Actual publishing and posting should happen only when authorized by the team.
