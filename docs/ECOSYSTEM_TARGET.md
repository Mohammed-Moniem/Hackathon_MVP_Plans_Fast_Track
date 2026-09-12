# MentorOS ecosystem expansion — candidate 002

User feedback on 2026-09-12: layouts accepted; refresh vibrant colors and distinctive fonts. Add arbitrary AI-assisted custom mentors and real inter-mentor communication with conflict resolution. Receipt/image analysis, meal image generation, ingredient/location search, voice and shared memory must be working app features.

## Reviewable target

1. Create or edit a mentor for any domain, assisted by AI but fully editable. Save goals, instructions and permitted tools. Existing Health, Finance and Career mentors provide a starting team.
2. Edit the explicitly synthetic shared profile. For gym decisions, calculate spending headroom from income minus essentials and savings; cap by the wellness budget. Do not assume the user can afford a membership.
3. Select two to four distinct agents. Show their actual proposal, peer review, tool use and shared conclusion. Each receives the relevant shared context; conflict resolutions and alternatives identify the trade-off. Internet sources come from Exa. No simulated agent dialogue.
4. Inspect a uploaded image/receipt with uncertain values explicit. Generate a meal illustration through the actual OpenAI image API, show its provenance, and search for ingredients/places using Exa. Treat “exercise API” in the latest message as Exa, matching the earlier agreed search integration; no workout database integration has been claimed.
5. Approve or reject the exact current recommendation. Only approval adds it to shared memory. Profile or mentor changes invalidate unapproved recommendations. This never purchases, books, messages third parties, or changes external calendars.
6. Preserve the existing daily planner and DealGuard journeys. Refresh both apps' type and color without changing the accepted layout mechanisms. Voice capture and generated spoken replies remain available.

## Visual and interaction bar

Retain the observed Ramp mechanisms: white panels on a light neutral surface, clear type hierarchy, prominent values with small labels, fine rules, compact statuses, obvious decision actions. Add a cohesive vivid palette with distinctive, self-hosted licensed fonts. The ecosystem is a working workspace, not a marketing page. Mentor creation resembles a simple GPT builder: Describe → editable configuration → saved mentor. Council messages identify real speakers and recipients. Pending, busy, empty, error and success states are visible. Keyboard dialogs, useful focus, 390px phone reflow and desktop reading hierarchy are required. New evidence must be reviewed; prior candidate passes remain historical.

## Responsibility boundaries

Parent: shared contracts, saved state, builder, HTTP routes, integration and live checks.
Gauss: council orchestration and tests.
Kierkegaard: image analysis/generation providers and tests.
Halley: ecosystem UI and new component CSS, MentorOS index integration.
Maxwell: both existing theme CSS files and self-hosted fonts; DealGuard head metadata.

No public deployment, duplicate Slack bot, external sends or calendar writes. Existing key reuse and bounded live checks are authorized. Original two-hour checkpoint remains 10:49 UTC; prioritize a working, demonstrated ecosystem over additional integrations.
