# DealGuard UI handoff

The user confirmed the teammate’s separate build already integrates with Slack. Keep that running bot as the owner of Slack state, approvals and delivery. This local UI currently uses a separate loopback demo server; its replay receipts are explicitly simulated. No teammate bot credentials were copied, and no messages were sent from this implementation pass.

## Fastest connection path

Copy `web/dealguard/` to the teammate’s app and serve it from the same origin as an adapter implementing the routes below. Keep the existing bot as the sole writer of live proposals and delivery state. Use the actual persisted bot store for reads; do not mirror stale proposals into an independent in-memory engine.

| Route | Request | Required behavior |
|---|---|---|
| `GET /api/dealguard/state` | — | Return current thread, proposals, evidence, computed patterns, audit, mode and truthful capabilities. |
| `POST /api/dealguard/message` | `{text}` | Use the bot’s existing review entry point for the current thread; mark busy and reject conflicting writes. |
| `POST /api/dealguard/approve` | `{id}` | Require an authenticated buyer identity with the actual required role. Approve only current exact stored wording through the bot’s existing execution path. |
| `POST /api/dealguard/reject` | `{id}` | Same identity, current-proposal and authorization checks. Never send. |
| `POST /api/dealguard/reconcile` | `{id}` | Read the existing delivery receipt; never resend an uncertain message. |
| `POST /api/dealguard/reset` | `{mode}` | Isolated rehearsal only. Do not erase the bot’s live history. |

The full response shapes are in `src/domain.ts` and `IMPLEMENTATION_TARGETS.md`; the adapter example is `src/server.ts`. This server’s `LOCAL-DEMO` identity is only for replay and must not be adopted as a live approver. It deliberately rejects live browser approvals. If browser authentication is not ready, make the UI a read-only live dashboard and retain real approval buttons inside the private Slack channel.

Serve UI and adapter together to avoid introducing cross-origin credential handling during the hackathon. Keep native `fetch`; no extra HTTP dependency is needed. Keep keys in the teammate’s existing server configuration, never browser JavaScript.

## Joint verification

1. Post a synthetic offer through the existing authorized Slack demo flow.
2. Confirm the UI shows the identical thread/version, terms, policy and exact proposed text.
3. Approve through the existing private Slack workflow. The UI must show the matching real channel, message timestamp and receipt.
4. Post the 48-month follow-up. The UI must invalidate the earlier decision and display the policy hold.

Until those checks run against the teammate’s actual build, describe the UI adapter as a prepared handoff, not an integrated live Slack dashboard. The teammate’s source path and runtime response shape have not been provided here.
