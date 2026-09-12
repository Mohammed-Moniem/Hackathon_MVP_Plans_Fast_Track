# MentorOS + DealGuard integration audit — 12 September 2026

**Latest parent verification, after the user replaced the key:** OpenAI is now working from OutOfTheBoxJS. Fresh Image 2 meal generation, both regenerated coach portraits, receipt vision, voice round-trip, AI mentor draft, two-mentor council with Exa, daily planner and DealGuard checks passed. The live image needed 137 seconds; generation now has a 180-second deadline, retaining the vision cap. The final suite has 228 passes, one optional live skip, zero failures. See [current API verification](API_VERIFICATION_2026_09_12.md). Credit-blocked observations below describe the earlier audit snapshot.

Independent integration sidecar; repository `/Users/mohammedosman/Downloads/Hackathon_MVP_Plans_Fast_Track`.

**Latest disposition:** all six concrete findings are addressed. DG-01 and DG-02 are fixed by this sidecar in `src/agent.ts`, with **49 targeted agent/engine tests passing** and an isolated type check passing. Parent fixes for MP-01, QA-01, IMG-01 and IMG-02 are verified in source. The parent reports final integrated checks complete: **225 passed, 1 optional live skip, 0 failed**, type check/build/JavaScript syntax passed, and black-box runner **16 passed, 2 explicit skips, 0 failed**. Parent browser verification and restart also completed; details and attribution are in the closing checkpoint. Earlier checkpoints and pre-fix evidence are retained as history, not current failures.

## Verdict and boundaries

The app implements local mentor CRUD, AI mentor drafting, a two-round council, approval memory, a separate daily planner with exact local approval and calendar-file export, DealGuard analysis/rehearsal, speech, receipt analysis, meal images, and an optional standalone Slack transport. **This is not a fully connected Slack/Google Calendar/Gmail application.** OpenAI and Exa configuration is present; account access, funding and successful current provider requests are not established by this sidecar.

The teammate's already-integrated Slack bot remains the owner of real Slack state, approvals and delivery. Do not install or start a second bot. The local web app does not read that bot's store and cannot approve or send its proposals. A same-origin adapter to the existing bot is described in `docs/TEAMMATE_UI_HANDOFF.md:3–29`; no such connection is implemented here.

Progress, long-term goals and check-ins are **paused and not integrated**. `docs/PROGRESS_CONTRACT.md` is a proposed contract, not evidence of existing endpoints. No progress imports, routes or service use were found under current `src/` and `web/`. See `docs/APP_STRUCTURE.md:3–13`.

The initial review wrote only this document. The parent subsequently explicitly authorized fixes in **`src/agent.ts` and `test/agent.test.ts` only**, in addition to this document; those are the sidecar's only repository writes. No environment files, real runtime stores, running app, browser, connector account or external system were changed. No provider calls, external messages, generation jobs or calendar actions were performed. Source/test snapshots and synthetic test stores were created only in temporary directories. Other workers changed files concurrently; the verification checkpoints below identify the scope of each result. The external `app-shell.css` diff was preserved.

Image generation must use **gpt-image-2**. The parent owns image-model enforcement, asset provenance, provider-error handling and bounded live checks. A concurrent parent change switched the source default to `gpt-image-2`, high quality, 1024×1024 and added returned provenance. That is a source-level configuration change, not proof that existing portraits or stored images were generated with that model. This sidecar neither generated nor certified images.

## Evidence levels and verification

- **Local tested:** actual application code exercised with synthetic state and/or an isolated loopback HTTP server.
- **Mocked provider:** application logic and, where indicated, the installed OpenAI SDK exercised against injected responses; no hosted execution, provider billing or external delivery.
- **Historical actual:** earlier project verification documents report successful provider work. Those documents were read, but their provider calls were not repeated and the real runtime store was not inspected.
- **Static only:** implementation inspected without a successful execution of that path in this sidecar.

Initial snapshot: Node **v24.18.0**, `node scripts/test.mjs`, **194 tests: 193 passed, 1 optional live test skipped, 0 failed**; TypeScript `--noEmit` passed. The test runner was executed from `/var/folders/mf/whrnsbb55693nqy2nkxy1glm0000gn/T/mentoros-integration-audit-afxbvtqo`. Its log is `test-output.log` there. This snapshot predates the parent's image/provenance changes and must not be used to call those changes green.

Execution isolation: copied `src`, `test`, `scripts` and `web`; reused installed dependencies through a symlink; did not rebuild the real app. The environment contained no inherited credentials, disabled `MENTOR_LIVE_CHECK`, and installed an external-fetch rejection guard. SDK/provider fixtures explicitly inject their own in-memory transports. HTTP tests start their own child on loopback port 3211 in a temporary working directory, first refuse an occupied port, disable outbound fetch inside that child, and clean up only their own process/store. See `scripts/test.mjs`, `test/server.test.ts:28–83`, `test/mentor.test.ts:369–400`.

Three additional in-memory SDK probes used synthetic events, an in-memory DealGuard `Store`, and an injected OpenAI fetch implementation. They confirmed DG-01 and DG-02 below. They produced no approvals, sends or filesystem-backed DealGuard state.

**Concurrent-change verification checkpoint:** a refreshed snapshot at `/var/folders/mf/whrnsbb55693nqy2nkxy1glm0000gn/T/mentoros-integration-audit-final-wyu_04cd` initially reported **195 tests: 191 passed, 3 failed, 1 skipped**; the three failures represent two leaf failures plus the enclosing HTTP test. TypeScript passed. The leaf failures were missing image request-ID provenance and an HTTP persistence assertion comparing stored business state to a newly enriched response. The parent subsequently changed image header handling; these failures must be reconciled against the final checkpoint below rather than assumed current or silently ignored.

## Complete HTTP API inventory

There are **27 implemented method/path combinations**, with parameterized image/mentor paths counted once each. Unknown API routes fail; static app navigation is separate. Route references below are in `src/server.ts`.

| Method and path | Implemented behavior | Evidence and limit |
|---|---|---|
| `GET /api/status` | Configuration booleans; `slack:false`, `calendar:'ics-export'`, `gmail:'not-connected-to-app'`, local-demo flag. | Local HTTP tested; never a provider health probe. Line 135; `test/server.test.ts:159`. |
| `GET /api/ecosystem/state` | Mentor roster, shared profile, current council, approval memory, capabilities; parent adds derived image config. | Local HTTP/service tested. Line 136; persistence projection regression noted below. |
| `GET /api/ecosystem/images/:id` | Read a bounded, private local generated PNG by validated UUID. | Local HTTP and filesystem tests; no provider call. Lines 137–142; `test/server.test.ts:646`, `test/mentor-media.test.ts:355–402`. |
| `DELETE /api/ecosystem/mentors/:id` | Remove an existing mentor, keep at least two, invalidate pending context. | Local HTTP/service tested. Lines 143–145; `test/ecosystem.test.ts:10–15`. |
| `POST /api/ecosystem/vision` | Validate raw PNG/JPEG/WebP, max 6 MiB; run receipt/image analysis, with one concurrent analysis job. | Input/missing-key HTTP tests; SDK request/output tests mocked. Lines 146–150. Historical actual extraction in `docs/ECOSYSTEM_VERIFICATION.md:10`. |
| `POST /api/ecosystem/mentor-draft` | One concurrent AI draft; strict profile output remains editable and unsaved. | Missing-key/input HTTP tested. Parent added three installed-SDK mock tests covering service success/save, invalid/refused/incomplete output, quota and timeout; reports all three passing. Successful HTTP dispatch remains a coverage gap. Line 155; `src/ecosystem.ts:58–68`; `test/ecosystem.test.ts:22–58`. |
| `POST /api/ecosystem/mentors` | Create without an ID or update an existing ID; validate fields/tools/color; max 12. | Local CRUD/restart/input tests. Line 156; `src/ecosystem.ts:12–18,55`. |
| `POST /api/ecosystem/profile` | Validate AED financial amounts/preferences, persist, invalidate pending council. | Local HTTP/service tested. Line 157; `test/server.test.ts:495`. |
| `POST /api/ecosystem/council` | Validate 2–4 distinct existing mentors, run actual hosted orchestration when configured, persist live trace/current decision. | Missing-key/input HTTP; orchestration mocked at service/runner level; historical actual councils separately documented. Line 158; `test/council.test.ts`. |
| `POST /api/ecosystem/decision` | Approve/reject current unchanged pending council; approval appends memory; repeated same decision is idempotent. | Service tests with injected council; HTTP invalid-ID/action tests. No purchase, booking, send or planner write. Line 159; `test/ecosystem.test.ts:11–14`. |
| `POST /api/ecosystem/meal-image` | One concurrent standalone generation; return local image URL. | Missing-key/input HTTP, mocked image SDK and local storage tests; parent owns model/provenance acceptance. Line 160. |
| `GET /api/dealguard/state` | In-memory web negotiation/proposals/evidence/audit; truthful disconnected Slack flag. | Local HTTP tested. Line 162; `src/server.ts:23–60`. Not the teammate bot's live store. |
| `POST /api/dealguard/reset` | Replace only the web process's in-memory scenario with explicit replay/live mode. | Local HTTP tested. Lines 183–188; does not reset teammate Slack state. |
| `POST /api/dealguard/message` | Rehearse two labeled fixtures or run live Agents analysis of custom text; invalidate old proposals. | Replay HTTP; installed-SDK mocked stream tests; historical actual initial live offer. Lines 62–88,188. |
| `POST /api/dealguard/approve` | Replay approval and simulated receipt using `LOCAL-DEMO`; reject live browser approval. | Replay HTTP; role/exact-payload engine tests. Lines 190–192. Real supplier delivery unavailable here. |
| `POST /api/dealguard/reject` | Reject current pending web proposal using the local identity. | Local HTTP/engine tests. Line 194. This never changes a teammate bot proposal. |
| `POST /api/dealguard/reconcile` | Look up simulated web receipt; reject live browser reconciliation. | Local HTTP/engine tests. Line 195. No live Slack receipt query. |
| `GET /api/mentoros/state` | Separate daily-planner store, history, recovery status, export capability, two fixed coach roles. | Local HTTP/service tests. Line 163; custom council mentors do not replace these roles. |
| `GET /api/mentoros/calendar.ics` | Export latest approved nonfixed event snapshot with UTC times and stable scenario/event UIDs. | Actual local ICS tests: approval, retained snapshot, restart, escaping, CRLF and 75-octet UTF-8 folding. Lines 164–167; `test/mentor.test.ts:67–121`. No calendar connection. |
| `POST /api/mentoros/reset` | Explicit replay/live synthetic day reset; locally retire previous hosted session. | Local HTTP/service tests. Line 204. Hosted history is not automatically deleted. |
| `POST /api/mentoros/message` | Persist local request; run replay or one persistent live two-role session; optional area. | Replay HTTP; installed-SDK mocked live/follow-up tests. Line 205. MP-01's input-length mismatch is addressed in parent source. |
| `POST /api/mentoros/disrupt` | Add one local fixed 17:30–19:30 meeting and review the resulting conflict. | Local HTTP/service tested. Line 206; `src/mentor.ts:219–235`. Not a Calendar webhook. |
| `POST /api/mentoros/retry` | Resume only an eligible interrupted accepted turn; no input resubmission. | Mocked recovery tests and negative HTTP test; historical actual recovery documented. Line 207; `test/mentor.test.ts:328–368`. |
| `POST /api/mentoros/approve` | Apply only exact validated current changes, persist an approved export snapshot and memory. | Local HTTP/service tests, including repeated approval and restart. Line 208; `src/mentor.ts:459–471`. |
| `POST /api/mentoros/reject` | Leave schedule/approved export unchanged; record local rejection. | Local HTTP/service tested. Line 209; `src/mentor.ts:473–476`. |
| `POST /api/voice/transcribe` | Up to 10 MiB audio; return text for user editing, no automatic council submission. | Input/missing-key HTTP; actual SDK with mocked transcription transport. Lines 169–173; `test/providers.test.ts:187–245`. Physical microphone not exercised. |
| `POST /api/voice/speak` | Validate up to 2,000 characters and health/career voice preset; return MP3 bytes. | Input/missing-key HTTP; actual SDK with mocked speech transport. Lines 175–181; `test/providers.test.ts:246–330`. Historical audio round trip is not current availability. |

The loopback server validates Host, Origin, fetch-site, JSON media type and body bounds; prevents static traversal/symlink escapes; serves real app deep-link shells; and returns explicit unknown-route errors. These were exercised by `test/server.test.ts`. There is no public authentication/multitenancy layer, OAuth callback, inbound calendar import, Gmail route, Slack webhook in this HTTP server, account-link flow, recurring planner scheduler or progress API.

## Tools, permissions and decision correctness

| Surface | Host-enforced behavior | Tests / remaining qualification |
|---|---|---|
| DealGuard `get_deal_context` | Returns current thread, synthetic records and confirmed previous actions. Now enforces a successful context read before other tools in each turn. | DG-02 fixed; targeted tests reject omitted/invalid context and reuse of previous-turn context. See the implementation checkpoint below. |
| DealGuard `evaluate_terms` | Zod terms, code-computed annualized cost/total commitment and approval policy. Now records successful evaluations of exact terms in the current turn. | Financial boundaries remain covered by engine tests; new regressions require exact incoming/proposed evaluations before staging and permit null-term clarification holds. |
| DealGuard `submit_decision` | Validate known evidence IDs, current context and evaluated terms; one proposal per version; stage only, then promote after verified root-turn completion. | DG-01/DG-02 fixed; wrong session/turn, altered call ID payload, malformed completion and foreign recovery are rejected. Same-turn successful recovery remains covered. |
| Daily `get_day_context` | Required before other daily tools; current local day, constraints, history and prior approval supplied. | `src/mentor.ts:306–340`; mocked order/context tests. Initial data is explicitly synthetic. |
| Daily `search_options` | Requires context; bounded query; actual per-turn Exa results; empty/error search cannot supply evidence. | `test/mentor.test.ts`, `test/providers.test.ts`; live planner requires both OpenAI and Exa configuration. |
| Daily `validate_plan` | Exact before times, fixed events, no overlaps, duration constraints, after-work buffer, maximum feasible study. | `src/mentor.ts:107–135`; `test/mentor.test.ts:89–103`. One fixed day/scenario, not a general calendar engine. |
| Daily `propose_plan` | Exact successful validation fingerprint, valid returned source IDs, both role notes, staged candidate; publish only after completion. | `src/mentor.ts:328–349,408–443`; mocked malformed/stale/incomplete cases. Approval and external actions are not model tools. |
| Council search permission | Advertise `search_options` only for enabled mentors; host also checks every call; max four actual searches and 12 uncached tool calls per run. | `src/council.ts:189–201,223–258,267–272`; `test/council.test.ts:194–260`. Shared source ledger is evidence, not independent browsing access for every mentor. |
| Council vision permission | Only vision-enabled mentors receive the existing attachment analysis directly. | `src/council.ts:174`; `test/council.test.ts:324`. No council vision API tool is executed. Peer proposals may discuss the analysis in the common conversation; this is not a confidentiality barrier between participants. |
| Council image permission | Requires image permission and detected explicit meal-image request; reserve a single shared generation attempt before awaiting; no retry after failure. | `src/council.ts:96–104,196–219`; `test/council.test.ts:333–361`. Parent owns model/provenance. |
| Council session/turn isolation | 2–4 distinct sessions, multi-agent creation disabled, wrong-session/turn and unapproved completed item types rejected. | `src/council.ts:263–320`; dedicated mocks reject shared sessions, wrong turns and built-in capabilities. |
| Council exchange | Round one independent; round two receives every actual proposal; every participant reviews every other exactly once. | `src/council.ts:171–174,377–380,408–421`; tests cover 2 and 4 mentors. It does not fabricate missing participants. |
| Council resolution | Synthesis has no tools; every reported disagreement must have its exact topic; positions replaced with recorded peer evidence; source IDs checked. | `src/council.ts:422–443`; `test/council.test.ts:119–146,262–267`. A synthesized resolution is advice, not proof of unanimous acceptance or an implemented real-world action. |
| Council affordability | Code calculates protected headroom/wellness ceiling; rejects excessive listed wellness alternatives, adds a free option, forces no-spend at zero. | `src/council.ts:141–147,444–477`; tests cover zero/insufficient budget, receipt adjustments and unrelated domains. Free-text advice, real prices and goal classification are not comprehensively semantically verified. |
| Custom mentor CRUD/draft | Manual saves validate bounded fields, enums, IDs, colors and limits; create IDs/timestamps server-side; edits/deletes invalidate a pending recommendation. AI draft only returns unsaved editable fields. | `src/ecosystem.ts:12–18,52–68`; local tests cover CRUD, invalid input, state persistence and invalidation. Parent subsequently added mocked draft success/save, invalid/refused/incomplete output, quota and timeout coverage in `test/ecosystem.test.ts:22–58`; source inspected, three passes parent-reported. |
| Ecosystem approval | Exact run ID, pending status and unchanged profile revision; no active review mutation; approval adds one bounded memory entry. | `src/ecosystem.ts:52–57,70–91`; `test/ecosystem.test.ts:11–15`. Only current run and last 12 approved summaries are retained, not an unlimited council archive. |

Council memory, receipt analysis and the daily planner are separate stores/flows. Receipt extraction does not enter expenses automatically. Council approval does not apply daily-plan changes. Standalone Creative tools routes are explicit user actions, not mentor-specific tool calls, and are not gated by the currently selected mentor's permission switches.

## Runtime integrations and safe configuration inspection

Only names and empty/nonempty presence were inspected with `dotenv.parse`; no values, tokens, lengths, account IDs or key fingerprints were printed. Results refer to the audit shell and project files, not the environment of an already-running server. The app resolves process environment before `.env.local` before `.env`.

| Integration | Project configuration observed | Actual application wiring / remaining runtime requirement |
|---|---|---|
| OpenAI Agents, draft, audio, vision, image | `OPENAI_API_KEY` present in `.env`; `OPENAI_MODEL` present. No inherited audited settings in the sidecar shell. | Server SDK calls implemented. Key presence does not prove current credits, model entitlement or success. Earlier docs record both successful calls and later credit exhaustion; parent owns live determination. |
| Exa | `EXA_API_KEY` present in `.env.local`. | Native `fetch` adapter in `src/providers.ts:141–177`, shared by planner and council. Five bounded actual source records per call; no fabricated addresses. Current provider access not checked here. |
| Standalone Slack implementation | `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_TEAM_ID`, `SLACK_SUPPLIER_CHANNEL`, `SLACK_APPROVAL_CHANNEL`, `SLACK_SUPPLIER_USERS`, `SLACK_CFO_USERS`, `SLACK_PROCUREMENT_USERS` declared empty. | `src/main.ts` can launch the repository's separate Slack program; it was not launched. Web server never creates it and hard-codes Slack false. Teammate's already-integrated bot must be adapted, not duplicated. |
| Google Calendar | No app Google OAuth settings found among audited standard names; no corresponding source adapter or routes. | Approved `.ics` download only. Missing app-owned OAuth/consent/token lifecycle, Calendar API client, account state and sync/webhook handling. These are unimplemented scope, not a broken implemented sync. |
| Gmail | No app Gmail OAuth settings found among audited standard names; no corresponding adapter or routes. | No app runtime email read/draft/send integration. Codex Gmail connector registration does not supply app credentials. |
| Higgsfield / other Codex media tools | Not used as app runtime code. | Not an alternate implementation of the required image model. Parent's generation/provenance work remains separate. |

Additional present names were `AGENT_TIMEOUT_MS` and `DEALGUARD_STATE_PATH`; values were not read out. Audited but absent optional names included planner/council/builder/vision/image/audio model overrides, `PROVIDER_TIMEOUT_MS`, `MENTOR_STATE_PATH` and `PORT`. `MENTOR_STATE_PATH` configures the daily planner only; ecosystem defaults to `.mentor/ecosystem.json`, while images use `.mentor/images`.

Gmail and Google Calendar tool names are registered in this Codex session, confirmed by tool metadata only. None was invoked. Historical `docs/INTEGRATION_READINESS.md` reports successful organizer Gmail research and a Calendar missing-scope error; neither proves current connector connectivity or application integration. Do not copy Codex connector authentication or equate fixing a Codex Calendar scope with linking MentorOS.

The optional Slack implementation uses native fetch/WebSocket, Socket Mode ACK-before-work, bounded reconnect, team/channel/user allowlists, a private approval channel, serialized proposal actions, exact approved text and metadata, persisted send intent, uncertain-delivery holds and receipt reconciliation. Tests in `test/slack-native.test.ts:119–422`, `test/slack-events.test.ts`, and `test/engine.test.ts` use mock HTTP/socket/sender implementations. No real workspace scope, bot membership, actual supplier delivery, Slack thread-history permission or teammate state parity was verified. `slack-manifest.json` defines scopes/events; `src/config.ts:5–27` validates configuration; `src/slack.ts:11–49,108–160` implements sender/authorization; `src/store.ts:13–39` handles interrupted sends and process lock.

The dependency lockfile contains no banned HTTP-client package entry/reference in package dependencies. The inspected app adapters use native fetch or the OpenAI SDK; no dependency changes were made.

## Concrete actionable findings

### DG-01 — P1, resolved: DealGuard accepted an old tool turn or a changed session as current output

Pre-fix evidence: original `src/agent.ts:69–80` overwrote `thread.sessionId` from every event, overwrote the active turn on a turn-created event, and did not check a function action's `turn_id`. Original `handleTool` at lines 136–166 validated local offer version but not the expected session/turn. Recovery at lines 111–122 also trusted retrieved turn status without validating returned identity. The implementation checkpoint below supersedes these old source locations.

Pre-fix installed-SDK reproduction: emit session A/current turn, valid context and evaluation, then `submit_decision` with `turn_id = audit-OLD-turn`; end current turn normally. The result was **pending**, with a successful tool result addressed to the old turn. A separate probe changed the submit/completion session to B and also received **pending**, with stored session overwritten to B. All IDs/data are synthetic; zero sends or approvals occurred.

Original impact: output could be attached to the wrong accepted turn/session and offered for human approval. Existing money/policy checks still ran, so this was not a demonstrated automatic-send or policy-limit bypass. The implemented fix captures immutable expected session/turn identity and rejects mismatched events, actions and recovery objects. Recovery cannot convert a protocol rejection into success. Regressions cover both traces and foreign recovery; the agent suite now has 30 tests.

### DG-02 — P2, resolved: DealGuard's required evidence read was only a prompt instruction

Pre-fix evidence: instructions required `get_deal_context` first every turn and evaluation before submitting (`src/agent.ts:31–38`), but the original dispatcher at lines 140–153 permitted immediate `submit_decision`. Known evidence IDs were already exposed in the tool schema at line 26. The implementation checkpoint below supersedes the old dispatcher behavior.

Pre-fix installed-SDK reproduction: session/turn created → `submit_decision` with schema-valid terms and known fixture IDs → turn completed, with **no context or evaluation calls**. Result was **pending**. The engine recalculated financials/policy, so arithmetic and authorization were still protected; the missing guarantee was that cited source records and current conversation/previous actions were actually supplied before proposing.

Implemented fix: require a successful context read for the exact current turn and successful evaluation of each exact non-null incoming/proposed term set before staging. Regressions prove a known source ID, failed evaluation or previous-turn context cannot substitute for these prerequisites.

### MP-01 — P2, parent fix observed: Daily planner accepted drafts that its message API rejects

Pre-fix evidence: `web/mentoros/index.html:126` set the daily message textarea to 6,000 characters; `web/mentoros/app.js:347–352` submitted without a length check. `src/server.ts:112,205` and `src/mentor.ts:214` accepted only 4,000. The passing HTTP test at `test/server.test.ts:213` explicitly verifies rejection of 4,001 characters. Transcription appended provider text programmatically without a length guard, so it could exceed even the textarea's HTML maximum. Parent's source fix is recorded below.

Impact: a draft the UI allows, or an appended voice transcript, cannot be submitted and receives the generic invalid-field error. The draft is retained; no calendar mutation occurs. Fix by aligning the UI to the API limit, showing remaining/over-limit state, disabling submit until edited, and preserving the full transcript in an explicit edit/shorten flow. The council's separate 6,000-character allowance should remain separately defined.

### QA-01 — P2, parent fix observed: Enriched ecosystem response invalidated a persistence equality assertion

Pre-fix concurrent parent addition: `src/ecosystem.ts:51` derives `imageGeneration` only in `getState()`. The previous `test/server.test.ts:463` deep-compared raw persisted business JSON to the enriched API response. The refreshed suite failed there even though mentor fields were saved correctly; later delete/restart assertions in that same subtest were therefore not reached in that run. Parent now compares the persisted projection and checks configuration separately, as recorded below.

Fix the test to compare the persisted projection and assert derived configuration separately, including a restart/config-change check. Do not persist configuration merely to satisfy a stale assertion. This is an automated acceptance regression, not evidence that the CRUD operation lost user data.

### Parent-owned image checkpoint

The refreshed suite also caught missing returned `requestId` provenance: the response-size wrapper discarded `x-request-id`, while generation consumed `.withResponse().request_id`. The parent added bounded allowlisted header forwarding in `src/mentor-media.ts:101–105`; the final isolated checkpoint **passes that regression**. The later IMG-01 fix enforces the image2 model family before generation. Existing asset provenance and actual generation remain parent acceptance items. This resolved intermediate failure is not an outstanding bug.

## Remaining verification gaps and prioritized next work

1. Parent reports the final full suite, build, type check, JavaScript syntax checks, black-box runner, browser check and restart complete; see the closing checkpoint. The sidecar's independently run 49 passing agent/engine tests establish the DealGuard fixes only; broader integrated results are explicitly parent-reported.
2. No concrete audit bug remains unaddressed in inspected source. DG-01/DG-02 are locally regression-tested; MP-01/QA-01/IMG-01/IMG-02 are parent fixes whose source was inspected. The previously missing AI-draft service cases now have three mocked tests, reported passing by the parent.
3. Successful mocked HTTP draft, council/decision and voice dispatch remain coverage opportunities before claiming every successful HTTP path is verified end to end. Service/provider tests and historical live evidence do not exercise every successful HTTP path together.
4. Parent should record bounded provider evidence separately. Historical success evidence: `docs/ECOSYSTEM_VERIFICATION.md:7–14` (builder/councils/receipt/image), `docs/MENTOR_LIVE_VERIFICATION.md:3–7` (two planner turns), `docs/MENTOR_RECOVERY_VERIFICATION.md:5–17` (same-turn resume), `docs/DEAL_LIVE_VERIFICATION.md:3–30` (one initial offer), and `docs/VOICE_VERIFICATION.md` (audio/Exa). Later `docs/ECOSYSTEM_VERIFICATION.md:37–41` reports exhausted credits. Current parent-reported OpenAI preflight remains credit-blocked; Exa succeeded. No new provider work was performed by this sidecar.
5. If runtime integration is commissioned later, inspect the teammate's actual source/response contract and verify UI/bot thread version, exact proposal and real receipt parity using that existing bot. Google Calendar/Gmail linking would require separate app integration work. Keep ICS and disconnected capability labels truthful meanwhile.
6. Keep progress/goals/check-ins paused. Do not count draft contracts or archived code as existing verified functionality.

## Final verification checkpoint

At **2026-09-12 11:26:12 UTC**, fresh isolated snapshot `/var/folders/mf/whrnsbb55693nqy2nkxy1glm0000gn/T/mentoros-integration-audit-checkpoint-sho34yx2`:

- **196 tests: 193 passed, 2 failed, 1 skipped.** The two failed entries are one leaf failure, `ecosystem custom mentor create, edit and delete persist across restarts`, plus its enclosing HTTP integration test. QA-01 is the single remaining root cause in this suite.
- **TypeScript `--noEmit`: passed.**
- The parent-fixed image request-ID test passed; the added council provenance contract test also passed. These remain mocked provider results.
- Every copied file under `src/`, `test/` and `web/` was compared with the working tree after execution: **no changes during this final check**. Subsequent parent changes require their own checkpoint.
- Logs: `tests.log`, `typecheck.log`; exact file hashes: `source-manifest.json`, all inside that temporary snapshot. The test runner used freshly transpiled source, not a stale production build.

Outstanding findings at that historical checkpoint were **DG-01, DG-02, MP-01 and QA-01**. Their subsequent disposition is below. Passing tests do not establish real Slack, Calendar or Gmail connectivity, current OpenAI funding, or provenance of previously generated images.

## Authorized DealGuard fixes and targeted verification

The parent expanded write scope to `src/agent.ts` and `test/agent.test.ts`; no other application/test file was edited by this sidecar.

- **DG-01 resolved:** per-run expected session and turn cannot switch after identification. Session events, function-call turns, root-turn resources, completion status, creation time and recovered session/turn/action identities are checked. Repeated call IDs must preserve their semantic payload; JSON property ordering alone is allowed. Foreign protocol data cannot enter recovery and become a successful proposal. Recovery is limited to connection/stream interruption, reattaches without resending input, and uses only the expected session for cleanup. The original 12-call budget now also applies to recovery dispatch.
- **DG-02 resolved:** a successful current-turn context read is mandatory before evaluation or submission. Each non-null incoming and proposed term set must exactly match a successful evaluation in the same turn. Failed validation, previous-turn context/evaluations and known evidence IDs alone do not satisfy these prerequisites. Null-term clarification holds remain possible after context; a premature failed submission can be corrected with evaluations and a new tool call.
- **Recovery preserved:** regressions prove promotion after retrieving the matching completed turn and continuation from a pending cached evaluation tool result, including reordered argument keys. No input message is resubmitted and no evaluation is repeated merely because its response was lost.

Final targeted command in isolated snapshot: `node scripts/test.mjs agent engine`. **49 tests passed, 0 failed, 0 skipped**; `node node_modules/typescript/bin/tsc --noEmit` passed; scoped `git diff --check` passed. The snapshot is `/var/folders/mf/whrnsbb55693nqy2nkxy1glm0000gn/T/dealguard-audit-fix-zq74phrh`; logs are `tests.log` and `typecheck.log`. Inherited credentials were absent and default external fetch was blocked; the actual installed SDK used injected synthetic responses. The real repository's `.test-build` was not touched while the parent ran the full suite.

Verified file SHA-256 values:

| File | SHA-256 |
|---|---|
| `src/agent.ts` | `a87ce2f92e098afdd3af335af5e161b25717f0ff1be88be4e96990247ab3c17a` |
| `test/agent.test.ts` | `b09446695c93ffa9f4af4d47f44789611def881b4a6ec1d9f5bfad892056c727` |

Parent-owned fixes observed statically: `web/mentoros/index.html:126` now limits planner drafts to 4,000; `web/mentoros/app.js` uses `MESSAGE_LIMIT`, an over-limit notice, a submit guard and full-transcript retention. `test/server.test.ts:463–468` now separately checks derived image configuration and persisted business state. These address MP-01 and QA-01 in source; this sidecar did not rerun their full/browser validation because the parent owns that checkpoint. No claim is made that the entire concurrently edited tree was verified by the targeted agent/engine run.

## Additional read-only review of image2 and provenance changes

Reviewed `src/mentor-media.ts`, `src/council.ts`, `src/ecosystem-types.ts`, the derived configuration in `src/ecosystem.ts`, and provenance rendering in `web/mentoros/ecosystem.js`, `web/mentoros/app-shell.js` and `web/mentoros/index.html`. No edits to these files, no browser, no provider calls and no restart were performed by this sidecar.

**Parent-reported current provider evidence:** image2 changes compiled; 64 targeted tests passed; `GET models/gpt-image-2` returned HTTP 200; the fresh OpenAI execution preflight returned HTTP 429 `credit_balance_exhausted`; the real Exa adapter returned five Dubai Marina grocery sources. Credits are **not ready yet**. Model metadata availability does not establish successful image generation, usable credit balance, or provenance for older assets. These are reports from the parent, not sidecar network observations. No retry, payment or generation is authorized by this audit.

| Changed behavior | Read-only assessment |
|---|---|
| New generation configuration | Default is `gpt-image-2`, high quality, 1024×1024; one PNG per request. Actual request captures configuration once, so returned provenance and request parameters agree. IMG-01 is fixed: only `gpt-image-2` and `gpt-image-2-2026-04-21` can dispatch. |
| Request-ID forwarding | Size-bounded response reconstruction now forwards only a bounded allowlisted `x-request-id`, preserving `.withResponse().request_id`. Its earlier regression passed the sidecar's final full-snapshot checkpoint. No raw error text/headers are forwarded. |
| Quota handling | Image/vision provider wrapper reads at most 16 KiB of error JSON and maps only known quota codes/types to an application-authored error. One-attempt and bounded-body behavior remains; no provider call was made to retest the real 429. |
| Council propagation | Actual generated URL and optional provenance are validated, added to the tool result, and attached to the saved timeline message. Parent's regression checks both destinations. Permission and single-attempt reservation remain intact. |
| Types / historical data | Optional provenance permits older saved images to load without inventing metadata. New default generation returns provenance. A legacy record's missing model is not silently replaced with the current configured model. |
| Timeline, review and standalone image captions | Model/quality are escaped before HTML interpolation. Older records explicitly say the model was not recorded. Review images inherit provenance from the known timeline URL; arbitrary Markdown targets are not treated as generated images. |
| Configuration label | Standalone label uses `textContent` and says “New images”; library badge says “configured”. Both distinguish requested configuration from old image provenance. IMG-02 is fixed: library model and quality now pass through `esc`. |
| Physical asset provenance | Generation returns request model/quality/size/request ID; council messages persist it. Existing portraits and old image bytes are not independently certified by this change or by model metadata HTTP 200. Parent retains that acceptance task. |

### IMG-01 — P2, resolved in parent source: Unrestricted model override bypassed the required image2 policy

Pre-fix evidence: `getImageGenerationConfig` returned any nonempty `OPENAI_IMAGE_MODEL`; `generateMealImage` spread it directly into the request. A stale override selecting a different supported model could submit that model and truthfully report it, contrary to the user's “images must gpt-image-2” constraint. No such current override was observed in the earlier presence-only inspection; this was a source-level configuration path, not a claim that the current app generated an incorrect model.

Verified parent fix: `src/mentor-media.ts:14` allowlists `gpt-image-2` and the parent-documented `gpt-image-2-2026-04-21` snapshot. `generateMealImage` checks that allowlist at lines 216–225 before entering the provider request or creating image storage, and throws `IMAGE_MODEL_UNSUPPORTED` for incompatible configuration. The read-only configuration getter deliberately still exposes the configured value; it cannot authorize generation. `test/mentor-media.test.ts:416–426` covers four incompatible values, zero provider calls and no storage writes. Source and regression inspected; parent reports final integrated checks passed and malformed configuration failed helpfully before provider dispatch. Old provenance is not rewritten.

### IMG-02 — P3, resolved in parent source: Library model badge inserted configuration as HTML

Pre-fix evidence: `web/mentoros/app-shell.js:380` interpolated `ecosystem.imageGeneration.model` and `.quality` into `region(...)`, which writes `innerHTML`, without escaping. A configured value containing markup could be interpreted as markup in the library badge instead of literal text. This required crafted/malformed server configuration; the audit did not demonstrate a remote attacker path or execute injected content.

Verified parent fix: both dynamic values now use the existing `esc` helper at `web/mentoros/app-shell.js:380`, independently of the generation allowlist. Source inspection confirms the unsafe interpolation is removed. Parent browser verification subsequently confirmed that `<b>audit</b> & "model"` rendered literally with no `b` DOM elements. No browser was used and no CSS was changed by this sidecar.

### Final resolution checkpoint

All six concrete findings are addressed in inspected source. DG-01/DG-02 have 49 passing isolated agent/engine tests and a passing type check. MP-01/QA-01/IMG-01/IMG-02 are parent-owned fixes verified read-only. The three new AI-builder tests in `test/ecosystem.test.ts:22–58` cover editable success with explicit save, invalid/refused/incomplete outputs, quota and timeout; they assert unchanged persisted state on failures and before explicit save, and one provider attempt. The parent reports all three passing; this sidecar did not rerun them.

**Parent-reported final integrated validation:** 225 tests passed, one optional live test skipped, zero failures; type check, build and JavaScript syntax checks passed. The black-box runner reported 16 passes, two explicit skips and zero failures, with zero outbound requests and all child processes stopped. Browser verification rendered the malformed model string literally without creating `b` elements, and generation rejected it helpfully before provider dispatch. Parent restarted the main app on port 3210 in idle state, confirmed saved ecosystem and planner state were exactly preserved, verified gpt-image-2/high runtime configuration, and restored the initial replay. These integrated, browser and runtime observations come from the parent; they were not repeated by this sidecar.

**Remaining integration limits:** the successful HTTP-path coverage distinctions in the matrix remain; passing mocked and black-box checks do not certify live provider behavior. OpenAI execution remains blocked by the parent-reported exhausted credit balance; model metadata HTTP 200 does not remove that blocker. App Slack/Google Calendar/Gmail wiring remains incomplete as described above. No additional concrete correctness bug remains open from this audit. This sidecar introduced no duplicate bot, live provider call, environment/runtime change or paused progress feature. Its only repository edits are `src/agent.ts`, `test/agent.test.ts` and this report.
