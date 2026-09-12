# Independent visual-system critique

Verdict: **FAIL overall**. **DealGuard: PASS for the observed visual system, with a mobile hierarchy improvement. MentorOS: FAIL for mobile decision hierarchy and source presentation.**

Reviewed on 2026-09-12 using only mcp__cua_repl for UI inspection. No source code, APIs, previous critiques, or app-state mutations were used. No messages, resets, mode changes, approvals, rejections, disruptions, coach selections, or audio actions were performed. Only scrolling, evidence drawers, keyboard focus, and temporary browser viewport changes were used. This is a visual review of the states encountered, not functional acceptance.

## Observed renders and state

| App | Desktop evidence | Phone evidence | State encountered |
| --- | --- | --- | --- |
| DealGuard | Actual 1280 × 720 initial screenshot: slim navigation rail, off-white header/canvas, white comparison and recommendation panels, amber commitment-change banner | Actual 390 × 844 screenshots: overview, three-column terms table, conversation/form, recommendation, evidence drawer, keyboard focus | Replay, Offer v2, 48-month supplier commitment, policy hold, nine evidence records |
| MentorOS | Actual 1280 × 720 initial screenshot: sidebar, day summary, planner, two portrait cards, conversation header | Actual 390 × 844 screenshots: hero/portraits, schedule, full proposal across scroll positions, approval row, conversation, source drawer, keyboard focus | Live services configured; three suggested changes awaiting approval; one research source |

Both apps visibly use warm off-white backgrounds, white workspaces, charcoal headings, fine separators, modest corner radii, and subdued accent colors. DealGuard's amber hold treatment and MentorOS's green health/amber career schedule cards fit the requested system. Mira's portrait is labeled Health coach; Atlas's portrait is labeled Career coach. Both portraits render at desktop and phone sizes without visible distortion.

At 390 px, read-only rendered DOM measurements returned document clientWidth = scrollWidth = 390 for each app. No horizontal page overflow was observed in the inspected sections. This does not certify every viewport or unvisited state. Main headings and body content were visually legible; small metadata is subdued. No numeric contrast audit was performed.

## Largest concrete gaps

1. **P1 — MentorOS loses the pending-decision summary on phone and buries approval.** Desktop explicitly shows “Your next step / Review 3 suggested changes” and “Your approval needed.” The phone summary shows only commitments and personal hours. Portraits precede the planner, then the complete schedule precedes an 885 px proposal panel. In the observed 390 × 844 render, that panel starts at document y=1809 and “Approve these changes” starts at y=2554. The only early cue is “Proposed plan 3”; it does not replace the explicit pending-approval signal. Preserve a compact pending-review summary near the mobile hero with an in-page link to the decision. Keep exact changes immediately above approval and put the longer coaching rationale behind a disclosure. Pass when pending approval is evident before scrolling through the full day and its explanatory prose.

2. **P2 — MentorOS displays raw research extraction as the source presentation.** The phone source drawer repeats the TOGAF title inside the body, includes literal “#” markers, “Availability Read the HTML Edition Online Login to Download Details Additional Information Standards Information,” and ends mid-word at “intende.” Its footer discusses “opening hours” for a publication source. These are visible content defects in an otherwise clean drawer. Show a short readable excerpt or summary with the source link, move raw extraction behind a disclosure if needed, and use source-appropriate footer wording. Pass when the source card has one title, coherent body text, and no scrape-navigation debris or abrupt word truncation.

3. **P2 — MentorOS's proposal prose exposes internal terminology and duplicates coach labels.** The visible plan includes “deterministic validation's maximumStudyMinutes” and “Current local state contains no prior approval to carry forward.” The rendered labels read “Mira · Health Mira (Health)” and “Atlas · Career Atlas (Career).” These inflate a decision panel that already spans more than a phone screen. Use the existing visual name/role labels once and concise user-facing rationale, keeping the actual time changes and approval status explicit.

4. **P2 — DealGuard's mobile recommendation follows the entire conversation and message form.** Its recommendation heading is at document y=1867 in the observed phone state. The initial amber banner does communicate the hold, so this does not block its visual-system pass. Moving the recommendation directly after the commercial comparison, or adding a review jump link, would make the actual buyer decision easier to reach. Desktop's side-by-side comparison/recommendation arrangement is clear.

## Specific checks that passed

- DealGuard's full-width phone evidence drawer keeps the title, close button, statistics, cited policy, and record separators readable. Its blue keyboard focus outline was visible around the scrollable evidence region after Tab.
- MentorOS's full-width phone source drawer has a clear header/close affordance, scrollable content, and a visible muted-green keyboard focus outline on the publication link. These two focus treatments differ in color but remain visible; no failure is assigned merely for that difference.
- DealGuard's monetary figures and all three terms-table columns fit at 390 px. Its unavailable counteroffer is explicitly explained rather than appearing as an unexplained blank.
- MentorOS's two coach cards remain coherent side by side at 390 px, with names and roles beneath the portraits. Changed schedule blocks wrap within their cards. The approval/reject row fits on one line in the inspected state.

## Evidence handling and limitations

Screenshots were captured with supported CUA getScreenshot()/screenshot() APIs and inspected inline in the tool results. **Artifact persistence was unavailable through the documented CUA screenshot surface; no PNG artifacts were saved and no screenshot file paths are claimed.**

The requested visible:false option reported “IAB visibility is not supported in a subagent thread.” Review tabs were created without a visibility override; no show-browser action was taken. The browser viewport capability initially affected only the newest tab. A temporary CDP phone-size attempt on the earlier DealGuard tab produced an incorrectly scaled screenshot; that image was discarded as visual evidence, the override was cleared, and a new owned DealGuard tab produced the verified 390 × 844 screenshots used above. No app defect was inferred from that capture artifact.

Desktop inspection covered the initial rendered workspace; deeper inspection and drawer/focus checks were performed at phone size. Source accuracy, API behavior, live-thinking transitions, approval behavior, and unseen states are outside this review. The coordinator's concurrent work may change the displayed state after this snapshot.
