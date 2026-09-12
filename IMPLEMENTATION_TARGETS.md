# Two-project build target

Start: 2026-09-12 08:49 UTC (12:49 Dubai). Implementation checkpoint: 09:49 UTC. Testing/refinement checkpoint: 10:49 UTC. User explicitly authorized both projects, parallel subagents, relevant plugins, and reuse of the existing project OpenAI key for bounded live checks.

## Definition of success

- DealGuard: working polished buyer UI, actual Agents API analysis, deterministic costs/policy, exact approval, receipt-backed delivery when Slack is configured; follow-up detects changed terms. A local rehearsal is separately labelled and fully interactive.
- MentorOS: polished planner with generated Health/Career coach portraits, recorded voice transcription, dynamic spoken replies, persistent Agents API analysis, live Exa sources when keyed, approval-backed stored plan, calendar export, and follow-up memory. Search failures never become invented venue data.
- Live service limitations are explicit. No fake connected badges. Connected Codex plugins alone are not embedded app integrations.
- No unrelated external messages, publishing, purchases, broad account changes, or calendar mutations. In-app approval allows requested demo actions by the user; agent-operated live sends need a specifically authorized test destination.
- Native fetch. The banned HTTP dependency path must be removed from the active dependency graph.

## Architecture and worker contracts

Coordinator owns package.json, lockfile, tsconfig files, src/server.ts, shared HTTP plumbing, deployment/run commands, and integration.

Two independent frontend directories: web/dealguard/{index.html,style.css,app.js} at /dealguard/ and web/mentoros/{index.html,style.css,app.js} at /mentoros/. Use plain HTML/CSS/JS with native fetch. Assets at /assets/. No frontend bundler needed. All API responses are JSON except audio and .ics. Errors are {error: string, code?:string}. UI must parse failures.

### DealGuard HTTP contract

GET /api/dealguard/state -> {mode:'live'|'replay', capabilities:{agents:boolean,slack:boolean}, thread: Thread|null, proposal: Proposal|null, proposals:Proposal[], evidence:Evidence[], patterns:object, audit:Audit[]}. Existing src/domain.ts shapes are canonical. mode is set explicitly by POST reset.
POST /api/dealguard/reset {mode:'live'|'replay'} -> state. POST /api/dealguard/message {text:string} -> state after review. POST /api/dealguard/approve {id:string} -> state. POST /api/dealguard/reject {id:string} -> state. POST /api/dealguard/reconcile {id:string} -> state.
GET /api/status -> safe capability metadata. Poll state during ongoing requests; all buttons real. Provide initial example and changed-term follow-up actions, editable supplier input and evidence drawer. Live approval requires authorized transport; never call simulation a Slack send.

### Mentor HTTP contract

GET /api/mentoros/state -> MentorState below. POST /api/mentoros/reset {mode:'live'|'replay'} -> state. POST /api/mentoros/message {text:string,area?:string} -> state after review. POST /api/mentoros/approve {id:string} -> state. POST /api/mentoros/reject {id:string} -> state. POST /api/mentoros/disrupt {} -> state after event-driven review. GET /api/mentoros/calendar.ics -> approved plan export. POST /api/voice/transcribe raw audio with Content-Type and X-Filename -> {text}. POST /api/voice/speak {text,coach:'health'|'career'} -> audio/mpeg.

MentorState = {mode:'live'|'replay', status:'idle'|'thinking'|'pending'|'approved'|'failed', day:string, area:string, capabilities:{agents:boolean,voice:boolean,search:boolean}, coaches:[{id:'health'|'career',name:string,role:string,portrait:string}], events:[{id,title,start,end,kind:'work'|'health'|'career'|'personal',fixed:boolean}], history:[{id,role:'user'|'assistant',text,coach?:'health'|'career',at}], proposal:null|{id,status:'pending'|'approved'|'rejected'|'stale',summary:string,healthNote:string,careerNote:string,changes:[{eventId,title,fromStart,fromEnd,toStart,toEnd,reason}],sources:[{id,title,url,snippet,address?:string}],speech:string}, audit:[{at,type,detail}], memory:string[], error?:string, sessionId?:string}. Times are HH:MM in Asia/Dubai, except history/audit ISO timestamps. Reject invalid/overlapping changes. Synthetic daily history is labelled. Exa sources are actually retrieved. Two logical coach roles, one session; do not claim independent autonomous agents.

Backend worker exports class MentorService with getState(), async message(text,area?), async disrupt(), reset(mode), approve(id), reject(id), calendarICS(). getState/reset/approve/reject synchronous. It owns src/mentor.ts and test/mentor.test.ts. It imports providers.searchWeb returning {id,title,url,snippet,address?}[] and providers.getProviderStatus.

Final recovery/export additions: `POST /api/mentoros/retry {}` resumes an eligible accepted turn without posting a new input; `MentorState.recovery = {canRetry, unresolved}` distinguishes local eligibility from remote verification. `MentorState.calendar = {canExport, approvedAt?}` exposes the last approved export even while a newer suggestion is pending. The UI labels this **Export approved calendar**, and pending changes are excluded. User confirmed the teammate owns the existing Slack-integrated build; this workspace supplies an adapter handoff rather than a duplicate bot installation.

Provider worker owns src/providers.ts and test/providers.test.ts. Exports getProviderStatus() -> {agents:boolean,voice:boolean,search:boolean}, searchWeb(query,area?) -> SearchResult[], transcribeAudio(buffer:Buffer,filename:string,mime:string) -> string, synthesizeSpeech(text:string,coach:'health'|'career') -> Buffer. Native fetch for Exa, official OpenAI SDK for audio. Missing keys fail explicitly. Model environment variables can override documented supported defaults. Keys never in browser or logs. Use bounded requests.

Slack worker owns src/slack.ts and new src/slack-native.ts, test/slack-native.test.ts. Preserve existing createSlackBot and SlackSender public behavior, replace SDK transport with native fetch/WebSocket. No edits to package.json or unrelated engine files. Existing domain/config interfaces apply.

## Visual bar

Reference: Ramp procurement public product illustrations already inspected at 1280x720. Five observed mechanisms: neutral framing + white panels; restrained dark typography; prominent numbers paired with small labels; fine grid/table rules; compact muted status chips. Original branding only. The authenticated app's unseen behavior is unknown. Both apps adapt this calm visual language; MentorOS is a warmer personal planner with original coach portraits. Keep actionable content visible, useful loading/error/empty/success states, keyboard focus, responsive layout, reduced-motion treatment. No marketing landing pages or nonfunctional navigation.

## Expanded ecosystem target

The later user request supersedes the original MentorOS role limit and muted color direction. See [ECOSYSTEM_TARGET.md](docs/ECOSYSTEM_TARGET.md) for candidate 002. The new ecosystem has arbitrary custom mentors, 2–4 distinct hosted sessions with reciprocal peer reviews, shared budget/preferences, real image/receipt tools, meal illustrations, Exa and exact approval memory. The original daily planner remains a separate, retained scheduling surface. Both apps now use vibrant cobalt/teal/coral and self-hosted Space Grotesk/Manrope. Prior candidate visual passes are historical until fresh reviews complete.
