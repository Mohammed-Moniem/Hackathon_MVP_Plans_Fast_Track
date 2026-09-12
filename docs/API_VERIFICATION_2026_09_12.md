# API verification — 12 September 2026

## Current result: the funded key works

The user saved a replacement `OPENAI_API_KEY` at 15:56 Dubai time. A fresh Responses API call returned HTTP 200 from organization `outoftheboxjs`, project `proj_8pITu5ACGKqFimEMqcBBuR77`. The local app was restarted with that key. Subsequent real app/provider checks passed; the previous credit blocker is resolved.

The previous key belonged to `algidaq`, project `proj_XKu05siDJSeG64XBXvLtHbHr`, which returned `credit_balance_exhausted`. The user's billing screenshot showed $13.17 under **OutOfTheBoxJS**, a different organization. OpenAI confirmed the mismatch with HTTP 401 `mismatched_organization` when the old key was scoped to OutOfTheBoxJS. Additional credits were not necessary to establish this diagnosis. Exa is separate; OpenRouter is not configured or used. The $13.17 was observed before these new checks and is not a current remaining-balance claim.

No key value was printed or included in evidence. The user edited the credential locally; this run did not create another key or change billing settings.

## Fresh live checks

All evidence below is under `artifacts/api-audit-20260912/`.

| Capability | Actual result | Evidence |
|---|---|---|
| Funded OpenAI key | Responses HTTP 200, output `OK`, confirmed OutOfTheBoxJS project | `saved-key-recheck-1556.json` |
| Meal image generation | Clicked the actual dashboard button; Images API returned `gpt-image-2`, high quality, 1024×1024 PNG, request `req_449bb3c22f014199b804637a56a9a8bd`. The image rendered at its native dimensions with no browser console errors. | `funded-image-check.json` |
| Original coach portraits | Both fictional portraits regenerated through `/v1/images/edits` with `gpt-image-2`, high quality, 1024×1024; visually reviewed, installed and served bytes verified. Originals retained. | `coach-portrait-regeneration.json`; `docs/IMAGE_PROVENANCE.json` |
| Receipt vision | Actual `/api/ecosystem/vision` correctly extracted the synthetic receipt: chickpeas AED 8, rice AED 12, spinach AED 6, total AED 26. | `funded-runtime-checks.json` |
| Voice | Actual speech endpoint generated MP3; actual transcription endpoint accurately recovered the test phrase. `gpt-4o-mini-tts` and `gpt-4o-mini-transcribe`. Physical microphone capture was not exercised. | `funded-runtime-checks.json`; `funded-voice-check.mp3` |
| AI mentor creation | Actual builder endpoint returned an editable travel mentor with search/vision tools and coordination instructions. Draft was intentionally not saved into the user's team. | `funded-runtime-checks.json` |
| Mentor communication | Two distinct hosted mentors, proposal and review rounds, two directed peer reviews, nine timeline messages, a pending recommendation, 76 seconds. Both reviewed the AED 650 gym against the AED 250 ceiling and recommended free exercise or conditional day passes. | `funded-council-check.json` |
| Image inside the mentor council | A mentor invoked GPT Image 2, the generated image and provenance entered the timeline, both mentors reviewed each other, and synthesis produced a pending recommendation. Eleven messages, five Exa sources, 196 seconds. | `funded-image-council-check.json`; `funded-council-meal.png` |
| Exa | A council mentor invoked the actual search tool and retrieved five sources. Earlier standalone grocery retrieval also passed. Retrieved pages do not prove current prices, hours, stock or availability. | `funded-council-check.json`; `exa-live.json` |
| Daily planner | Actual hosted agent proposed changes after a synthetic late meeting. The isolated proposal was locally approved and produced an `.ics` export. 77 seconds. | `funded-planner-deal-checks.json` |
| DealGuard | Actual hosted agent processed the synthetic initial offer through application context, evaluation and proposal validation. 61 seconds. No supplier message sent. | `funded-planner-deal-checks.json` |

The council ran through an isolated copy of the app server. Planner and DealGuard checks used their real compiled application services with disposable state. Their retained hosted sessions were deleted after testing; council cleanup reported no unconfirmed sessions. The user's pending council and approved planner files remained byte-for-byte unchanged. The main server remains available on port 3210.

## Image timeout correction

The first real meal request hit the old **90-second** deadline. GPT Image 2 high-quality output completed on one explicit retry in **137 seconds** after extending generation to a bounded **180 seconds**. Image-enabled councils allow 240 seconds for the proposal phase and 330 seconds overall, with a 360-second browser deadline; ordinary text councils retain their 215-second cap. A regression test verifies that a 170-second image reaches peer review and the final recommendation. Receipt analysis retains its 60-second default and 90-second maximum override. Image generation still permits only `gpt-image-2` or `gpt-image-2-2026-04-21`; there is no model fallback and no automatic paid retry.

Successful image results retain model, quality, size and provider request ID. Existing historical council images remain honestly labelled as older images without recorded model provenance; they were not relabelled or overwritten. The two current static portraits now have verified GPT Image 2 provenance.

Official model reference: [GPT Image 2](https://developers.openai.com/api/docs/models/gpt-image-2).

## Local verification

- Type check passed after the deadline change.
- Full suite: **228 passed, one optional live test skipped, zero failures** (`funded-final-tests.log`).
- Media tests: **31 passed**, including generation beyond 90 seconds, the 180-second cap, retained vision cap and no late image persistence after cancellation (`image-deadline-tests.log`).
- Earlier isolated black-box HTTP run: **16 passed, two explicit skips, zero failures**, with no credentials or outbound fetch attempts (`local-http-final.json`).
- Prior dashboard/browser checks covered routing, creation/editing, draft retention, approval and message length limits. The fresh meal generation additionally exercised the actual funded API from the routed app and visibly rendered the returned image.

## Remaining integration boundaries

| Integration | Current behavior |
|---|---|
| Google Calendar | Exact locally approved `.ics` download. OAuth synchronization and automated calendar follow-ups are not connected. |
| Slack | The teammate's bot is connected separately, per the user. This web app does not share its state or delivery receipts. |
| Gmail / Higgsfield | Available Codex tools, not connected application runtimes. |
| Microphone | Speech generation and transcription APIs passed; physical browser microphone capture still needs a spoken user check. |
| Progress, long-term goals and check-ins | Remain paused under the user's instruction to finish the core dashboard first. |

This is a local single-user hackathon prototype with synthetic starting data. No external message, booking, purchase, deployment or submission was performed. Capability flags indicate configuration, not continuous provider health monitoring.
