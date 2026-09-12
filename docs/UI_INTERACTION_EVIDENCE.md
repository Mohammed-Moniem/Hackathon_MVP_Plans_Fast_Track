# Browser interaction evidence

Observed through the supported computer-use browser on 12 September 2026. Screenshots below are unedited browser captures saved locally through a temporary loopback-only capture form. The bridge makes no external calls and is separate from the product server.

## DealGuard

Actual browser actions: Initial offer → Review offer → Approve & simulate delivery → Changed-term follow-up → Review offer.

Observed: proposed AED 1,040,000 annualized compared with AED 1,080,000 incoming; exact stored counteroffer; one simulated receipt and two conversation messages after approval; 48-month follow-up becomes a hold and explicitly remembers the prior sent counteroffer. No live Slack message. Live agent analysis separately verified after fixing the nine-source validation limit.

## MentorOS

Actual browser actions: Live services → Switch & reset → Disrupt a meeting.

Observed real tool audit: get_day_context succeeded; Exa returned five sources; validate_plan succeeded; propose_plan succeeded; intended turn completed and proposal became pending. Actual live plan: activity 19:45–20:30, dinner 20:30–21:00, TOGAF study 21:00–22:30. No external calendar write.

After layout refinement, actual 390 × 844 phone DOM bounds place the approval button at top 684.18 and bottom 724.18 CSS pixels, with all three before/after changes above it. Pending status and exact proposal are visible. Research drawer shows two complete source sentences and a direct Open Group link; original excerpt remains in a disclosure.

Portraits are original generated assets, not placeholder URLs. Desktop and phone show the same current proposal.

## Saved render set

Under `.vision-loop/runs/two-projects-20260912/artifacts/renders/`:

- ramp-reference.jpg — public procurement product illustrations used as the reference.
- mentoros-before.jpg — observed pre-refinement candidate.
- mentoros-desktop-v2.jpg — current pending live proposal at desktop size.
- mentoros-phone-v2.jpg — current pending live proposal at 390 × 844.
- mentoros-sources-v2.jpg — source drawer at 390 × 844.

Later DealGuard captures and final critic reports will be appended once the remaining UI refinement is complete. Physical microphone capture remains to be checked with presenter speech; live audio API generation/transcription is documented separately.

## DealGuard refinement

Final phone DOM order is comparison → buyer decision → supplier conversation. A visible “Needs approval” shortcut in the header navigates to the exact counteroffer review. Source drawer puts POLICY-001 first and shows the active 48-month condition before historical records; statistics are collapsed after source records.

Historical renders: dealguard-hold-desktop-v2.jpg, dealguard-policy-desktop-v2.jpg, dealguard-desktop-v2.jpg, dealguard-phone-v3.jpg and dealguard-phone-decision-v3.jpg. Final captures: dealguard-desktop-v3.jpg, dealguard-phone-v4.jpg, and dealguard-phone-decision-v4.jpg. At 390 × 844, the actual “Needs approval” link jumps to a decision panel with approval bounds top 737.80 and bottom 780.80 CSS pixels. Its exact counteroffer and approval route are visible above the action. Document width equals viewport width, 390 pixels.

A subsequent actual browser approval saved the live proposal locally; `/api/mentoros/calendar.ics` returned the approved snapshot, saved as `artifacts/mentoros-approved-plan.ics`. A location-based follow-up was then submitted through the browser composer. No external calendar was changed.

That location request asked for a Dubai Marina walking option while preserving the approved dinner, study and bedtime times. OpenAI accepted it, but its connection failed before local tool results. The local state correctly retained the approved plan and reported an interrupted review. Read-only remote inspection confirmed the same accepted turn waiting for `get_day_context`. Recovery is being tested without re-submitting that input; this failure is not represented as a successful follow-up.

## Completed refinement checkpoint — 13:55 Dubai

Recovery completed successfully in the same accepted turn, as detailed in `MENTOR_RECOVERY_VERIFICATION.md`; the earlier “being tested” paragraph is historical. Final location renders are `mentoros-location-desktop-v3.jpg`, `mentoros-location-phone-v3.jpg`, and `mentoros-location-sources-v3.jpg`. The phone approval bounds are top 610.28, bottom 650.28 at width 390 with no horizontal page overflow.

The incorrectly scaled `dealguard-phone-v4.jpg` is excluded from visual evidence. Its replacement, `dealguard-phone-v5.jpg`, was captured after the browser completed its viewport repaint and visually checked at 390 × 844. The separate `dealguard-phone-decision-v4.jpg` was correctly rendered and remains valid for the shortcut destination.

Final export refinement: the UI now exposes **Export approved calendar** while a new suggestion is pending. The coordinator clicked it in the actual browser; the download success message appeared and the new suggestion remained pending. Pending changes are excluded from export. The DealGuard empty-counteroffer reference note is also hidden when no outgoing text exists.
