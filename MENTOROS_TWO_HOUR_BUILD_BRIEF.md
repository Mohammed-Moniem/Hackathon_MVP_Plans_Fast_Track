# MentorOS: coaches, voice, imagery and search

Current proposed scope, 12 September 2026. The user explicitly switched from DealGuard to MentorOS and requested image generation, voice APIs for coaches, and Exa for internet/location search. The original two-hour limit remains in force; planning does not restart the clock. Target remains approximately 14:25 Dubai. This document revises the plan; it does not claim implementation or verified API access.

## Product and scope

**Two coaches help you recover a disrupted evening, find practical options, and approve one workable plan.** Health is the lead coach; Career protects a concrete study goal. Keep one user, one day, one intervention, one approval and one follow-up. No Finance coach or marketplace in this build.

The strongest moment: the user says a late meeting moved their evening and specifies an area. Health proposes a shorter activity; Career protects a study block. The system checks schedule feasibility and searches for a relevant venue or resource. It presents one joint plan, explains it aloud, and saves the approved changes. A subsequent correction updates that same plan using the previous decision.

## Required capabilities

| Capability | Two-hour implementation |
|---|---|
| Coach imagery | Generate two original fictional coach portraits once and cache them as assets. Build-time generation uses Codex's integrated image-generation tool. This is generated artwork, not a live video avatar or a claim of runtime personalization. |
| Voice input | Push-to-talk recording with a short clip, OpenAI transcription, visible transcript, and typed-input fallback. |
| Coach voices | OpenAI text-to-speech for short, dynamically generated responses; distinguish the two coaches with built-in voices. Show captions and an AI-voice label. Only one coach speaks at a time. |
| Reasoning | OpenAI Agents API, one persistent session per user/demo scenario. Two coach-specific assessments feed one joint proposal. Label them as coordinated coach roles; do not claim independently running agents unless implemented. |
| Exa search | A server-side native fetch tool retrieves a small set of relevant web results, such as venues in the user's stated area or a study resource. Return title, source URL, relevant excerpt and retrieval time. |
| Locations | Start with the city/neighbourhood supplied by the user. Include it in the query, show sourced addresses where available, and provide a Maps search link. Precise location access, routing, travel-time computation, live opening status and booking are outside this scope. |
| Action | Approval updates the application's real stored plan and produces a downloadable calendar file for the proposed blocks. It is calendar export, not direct calendar synchronization. |

Voice defaults to a transcription/agent/speech pipeline. This reuses the Agents API as the reasoning layer and avoids adding a second realtime conversation orchestrator within the deadline. Continuous speech interruption, custom voice cloning and animated talking portraits are deferred.

If runtime image generation becomes a specific requirement, make one asynchronous, cached visual an explicitly scoped addition; do not insert image generation into every coaching turn. Do not depict generated images as photographs of real Exa-discovered venues.

## One complete demonstration

1. Open a day plan with explicit study, activity, meal, fixed-commitment and bedtime constraints. History and any supplied demo calendar records are visibly labelled synthetic.
2. Change the meeting time in the planner. The change triggers conflict detection without a separate chat prompt. This is an actual in-app event; do not label it as a Google Calendar webhook.
3. User supplies a short voice clarification, for example: “I will be in Dubai Marina. Keep time for studying and find somewhere suitable for a short indoor activity.” This is illustrative wording, not a fact about the user's location.
4. Health and Career produce concise contributions. Code validates overlaps, fixed commitments and any move to tomorrow. If there is no feasible compromise, ask the user to choose a constraint to change.
5. The agent calls Exa for a relevant venue/resource and shows the actual sources. Only include a venue in the schedule when enough information is available; otherwise present it as an option to verify. Use explicit configurable buffers rather than claiming computed journey times.
6. Present a before/after plan with one shared rationale. A short spoken explanation accompanies the result, and captions remain available.
7. User approves. Persist the exact proposal, update the timeline, and enable calendar export. A later request such as “Keep the workout at home instead” revises the same session and requires fresh approval before changing the saved plan.

This goes beyond spoken question-answering: the live planner event, constraints, sources, approved state changes and follow-up continuity are visible. Its integration claims must remain limited to what actually ran.

## UI direction

Retain the user-selected Ramp reference's observed visual treatment: warm neutral background, white panels, restrained typography, fine dividers, prominent key values and compact status labels. Adapt the composition to a personal planner: two coach portraits, today's timeline, a joint-proposal panel, voice controls and an evidence/places drawer. Use MentorOS branding and original artwork.

Provide recording, transcribing, searching, thinking, speaking, approval-pending, saved, empty-results, failed and disconnected states. Expose stop playback, editable transcription and working source links. No idle control should imply a connection that has not been verified. Vision-loop review should assess this revised journey, rather than the superseded procurement layout.

## Minimal technical shape

Keep one local Node/TypeScript app, a small web frontend, local JSON persistence and server-held API keys. OpenAI audio endpoints handle input/output around a persistent Agents API session; native fetch calls Exa. Proposed tool surface: `get_day_context`, `search_options`, `validate_plan`, `propose_plan`. Approval and calendar export are application actions, not model-granted authorization.

Reuse the existing project's useful session lifecycle and validation patterns only where they fit. Procurement data, policy and approval identities do not transfer into MentorOS. Remove the Slack dependency path from the active MentorOS application so it does not retain the banned HTTP client. Address the observed local development-runner permission problem without disabling security protections.

## Remaining delivery sequence

- First prove one Agents session, one transcription, one spoken response and one Exa response; generate the portraits alongside UI work. Keep usage bounded. Credentials, billing/access and actual latency are currently unverified.
- Build the planner, coach cards, constraint checks, one proposal and saved state before adding polish. Main voice/search/plan journey should work by roughly minute 75 of the original two-hour window.
- Freeze features by minute 90. Use the next 15 minutes for browser checks, current independent visual reviews, failure handling and two rehearsals. Preserve the last 15 minutes for the recording and submission materials.
- If access fails, report the exact failing service. Typed input, captions and cached explicitly labelled rehearsal data keep the UI usable but do not prove the requested live voice/search integration.

Two hours is a delivery budget, not a guarantee of API availability or completed validation. This pivot requires more new work than DealGuard. Cut breadth and optional effects first; do not silently drop voice, search or the approved-plan action.

## Sources and factual limits

- [OpenAI Agents API](https://developers.openai.com/api/docs/guides/agents-api/overview): managed session/tool workflow; account access still requires a live check.
- [File transcription](https://developers.openai.com/api/docs/guides/speech-to-text): recorded audio to text.
- [Text-to-speech](https://developers.openai.com/api/docs/guides/text-to-speech): dynamic speech and built-in voices; disclose AI-generated speech.
- [Image generation](https://developers.openai.com/api/docs/guides/image-generation): image generation/editing APIs. Static generated coach art is the proposed minimum here.
- [Exa Search](https://exa.ai/docs/reference/search): web search and retrieved source content. The reviewed contract does not establish a places-routing or booking workflow; no such capability is assumed.
- [Hackathon rubric](https://dubai.aitinkerers.org/hackathons/h_07nKwzMAjWo): functionality, theme, integration and useful agent experience remain the judging targets.

The original `MentorOS_Hackathon_MVP_Plan_Fast_Track.md` remains the vision source. Correct its unsupported predicted adherence claims, ensure the sample calendar really forces the demonstrated tradeoff, and describe synthetic history as history rather than validated prediction.
