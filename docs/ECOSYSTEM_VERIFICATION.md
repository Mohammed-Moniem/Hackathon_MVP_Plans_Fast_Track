# Ecosystem verification — 12 September 2026

Candidate `mentor-ecosystem-002`, after the user's custom-mentor and visual expansion. The original layouts remain the starting point; earlier critic passes are historical.

## Actual live journeys

- **AI mentor creation, browser:** described Roam, an affordable vacation mentor; clicked Draft with AI; received editable name, domain, goals, instructions, search permission, voice preset and color. Edited the description and saved. Four profiles survive reload. The new mentor is selected in the second real council.
- **Gym and budget council:** run `d2dbad9b-af21-4369-99bb-d7c0e73ecb04`, started 10:21:25.140 UTC, final resolution 10:22:42.079 UTC (76.939 seconds to resolution). Two distinct hosted mentors, two independent proposals, two reciprocal peer reviews, five actual Exa sources. The demo profile has AED 12,000 income, 9,500 essentials, 2,000 savings target, 250 wellness cap. Health compared monthly gym advertisements above the ceiling; Finance accepted retrieved evidence after initially lacking it. Joint recommendation: home-first routine, optional occasional visits, current quotes and remaining funds unconfirmed. Local approval at 10:24:02.199 UTC added one memory; no money was spent.
- **Three-mentor ecosystem:** run `4fcb9fd7-9eb1-444e-9cc7-e52928acfe6f`, started 10:24:02.760 UTC, final resolution 10:25:19.768 UTC (77.008 seconds). Mira, Penny and the actual custom Roam exchanged six reciprocal peer reviews. Roam changed its sandwich fallback after reading Mira's receipt-based bowl; Finance protected savings and challenged assumptions about available funds/equipment. Seventeen messages, five actual search sources, one actual image-tool result. The final no-extra-spend outing proposal remains available for review. It correctly reports consensus; no false disagreement was manufactured.
- **Receipt vision:** real OpenAI response in 2.972 seconds identified the fictional merchant, currency AED, printed total 26, and three items (chickpeas 8, brown rice 12, spinach 6). The same synthetic sample was exercised through the UI, displayed, and attached to the three-mentor council. It was explicitly not treated as real spending or proof of pantry ownership.
- **Meal images:** direct API check produced one 1024 PNG in 13.275 seconds. The standalone UI generation also displayed a real image. The three-mentor council's permitted `generate_meal_image` function generated `/api/ecosystem/images/08c13224-0e35-4307-b180-26f6cdbcec38`; the final recommendation and communication timeline display it. Images are labeled illustrations; nutrition/allergens are unverified.
- **Existing planner:** the user's interrupted accepted follow-up was resumed without resubmitting input, completed in 58.959 seconds, and retained the approved calendar. The user subsequently approved the planner result. New ecosystem tests did not reset that state.

Raw local evidence: `artifacts/ecosystem-gym-live-v2.json`, `ecosystem-three-mentor-live.json`, `ecosystem-builder-and-gym-state.json`, `ecosystem-vision-live.json`, `ecosystem-meal-live.json`, and `mentoros-user-followup-recovery.json`. The first council attempt failed locally before a provider call due to the SDK rejecting a transformed JSON-schema field; that was fixed before the successful run and is retained as historical evidence.

## Functional checks

The current suite includes custom-domain persistence, profile validation, exact/idempotent approval, stale-context invalidation, failed/restarted review protection, distinct hosted sessions, reciprocal peer messages, source provenance, tool permissions, missing providers, zero and insufficient spending capacity, unrelated domains not inheriting the wellness budget, one-image budgets, stream recovery without input resubmission, upload/response bounds, image signatures, private storage, HTTP origin/path guards and all previous DealGuard/planner checks.

Model output is never approval. Image-generation failures are not retried automatically. Search source IDs are validated against actual retrieved evidence. Raw image Markdown is displayed as the corresponding known image; arbitrary Markdown/HTML is not executed. Custom accent colors are decorative, while text and selection controls retain readable colors. Optional blank model overrides inherit configured defaults.

## Browser checks and evidence

Desktop 1280×720 and phone 390×844 captures are under `.vision-loop/runs/two-projects-20260912/artifacts/renders/`:

- `ecosystem-desktop-v2.jpg`: four saved mentors, actual selected team, refreshed colors/fonts.
- `ecosystem-decision-desktop-v3.jpg`: current recommendation and visible approval beside generated image.
- `ecosystem-phone-v2.jpg`: two-column mentor cards, no visibly clipped horizontal page content.
- `ecosystem-decision-phone-v2.jpg`: review shortcut lands on decision; approval is visible around y=586–630 in the 844px viewport.
- `ecosystem-builder-desktop-v1.jpg`: actual AI draft, editable before saving.
- `ecosystem-meal-ui-v1.jpg` and `ecosystem-receipt-ui-v1.jpg`: earlier tool interaction captures; later layout refinement supersedes their exact geometry.

The updated source navigation correctly switches between ecosystem sources/memory/conversation and the retained planner's surfaces. New microphone input follows Record → Stop → transcript → user review; no automatic council submission. API speech/transcription were previously live-verified. Physical presenter microphone capture remains a device-level check and is not claimed verified.

No public deployment, external Slack send, purchase, booking or external Calendar write was performed. The teammate's Slack build remains separate. This is a local hackathon demo with synthetic starting data, not a deployed multi-user product.

## Final refinement and current external limit

- Automated final count before the billing-message regression: **191 passed, 1 optional live test skipped, 0 failures**. Build/typecheck and JS syntax checks passed. A further isolated provider test verifies that exhausted-credit errors are actionable and redacted.
- The current OpenAI project returned HTTP 429 with code `credit_balance_exhausted`, type `insufficient_quota`, during the latest council speech attempt. The earlier successful councils, image tools and builder remain actual verified results; **new live API calls are currently blocked by billing**. The user was asked to add credits or provide a funded key file path. No payment was made, and no fake speech fallback was substituted. Raw diagnostic metadata is in `artifacts/ecosystem-voice-recheck.json` (no key or account data).
- Capability chips say **configured**, because key presence is not proof of currently usable billing/access. Saved council results, local mentor editing, generated-image viewing and local approvals remain usable. The speech UI reports the provider failure and keeps captions.
- SYSTEM critic found that replacing mentor cards could disconnect a dialog's original opener. Fixed explicit restoration after save and delete. In a separate keyless UI at port 3214, phone-size browser tests observed **Edit Mira QA [active]** after renaming, **+ Create a mentor [active]** after deleting, and the same Create focus after cancelling. Manual creation of a new Books mentor succeeded without API credentials and returned focus to **Edit Reading mentor [active]**. Save was reached through the scrollable mobile form. This QA store is isolated from the saved live council and the user's planner.
- `ecosystem-builder-phone-v2.jpg` confirms the phone builder's single-column scrollable layout. The parent exercised creation, editing, deletion and cancellation; no physical microphone input was recorded.

## Final regression checkpoint

On 12 September 2026 the final suite completed in 1.924 seconds: **193 total, 192 passed, 1 optional live test skipped, 0 failures**. Type checking, build and ecosystem JavaScript syntax passed. Test output is in `artifacts/ecosystem-final-tests.log`. The final server was restarted with the actionable billing-error mapping after confirming no active planner/council work; persisted approvals, four mentors and pending council survived. Browser navigation reopened the approved Your day plan and returned to the ecosystem. DealGuard was restored to its explicitly labelled initial replay offer, awaiting review.
