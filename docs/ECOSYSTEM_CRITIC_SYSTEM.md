# SYSTEM critic — mentor-ecosystem-002

**Current verdict: PASS for the reviewed UI/SYSTEM scope. Fresh live demonstration remains externally BLOCKED by exhausted OpenAI credits.** The previous focus-restoration failure is closed. No remaining blocking UI defect is established in the reviewed scope; this is not an unconditional end-to-end live-readiness pass.

Updated 2026-09-12 after reviewing the final refinement in `docs/ECOSYSTEM_VERIFICATION.md`, final focus code, and saved speech diagnostic. Across this review I inspected eight actual captures and relevant MentorOS UI source. Browser interactions were performed by the parent, not this critic. I made no provider calls, ran no UI tests, and changed only this report.

## Addendum: focus and phone builder accepted

The final code in `web/mentoros/ecosystem.js:378–383` identifies the saved mentor in refreshed state, closes the dialog, then focuses its replacement Edit button, with Create as fallback. Deletion explicitly closes and focuses Create (`631`). This resolves the disconnected-opener defect previously reported as P2.

The parent's verification addendum records actual phone-size interactions on a separate keyless UI at port 3214:

| Action | Recorded resulting focus |
| --- | --- |
| Rename Mira to Mira QA, then Save | Edit Mira QA [active] |
| Confirm deletion | + Create a mentor [active] |
| Open creation dialog, then Cancel | + Create a mentor [active] |
| Manually create the Books-domain Reading mentor without API credentials | Edit Reading mentor [active] |

Save was reached successfully through the scrollable phone form. The QA store was isolated from the saved live council and user's planner, per the parent. These recorded observations match the inspected fix and close the save-access and focus proof gaps. I reviewed the documented observations; I did not independently perform these interactions. Escape-key behavior and physical microphone capture were not established by this evidence.

## External blocker and defining journeys

`artifacts/ecosystem-voice-recheck.json` confirms HTTP **429**, **credit_balance_exhausted**, **insufficient_quota**. The latest directly documented failure is speech. Credit restoration or a funded replacement key remains pending. This is a provider-access blocker, not a visual failure, missing voice implementation, or evidence of an Exa outage.

- **Custom mentors:** Historical AI-assisted Roam creation is documented; current keyless manual creation/edit/delete now has parent-recorded phone interaction proof. Fresh AI drafting is not currently signed off.
- **Council and shared context:** Saved gym and three-mentor runs document real proposals, reciprocal peer reviews, budget/preferences reasoning and a shared decision. They remain historical live evidence; saved-result viewing remains usable per the parent.
- **Decision approval:** Captures show prominent Approve/Reject and explicit local shared-memory consequences. Source ties the action to the pending current run. No new approval was exercised by this critic.
- **Receipt, meal and local search:** Actual prior tool captures show receipt analysis/attachment and generated meal imagery with provenance. Fresh OpenAI analysis/generation and council-mediated search cannot receive a current live PASS during the credit block.
- **Voice:** Capture/transcription-review and speech/error controls exist. Earlier API successes do not establish current availability. Physical microphone capture remains a device-level proof gap, not a demonstrated missing capability.

Capability chips now say **configured / not configured** (`web/mentoros/ecosystem.js:228`), accurately separating configuration from provider health. Older captures showing “available” predate that wording. Speech errors preserve captions; no replacement or fake speech is claimed.

## Visual acceptance and evidence

The reviewed captures pass coherence, readable hierarchy and visible approval. Space Grotesk/Manrope, white panels, fine rules and vivid cobalt/teal/coral accents are consistent. Source-token contrast calculations were 14.92:1 for ink/white, 5.57:1 for muted/white and 5.76:1 for white/primary; this is not a complete accessibility audit. Phone cards and builder reflow without visible horizontal clipping. Phone approval is visible around y=586–630; the builder has readable stacked sections and labeled fields.

Captures inspected under `.vision-loop/runs/two-projects-20260912/artifacts/renders/`:

- Current layout evidence: `ecosystem-desktop-v2.jpg`, `ecosystem-decision-desktop-v3.jpg`, `ecosystem-phone-v2.jpg`, `ecosystem-decision-phone-v2.jpg`, `ecosystem-builder-desktop-v1.jpg`, `ecosystem-builder-phone-v2.jpg`.
- Historical tool evidence with superseded geometry: `ecosystem-meal-ui-v1.jpg`, `ecosystem-receipt-ui-v1.jpg`.

Acceptance sources: `docs/ECOSYSTEM_TARGET.md`, `docs/ECOSYSTEM_VERIFICATION.md`, `docs/VOICE_VERIFICATION.md`, and the speech diagnostic above. Reported automated tests were not rerun. No public deployment, Slack integration, recovered provider access, or independently tested UI is claimed.
