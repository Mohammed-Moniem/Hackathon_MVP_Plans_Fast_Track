# MentorOS application handoff — 12 September 2026

The existing MentorOS capabilities are now integrated into a routed dashboard application. [Open MentorOS](http://127.0.0.1:3210/mentoros/).

- **Overview** shows the actual current recommendation, approved-day preview, mentors and useful next actions.
- **My mentors** contains the searchable directory, individual profiles and a dedicated creation/editing studio with AI assistance and manual configuration.
- **Council** contains mentor selection, prompt/voice input and actual agent exchanges. **Review recommendation** has the exact proposal, alternatives, source links and local approval.
- **Creative tools** leads to separate image/receipt, meal-image and source workspaces. **Shared context** holds editable preferences and approved memory.
- **Your day** retains the approved schedule, coaching and calendar-file export. The vibrant typography and colors run throughout the app.

Real URLs, browser Back/Forward, deep-link refresh, loading/not-found states, draft preservation, scoped cancellation and delayed-save safeguards are implemented. Phone navigation and manual creation work at 390px; the unavailable AI assistant gives a concise notice above usable fields. Sources, long messages and memory use expandable excerpts. Approval preserves the reader's expanded details and keyboard focus.

**Verified:** 193 automated tests passed, one optional live test skipped, zero failures; type check, build and frontend syntax passed. Actual browser checks covered routing, manual mentor creation/edit/save/reload, draft retention, profile cancellation, isolated keyboard approval, phone forms/navigation, tools/source pages and the retained planner. The main ecosystem and planner files match their pre-correction SHA-256 baselines. All test mutations were in a separate keyless store with outbound provider requests blocked. [Browser evidence](docs/APP_BROWSER_CHECKS.md) · [code review](docs/APP_CODE_REVIEW.md) · [brief review](docs/APP_BRIEF_REVIEW.md) · [craft review](docs/APP_CRAFT_REVIEW.md).

**Existing blocker:** new OpenAI calls remain blocked by the earlier `credit_balance_exhausted` / `insufficient_quota` response. No fresh AI/voice/image/provider success is claimed for this UI correction, and no credits were purchased. The app retains the earlier real councils, Exa sources, receipt result, custom vacation mentor and generated meal image. Physical microphone capture remains unverified. This is a local single-user hackathon prototype using clearly labelled synthetic starting data.

**Next scope:** progress, per-mentor outcomes, feedback, long-term goals and calendar check-ins are intentionally paused until the corrected app structure is reviewed. Their draft work is retained privately under `.verification/paused-progress/` and described in `docs/PROGRESS_CONTRACT.md`. Candidate 003 is reviewable; owner acceptance is not assumed.

[DealGuard](http://127.0.0.1:3210/dealguard/) remains on the accepted procurement layout with the initial replay proposal awaiting review. The teammate owns its separate integrated Slack build; this local UI does not share that bot's state. Google Calendar remains an approved `.ics` export, not synchronization. No external message, booking, purchase, deployment or submission was made.

[Current source ZIP](artifacts/mentoros-app-handoff.zip) · [app structure](docs/APP_STRUCTURE.md) · [teammate adapter handoff](docs/TEAMMATE_UI_HANDOFF.md) · [font provenance](docs/FONT_PROVENANCE.md). The ZIP excludes credentials, runtime data, dependencies and private QA stores. Prior source ZIPs and visual exports remain historical. Current portable visual evidence is in `artifacts/visual-review-app/`.

Restart with `npm ci` then `npm start` on Node 24+. Existing local dependencies and project keys are already configured. Preserve `.env` and `.env.local`; use `.env.example` for a fresh checkout. Mentor state lives under `.mentor/`; DealGuard browser replay resets with the server process.
