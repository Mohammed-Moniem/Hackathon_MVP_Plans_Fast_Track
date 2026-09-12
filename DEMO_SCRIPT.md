# Two-minute DealGuard recording

Record the live workflow after configuring and verifying both services. Keep the distinction between live integration and synthetic business records visible. A replay recording must be labelled as replay and does not prove live integration.

| Time | Screen and action | Suggested narration |
|---|---|---|
| 0:00–0:15 | Dedicated supplier Slack channel, then post the initial offer | “A lower annual price can hide a longer commitment. DealGuard watches the negotiation where it happens.” |
| 0:15–0:40 | Private buyer channel, actual progress, recommendation | “It checks the deal, supplier history and company policy. In these six sample deals, the supplier moved much more on setup fees than headline pricing.” |
| 0:40–0:55 | Evidence and financial comparison | “The cost comparison is computed in code. This is a request for better terms; we have not booked savings.” |
| 0:55–1:15 | CFO approves exact outgoing text; switch back to original supplier thread | “Only the configured approver can release this counteroffer. Here is the message actually delivered in the original thread.” |
| 1:15–1:40 | Supplier replies with the 48-month condition; private policy block appears | “The supplier matches our requested price but changes the term. The agent remembers the previous counteroffer, and the policy stops this new commitment.” |
| 1:40–2:00 | Show persisted receipt/audit briefly, finish in Slack | “One persistent agent session per negotiation. Real channel events, evidence-backed decisions, controlled action, and a record of what actually happened.” |

Use actual live latency and results in the recording. If editing out wait time, make the cut apparent. Avoid claiming that the synthetic supplier accepted, that money was saved, or that the local fixture store is a connected CRM.

## Submission copy draft

**Title:** DealGuard — better terms, before you commit

**Description:** DealGuard is a Slack-native negotiation agent for buyers. A supplier message triggers analysis of the conversation, historical concession patterns and a commercial policy. The agent proposes a counteroffer with cited evidence and code-computed cost comparisons, then routes the exact outgoing message to the configured buyer approver in a private channel. Approval delivers it in the original supplier thread and records a receipt. A later supplier message reuses the negotiation's Agents API session; prohibited terms are held rather than executed. The prototype uses synthetic business records and a local state store, with real Slack and OpenAI integrations when configured.

**Social copy draft:** We built DealGuard at the Agents, Everywhere hackathon: a Slack-native agent that spots costly negotiation tradeoffs, shows its evidence, and gets a counteroffer approved before sending it. Built with the OpenAI Agents API. [Add verified sponsor handles, public repository and two-minute demo links before posting.]

Before submission, verify the live run, confirm the public repository contains no `.env` or state files, include setup instructions, and test the video link while signed out. The copy above is prepared only; nothing has been published or posted.
