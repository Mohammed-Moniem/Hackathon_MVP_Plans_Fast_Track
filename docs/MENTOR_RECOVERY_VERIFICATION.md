# Accepted-turn recovery — live verification

12 September 2026, local server 127.0.0.1:3210. User authorized reuse of the project key for bounded live checks.

The original UI follow-up asked for a walking option in Dubai Marina while preserving the approved dinner, study and bedtime times. The service accepted it at 09:32 UTC, then the stream disconnected before any application tool result. The approved schedule stayed intact. Read-only retrieval showed that the same turn was waiting for `get_day_context`; submitting the request again would have been incorrect.

The repaired service exposes an explicit **Resume review** action only when local state contains an unresolved live review, no tool results and an unchanged day. It verifies the remote session, pending action, turn identity and creation time before returning any tool output. Recovery never posts another input message. Automatic recovery during an active request is limited to one reattachment within the original deadline; staged candidates, sources and validation remain in the original closure.

Actual browser sequence: reload after server restart → Resume review once → wait for pending proposal. `review_resumed` was recorded at 09:44:26.986 UTC for the original turn, and the proposal became pending at 09:45:45.804 UTC, 78.818 seconds later. The agent read current context, retrieved five real Exa results, corrected one invalid tool input, validated its changes, and staged a proposal. Intended-turn completion was required before approval became available.

Result: one activity-title change to **Evening walk · Dubai Marina Walk option**, keeping 19:45–20:30. Dinner remains 20:30–21:00; study remains 21:00–22:30; wind-down and bedtime remain fixed. The actual cited sources are [Visit Dubai](https://www.visitdubai.com/en/places-to-visit/marina-walk) and [Emaar Community Management](https://www.ecm.ae/en/communities/dubai-marina/discover/whats-around/promenade-dubai-marina/). The proposal explicitly leaves travel time and access unconfirmed and makes no booking.

The original prior approval is still in local memory. The new proposal remains pending for presenter review; no external calendar was changed. Exact persisted evidence: `artifacts/mentoros-location-recovery.json` (synthetic profile plus real local decisions, source results and audit; no API credentials).

Mocked SDK regressions cover accepted-input disconnect, disconnect after validation, disconnect after staging, explicit zero-tool resume, refusal of unsafe resume, repeated interruption bounds and wrong-turn rejection. The full suite after the recovery implementation passed 118 tests with one opt-in live test skipped; later suite totals may include additional HTTP checks.

Limits: local retry eligibility does not guarantee the remote turn is still recoverable. Explicit recovery intentionally refuses a persisted interrupted run with tool results because its in-memory candidate and validation context are unavailable after restart. An interrupted run is never silently presented as a successful plan.
