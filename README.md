# MentorOS + DealGuard

Two local prototypes for the September 12, 2026 Agents Everywhere hackathon.

**MentorOS:** create AI-assisted mentors for any domain and bring two to four into a council. Distinct hosted Agents sessions propose, read one another’s actual messages, and review trade-offs before a shared recommendation is synthesized. The ecosystem includes editable preferences and budget, receipt/image analysis, generated meal images, real Exa search, voice and approval memory. The original daily planner remains under **Your day**, with its own persistent two-role scheduling session and reviewed calendar export.

**DealGuard:** a supplier’s attractive price comes with a longer commitment. The agent reads commercial evidence, evaluates the full cost, and stages an exact counteroffer for approval. A changed-term follow-up is reviewed in the same session; prohibited commitments are blocked.

## App structure — current correction

MentorOS now opens on a dashboard. Its persistent navigation leads to **My mentors**, individual profiles, a full-page **Mentor studio**, **Council**, separate recommendation review, **Your day**, **Creative tools**, sources and **Shared context**. Each has a real URL with browser history and deep-link recovery. Existing agents, tools, voice, colors and typography remain integrated into those workflows.

The user rejected the previous single-page organization. This routed correction is candidate 003; progress, long-term-goal tracking and check-ins remain paused for layout review. No progress percentage or map is represented as implemented. See [app structure](docs/APP_STRUCTURE.md), [actual browser checks](docs/APP_BROWSER_CHECKS.md) and [current delivery](DELIVERY.md). Earlier ecosystem verification describes historical provider success, not current funded availability.

## Run the apps

Requires Node.js 24 or newer. Dependencies are already installed in this workspace. On a fresh checkout, run `npm ci`.

```sh
npm start
```

- [MentorOS](http://127.0.0.1:3210/mentoros/)
- [DealGuard](http://127.0.0.1:3210/dealguard/)

The server listens on `127.0.0.1:3210`. `PORT` can select another port. The TypeScript launcher avoids a native bundler dependency; `npm run check` is the separate type check. DealGuard and the daily planner offer clearly labelled rehearsal and live modes. The new ecosystem council is live-only; no scripted council is substituted when a provider fails. Manual mentor editing works without a key. Voice buttons use the live audio API when configured.

## What has been verified

| Capability | Observed result |
|---|---|
| OpenAI Agents API | Real hosted session, application tool round trip and downloaded artifact verified |
| DealGuard live analysis | Valid pending counteroffer, deterministic cost/policy checks, all nine source records accepted |
| MentorOS ecosystem | Live AI-created vacation mentor; two distinct hosted mentors exchanged proposals and peer reviews, retrieved five sources, resolved the gym/budget trade-off and saved an approved memory |
| Image tools | Real receipt extraction: AED 26 total with AED 8/12/6 line items; actual meal image generation and UI display |
| MentorOS daily planner | Real Exa retrieval, valid joint plan, exact local approval, same-session follow-up and approval memory |
| OpenAI speech and transcription | Spoken greeting generated and transcribed back correctly through the local server |
| Exa search | Real HTTP 200 retrieval; five official Open Group sources in a bounded direct check |
| Coach portraits | Two original fictional portraits generated for Mira and Atlas |
| Browser interfaces | Desktop/mobile inspection; replay actions, evidence, approvals and changed-term hold exercised |
| Slack transport | Native fetch/WebSocket implementation and mocked protocol/authorization tests; account setup still required |
| Google Calendar | Approved `.ics` export. No external calendar writes; connector access lacks the required scope |
| Gmail / Higgsfield | Available as Codex tools, not connected as app runtime credentials. No messages or video jobs submitted |

Live runs took approximately 67 seconds for DealGuard’s initial review and 70–79 seconds per MentorOS turn. Cold hosted startup and model latency vary. An interrupted MentorOS follow-up was safely resumed in the same accepted turn, returning real Dubai Marina sources and preserving the prior approved times. See [recovery verification](docs/MENTOR_RECOVERY_VERIFICATION.md). This is a local hackathon prototype, not a deployed or production-validated service.

**Current external blocker:** OpenAI returned `credit_balance_exhausted` during the final voice check. Saved results and manual editing work; new OpenAI calls require restored credits. No payment was made.

Final automated check: **193 passed, 1 optional live test skipped, 0 failures**; type check and build passed. The teammate’s separate DealGuard build already has Slack integration, as confirmed by the user; this workspace’s web UI does not yet share that bot’s runtime state or credentials.

Detailed evidence: [voice and Exa](docs/VOICE_VERIFICATION.md), [MentorOS](docs/MENTOR_LIVE_VERIFICATION.md), [DealGuard](docs/DEAL_LIVE_VERIFICATION.md), [HTTP/security checks](docs/SERVER_VERIFICATION.md). The [demo runbook](docs/DEMO_RUNBOOK.md) includes a two-minute recording outline.

## Configuration

The apps read process environment first, then `.env.local`, then `.env`. The current project credentials have already been configured locally; do not overwrite those files. On a fresh checkout, create `.env.local` from `.env.example` and enter your own values locally.

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Agents inference and audio; must have the required project access |
| `OPENAI_MODEL` | Agents model, default `gpt-6-astra` |
| `MENTOR_MODEL` | Optional daily-planner/Agents model override |
| `COUNCIL_MODEL` / `COUNCIL_SYNTHESIS_MODEL` | Optional council agent and final synthesis models |
| `MENTOR_BUILDER_MODEL` / `OPENAI_VISION_MODEL` | Default `gpt-4.1-mini` |
| `OPENAI_IMAGE_MODEL` | Default `gpt-image-1-mini`; one low-quality 1024px PNG per request |
| `EXA_API_KEY` | Real web/source retrieval |
| `OPENAI_TRANSCRIPTION_MODEL` | Default `gpt-4o-mini-transcribe` |
| `OPENAI_TTS_MODEL` | Default `gpt-4o-mini-tts` |
| `PROVIDER_TIMEOUT_MS` | Bounded provider request timeout |
| `MENTOR_STATE_PATH` | Default `.mentor/state.json` |

Keys remain server-side and must never appear in browser code, recordings, logs or version control. Source results are untrusted evidence. Venue search does not confirm routes, distances, opening hours, bookings or availability.

## MentorOS ecosystem

Use **Create a mentor** to describe any role, draft it with AI, edit all fields, choose tools and save. Up to 12 mentor profiles persist in `.mentor/ecosystem.json`; each council selects 2–4. The starting financial profile is synthetic and editable. For wellness spending, code computes `min(wellnessBudget, max(0, income - essentials - savings))`; a zero ceiling forces a no-spend recommendation. Quoted prices remain estimates unless confirmed independently.

Each selected mentor runs in a distinct hosted Agents session. Round one proposes independently; round two receives every actual first-round proposal and reviews every peer. A final Responses call synthesizes those outputs, preserves recorded disagreements, and validates source references. Actual Exa and explicitly requested meal-image tools produce visible receipts. No model-generated imitation of a peer substitutes for a missing response. Failed/partial councils cannot be approved. Work is bounded to 215 seconds plus up to 5 seconds cleanup; no automatic input resubmission.

The receipt tool sends only the uploaded image to OpenAI, extracts visible fields with nulls/uncertainties and does not record spending. The synthetic sample contains no private data. Attach the reviewed analysis to the next council; only vision-enabled mentors receive it directly. Generated meal images are illustrations, not verified nutrition or allergy information. Search finds retrieved pages for ingredients/places; it does not guarantee stock or access.

Approving the exact current recommendation adds it to ecosystem memory; rejecting it does not. Changing mentors or the profile invalidates a pending recommendation. Council approval never purchases, books, sends messages or changes the daily planner. Ecosystem history and daily-planner state are separate, explicitly scoped stores.

## MentorOS daily planner

The synthetic day has work, activity, dinner, TOGAF study, wind-down and bedtime. **Disrupt a meeting** adds a real local event from 17:30 to 19:30 and triggers a review; it is not an external Calendar webhook.

The four agent tools read the day and prior approvals, search Exa, validate exact before/after changes, and stage the joint proposal. Code protects fixed events, overlap rules, activity and meal minimums, and the longest feasible study block. One persistent session coordinates two logical coach roles. The model cannot approve a plan or mutate an external calendar.

Approval applies exactly the reviewed changes to the persisted local schedule. Rejection leaves the schedule unchanged. Export produces the most recent approved snapshot with UTC timestamps and RFC 5545 line folding. Follow-up messages read prior approval memory. Reset starts a new scenario and locally retires the prior session; it does not silently delete hosted history.

Voice uses microphone recording → server transcription → editable text → coaching review. The user can listen to a dynamic AI-generated reply, stop playback, and read the transcript. Microphone capture depends on browser permissions; the API audio round trip is verified separately from physical microphone capture.

## DealGuard behavior

Costs use whole AED and a constant service scope:

- Total commitment = annual recurring × months / 12 + one-time setup.
- Annualized cost = total commitment × 12 / months.
- Dedicated annual budget: AED 1,080,000.
- Above AED 1M annualized: CFO. Above 24 months: also Procurement Director. Above 36 months: hard block.

The initial replay compares AED 1,080,000 annualized with a requested AED 1,040,000 counteroffer. It never labels requested concessions as realized savings, supplier acceptance, or a predicted success rate. History, budget and policy records are synthetic.

The browser can analyze live custom offers. Browser replay approval simulates delivery and labels its receipt. **Live supplier delivery and role-authorized approval belong to the separately configured Slack bot.** They are unavailable in the browser when Slack is disconnected.

### Optional live Slack bot

1. Create an internal app from `slack-manifest.json` in the intended test workspace and install it.
2. Store its bot token as `SLACK_BOT_TOKEN`. Create an app-level token with `connections:write` and store it as `SLACK_APP_TOKEN`.
3. Set `SLACK_TEAM_ID`, a dedicated `SLACK_SUPPLIER_CHANNEL`, and a separate private `SLACK_APPROVAL_CHANNEL`.
4. Invite the bot to both channels. Set the actual user IDs in `SLACK_SUPPLIER_USERS`, `SLACK_CFO_USERS`, and `SLACK_PROCUREMENT_USERS`. Keep supplier identities out of the private buyer channel.
5. Start `npm run slack`. Socket Mode needs no public webhook. Only perform test sends in an explicitly authorized workspace and destination.

The bot checks team/channel/user provenance, verifies the private approval channel, acknowledges Socket Mode envelopes promptly, and deduplicates retries. The model stages a decision; the host alone renders and sends the exact approved terms. An uncertain send is never retried automatically. Reconciliation requires matching bot identity, proposal metadata, text and thread. A new supplier offer invalidates old pending approvals.

Slack state persists in `.dealguard/live.json`; a process lock protects it. Interrupted sends recover as uncertain. Browser review state remains local to the running web process. This prototype has no public authentication, multitenancy, CRM writeback or contract signing.

## Verification commands

```sh
npm run check
npm run build
npm test
npm run demo
```

The default tests and CLI replay make no live provider calls. They cover financial boundaries, approval authorization, stale input, duplicate actions, uncertain delivery, SDK session/tool handling, schedule validation, persistence, audio/search contracts, and isolated HTTP security checks. The optional live MentorOS test is skipped unless explicitly enabled.

`npm run verify:agents` is a bounded, billable live smoke check. It attempts to delete its test session afterward. Retained demo sessions are kept for follow-ups; clean them up when the demo is no longer needed.

## Architecture and provenance

- `src/server.ts`: loopback HTTP server, input/origin/path checks, static apps and API routes.
- `src/ecosystem.ts`, `src/ecosystem-types.ts`: custom mentor builder, shared profile, persistence and exact council approval.
- `src/council.ts`: distinct hosted mentor sessions, peer review, bounded tools and synthesis.
- `src/mentor-media.ts`: actual image analysis and private generated-image storage.
- `src/mentor.ts`: persistent daily coaching session, plan validation, local approval and ICS.
- `src/providers.ts`: bounded OpenAI audio and native Exa requests.
- `src/agent.ts`, `src/engine.ts`, `src/domain.ts`: DealGuard lifecycle, policy and exact actions.
- `src/slack-native.ts`, `src/slack.ts`: native Slack transport and verified channel actions.
- `web/mentoros/`, `web/dealguard/`: original responsive browser interfaces.

The supplied plans and DealGuard foundation existed before this implementation pass. This pass added the two browser interfaces, MentorOS service, voice/search providers, original portraits, native Slack transport and integration verification. Visual direction was informed by public Ramp procurement illustrations; no Ramp branding or source assets were copied.

Official references: [OpenAI Agents API](https://developers.openai.com/api/docs/guides/agents-api/overview), [application function tools](https://developers.openai.com/api/docs/guides/agents-api/tools/functions), [OpenAI audio](https://developers.openai.com/api/docs/guides/text-to-speech), [Exa search](https://exa.ai/docs/reference/search), [Slack Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/).
