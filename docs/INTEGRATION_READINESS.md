# Integration readiness — DealGuard and MentorOS

## Coordinator update — 13:44 Dubai

The assessment below is a historical provisioning snapshot. Since it was written, Exa was provisioned through the browser under the user-selected Google account; the dashboard showed $10 in free credits. Its key is stored only in `.env.local` with mode 600. A real search returned five sources, and subsequent MentorOS reviews used actual Exa retrieval. Both apps completed real hosted Agents turns; OpenAI speech generation and transcription completed a live round trip. See `VOICE_VERIFICATION.md`, `DEAL_LIVE_VERIFICATION.md` and `MENTOR_LIVE_VERIFICATION.md` for measured results. Generated coach portraits are integrated with provenance in `IMAGE_PROVENANCE.json`.

Slack runtime credentials remain unconfigured in these apps. The user subsequently confirmed that the existing Slack bot in AI Thinkers belongs to the teammate’s separate build and is already integrated. This supersedes the proposed separate Slack setup; do not duplicate that bot or its channels. `TEAMMATE_UI_HANDOFF.md` describes connecting this UI to the existing bot’s state. Calendar remains approval-backed ICS export; Gmail is only an organizer research connector. No live Slack message, calendar write, publication or Higgsfield generation is claimed for this implementation pass. The MentorOS location-follow-up interruption was subsequently recovered successfully in the same accepted turn; see `MENTOR_RECOVERY_VERIFICATION.md`.

Read-only sidecar assessment, 12 September 2026, approximately 08:55 UTC / 12:55 Dubai. The active contract is `IMPLEMENTATION_TARGETS.md`: build BOTH projects. Older briefs choosing only one project are superseded. Builders were working concurrently; this is a connector/access assessment, not acceptance of their final implementation.

## Decision for the two-hour build

Keep the existing server-held OpenAI integration, native-fetch Exa adapter with explicit missing-key behavior, and approval-backed ICS export. Gmail, Google Calendar and Higgsfield tools are registered in this Codex session, but their authenticated connector access is not a credential or SDK that either local app can reuse. Do not derive app capability badges from plugin availability.

| Service | Evidence observed in this sidecar | Reusable app runtime path | Deadline decision / blocker |
|---|---|---|---|
| OpenAI | Project `.env` contains `OPENAI_API_KEY`; value never printed. No paid/live OpenAI call made by this sidecar. | Existing project server integration; provider/backend owners must verify Agents and audio separately. | Key presence alone does not prove model access or successful requests. User already authorized bounded live checks by the implementation team. |
| Gmail | `gmail_get_profile` succeeded. Two narrow event searches succeeded; only five relevant organizer messages were read in full. | Gmail API with app-owned OAuth client and user consent; no reusable credentials are returned by the connector. | Use only for this organizer-resource lookup. Gmail runtime integration is outside the current HTTP contracts. |
| Google Calendar | `google_calendar_list_calendars({max_results:10})` failed with `FORBIDDEN`: the connection lacks permissions/scopes for this action. No event contents were fetched. | Private calendar access needs app OAuth authorization. An API key alone does not grant access to a private calendar. | Ship ICS export. Do not show “Google connected,” “synced,” or describe the in-app disruption as a Google webhook. |
| Higgsfield | `higgsfield_balance` succeeded: 9,000 credits, `ultra` plan; unlimited trial availability false. Generation tools are registered; no generation submitted. | A separate public asynchronous REST API exists and uses a server-held API key ID/secret. Codex connector authentication and its balance do not establish developer API credentials or API billing entitlement. | Optional static asset production through Codex can yield reusable media; it does not establish a runtime integration. |
| Exa | `EXA_API_KEY` absent in project env files. No Exa-named tool found in `ALL_TOOLS`. | Native `fetch` to Exa Search with server-side `x-api-key`. | Live search blocked until the user provisions access. Return an explicit unavailable/error state; never invent venues or label fixtures as retrieved sources. |
| Slack | `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` absent in project env files. | The transport owner is implementing native fetch/WebSocket integration under the active contract. | Live delivery is blocked by provisioning and an explicitly authorized test destination. A local approval/rehearsal is not proof of a Slack send. |

The local check covered `.env` and `.env.local` only; `.env.local` was absent. Standard Google/Gmail OAuth and documented Higgsfield credential variable names were also absent. This is not a claim about other projects, secret stores, or future server environments. No credentials were copied, modified, logged or placed in this report.

## Discovered connector surface and safe checks

Discovered through `ALL_TOOLS`, using the exact `mcp__codex_apps__` prefix:

- Gmail: `gmail_get_profile`, `gmail_search_emails`, `gmail_read_email`, thread/attachment readers, draft and send tools. Only profile, targeted search and selected organizer-message reads were called; no mail was drafted or sent.
- Calendar: `google_calendar_get_profile`, `google_calendar_list_calendars`, search/read/availability tools and event create/update/delete tools. Only calendar LIST was called. Its missing-scope error does not establish whether another Calendar action would succeed; none was attempted.
- Higgsfield: `higgsfield_balance`, `higgsfield_estimate_image_cost`, `higgsfield_generate_image`, model/catalog tools, audio/video generation, job display/wait tools and hosted website tools. Only balance was called. No workspace selection, website, account, key, upload or generation action was performed.

Gmail and Calendar expose both read and write actions inside Codex. None of the inspected schemas supplies app OAuth credentials or a supported way for the local Node process to invoke this session's `tools` object. Embedding either service requires a separate runtime integration. [Google credential types](https://developers.google.com/workspace/guides/create-credentials), [Calendar authorization scopes](https://developers.google.com/workspace/calendar/api/auth).

## Organizer resources: safe entry point, unverified entitlement

Targeted search was bounded to 1 August–13 September 2026, event/hackathon terms and organizer/partner senders. A second organizer-only search included Exa, credits, API-key, resources and offer terms. Search results were not treated as authorization; attendee/team notices were not opened. The five organizer messages read were:

- “Hackathon check-in - QR code, gear, and portal” — 12 September.
- “Hackathon Logistics & Prep: Your Plan for Tomorrow” — 11 September.
- “Hackathon Prep: Final Checklist for Agents, Everywhere - Dubai” — 10 September.
- “See you tomorrow” — 11 September.
- “You're officially in for Agents, Everywhere: Bots, Channels, & More — Global Hackathon” — 8 September (subject includes a decorative emoji).

These messages point to the event portal and identify Exa among sponsors. No specific Exa credit amount, reusable key, or confirmed entitlement was established from the reviewed messages. No attendee details, message IDs, tracking links, QR payloads or private claim codes are retained here.

The [event portal](https://dubai.aitinkerers.org/hackathons/h_07nKwzMAjWo) loaded in the browser and exposes a **Credits** link to the [event rewards page](https://dubai.aitinkerers.org/hackathon-rewards/hrc_4720e4ed2ba8082ed3ca077732195d41). That navigation reached a sign-in page. This is a public portal navigation URL, not a credential-bearing email link. The rewards contents and terms remain unverified; no sign-in, claim, redemption or account setup was attempted. The web fetcher returned 403 for the portal, so the link and sign-in gate were verified in the browser instead.

Concrete next step: the user can open the rewards page, inspect any Exa offer and its terms, and provision their own Exa key if they choose. The provider owner can then use `EXA_API_KEY` server-side and run one bounded search. Exa's documented runtime endpoint is `POST https://api.exa.ai/search`; preserve actual returned titles/URLs/snippets and distinguish unavailable address or routing data. [Exa Search reference](https://exa.ai/docs/reference/search).

## Google Calendar: honest ICS flow

The current MentorOS contract defines **export only**: `GET /api/mentoros/calendar.ics` for the approved stored plan. It defines no inbound ICS-import endpoint. Describe this as “Download approved calendar plan” and label all initial synthetic records. App approval changes the local saved plan; it does not write to Google.

The user can import a reviewed `.ics` file on Google Calendar's desktop site through Settings → Import & Export, selecting the destination calendar themselves. This is a file transfer, not continuous synchronization. Importing does not carry guests or conference information. No calendar import was executed by this sidecar. [Google ICS import instructions](https://support.google.com/calendar/answer/37118).

For later inbound support, accept only a user-selected calendar export, preview it locally and explicitly handle or reject unsupported recurrence/timezone data. Do not imply import is implemented under the present contract. Full OAuth can wait until the user provisions a Google Cloud project/client, authorized redirect URI, consent and the minimum required scopes. Repairing the Codex Calendar connector would be a separate user action and would not configure MentorOS. [Google credential provisioning](https://developers.google.com/workspace/guides/create-credentials).

Backend/QA handoff: export only the exact approved plan; pending, rejected or stale proposals must not silently replace it. Check date plus `Asia/Dubai` handling, valid event start/end times, escaped text, unique/stable event UIDs and well-formed ICS. Validate locally during QA; do not mutate a live calendar to prove file formatting.

## One optional Higgsfield asset workflow

**Matched fictional Health and Career coach portraits for MentorOS**, delivered as static local assets, is the most direct fit if the asset owner still needs portraits. Use an original fictional adult per coach, consistent light/background/crop, and no personal reference media. Keep names and coach labels as accessible HTML, not baked-in image text. If the existing portrait route already succeeds, skip this alternative.

The installed Higgsfield skill was inspected first. Its live tool metadata advertises `higgsfield_generate_image` with default model `gpt_image_2`, plus a separate read-only `higgsfield_estimate_image_cost` preflight. Availability and balance are verified; model cost, latency and successful output are **not** verified. Generation would require the asset owner to follow the authorized budget and current tool instructions, inspect the results, and save approved files under `/assets/`. Reserve at most a small optional slice of the build window; do not let asset generation block QA. This sidecar performed neither a cost preflight nor a generation job and spent no credits.

Downloaded/static media can be reused by the app without runtime Higgsfield authentication. A live media-generation feature would instead need separately provisioned server credentials, native fetch, submission/polling and error handling; it is unnecessary for these two contracts. The [official Higgsfield API documentation](https://docs.higgsfield.ai/docs) describes key ID/secret authentication and asynchronous requests; its output URLs should not be assumed permanent.

## Coordinator next steps

1. Continue both builders against `IMPLEMENTATION_TARGETS.md`; preserve separate app capability states and verify OpenAI Agents/audio with the already authorized bounded checks.
2. Keep `search:false` / explicit Exa failure until a user-provisioned key passes a real request. Retain the event rewards link as the safe access handoff.
3. Keep live Slack delivery unavailable until tokens, channel/user identities and a specifically authorized test destination exist; require receipt-backed delivery before reporting sent.
4. Finish and locally validate approval-backed ICS export. Do not undertake Calendar OAuth setup or live calendar writes within this sidecar's scope.
5. Optional asset owner may use the portrait workflow if needed; do not duplicate existing generation work. No connector installation is needed for the three discovered plugins.
6. Enforce native fetch and the machine-wide Axios ban in both direct and transitive dependencies. Dependency removal and verification belong to the coordinator/transport owner; this sidecar changed no package files or source.

Only file written by this sidecar: `docs/INTEGRATION_READINESS.md`. No nested agents, external messages, publishing, purchases, account configuration, credential setup or live calendar mutations.
