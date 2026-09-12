# Submission copy — prepared for team review

These are drafts, not published submissions. Add the actual repository and video links after the team reviews and publishes them. The event requirements and deadline should be confirmed in the portal before submission.

## MentorOS — Two coaches. One day that actually works.

**Short description:** A late meeting should not erase your evening. MentorOS brings Health and Career coaching into one persistent agent session that reads the day, searches real sources, and proposes a schedule you can review, hear and approve.

**Demo description:** A meeting runs until 19:30, colliding with activity and dinner. Mira and Atlas negotiate the limited time: 45 minutes of activity, dinner at 20:30, and the full 90 minutes of TOGAF study before wind-down. Exa supplies the supporting sources. Code checks the exact schedule against fixed commitments, overlap rules and the longest feasible study block. The user approves the specific changes and downloads a calendar file. A later request for a walking option in Dubai Marina uses the same session and prior approved plan, returning Visit Dubai and Emaar sources without moving dinner, study or bedtime.

**Why the agent matters:** The same persistent session receives a new event, consults current local state and previous human decisions, calls retrieval and validation tools, and produces a reviewable action. Approval lives in the host application; the model cannot grant it. An interrupted accepted turn was resumed without re-posting the input or losing the approved day.

**Built and verified:** Original responsive interface and fictional generated coach portraits; OpenAI hosted Agents API; native-fetch Exa retrieval; OpenAI speech generation and transcription; persisted local approvals and ICS export. Initial calendar/profile data are synthetic. Two coordinated coach roles share one session. Venue details are suggestions, not confirmed availability or bookings. Calendar export is not Google Calendar synchronization. A physical presenter microphone run remains a final device check.

**90-second narration:** “Your health coach wants an hour. Your career coach wants ninety minutes. Your calendar has other ideas. A late meeting just took the evening. MentorOS reads the conflict, uses real sources, and checks what can actually fit. Here is the compromise: forty-five minutes of activity, dinner, and the full study block, with bedtime protected. I can hear it, inspect its sources and approve the exact changes. Nothing changes before that approval. Now I ask for a nearby walking option. The same session remembers what we approved and changes only the activity choice. This is a coach that can work with your decisions over time.”

## DealGuard — Catch the commitment behind the discount.

**Short description:** DealGuard reviews a supplier’s changing commercial terms in context, computes the actual commitment, and puts an exact counteroffer behind a human approval gate.

**Demo description:** A fictional infrastructure supplier offers AED 1.05 million a year plus setup, conditional on a three-year commitment. DealGuard compares annualized cost and total commitment, reads synthetic historical negotiations and policy, and prepares a specific counteroffer. The private buyer workflow requires the correct approver. A follow-up offering attractive pricing only for 48 months triggers a hard policy hold and retains the prior counteroffer in context.

**Why the agent matters:** The agent interprets changing supplier messages and historical evidence; host code computes money and enforces policy, versioning, identity and exact execution. A new offer invalidates prior pending approvals. An uncertain send requires receipt reconciliation and is never automatically repeated.

**Integration status:** The teammate’s separate build already integrates with Slack, as confirmed by the user. Verify and record the actual offer → private approval → one bot reply → changed-term hold sequence in that build before claiming it in the submission. The UI in this workspace has real hosted Agents analysis and a fully labelled replay delivery path; it is not yet connected to the teammate’s live store. `TEAMMATE_UI_HANDOFF.md` defines that adapter boundary.

**90-second narration:** “The cheapest price can hide the biggest commitment. This supplier reduced the annual price but wants a longer contract. DealGuard reads the offer in the negotiation context, computes the full cost and checks policy. Here is the evidence and the exact counteroffer. Only the required buyer can approve it. After approval, show the actual delivery receipt from the teammate’s Slack build. Now the supplier asks for forty-eight months. The agent remembers our earlier response, and the policy check stops the deal. The system proposes; the right person decides; the host executes the exact approved wording.”

## Recording choices that help the demonstration

- Show the real trigger, specific before/after values, one source, approval consequence and the follow-up. Keep setup screens out of the two-minute story.
- Live reviews measured roughly 67–79 seconds. Use an already completed real run for explanation, or clearly label accelerated waiting in the video. Do not claim instant responses.
- MentorOS is ready to demonstrate locally. DealGuard’s strongest recording is the teammate’s working Slack flow; use this UI after its adapter is verified, or clearly label its rehearsal.
- Preserve provenance: the supplied plans and existing DealGuard foundation preceded this implementation pass. State which functionality was added during the event. Do not describe requested concessions as achieved savings or supplier acceptance.
- Review the final source package, public repository, video, description and social copy before publication. Nothing in this workspace has been published by this task.
