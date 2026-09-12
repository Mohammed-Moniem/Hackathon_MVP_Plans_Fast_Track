# MentorService live verification

**PASS.** The repaired live flow completed two turns in one persistent session: disruption and approval in 73.8 seconds, then the exact requested home-activity follow-up and approval in 70.4 seconds. Both retained 90 minutes of study and used an actual Exa citation. The approved state remains in `artifacts/live-mentor-check.json`.

The whole suite passed (111 tests; one opt-in live check skipped) and exited cleanly in about one second. Typechecking passed. Final prose limits are enforced at 220 characters for the summary, 450 for each coach note and 800 for speech; this wording-only refinement was checked locally without another live call.

Observed on 12 September 2026. Initial profile/day are synthetic; Agents output, Exa searches, local approvals and follow-up memory below are real. No external calendars or messages were modified.

```json
{
  "observedAt": "2026-09-12T09:10:54.817Z",
  "status": "passed",
  "initialAttempt": {
    "sessionId": "sess_0d11bfc67018bec6006aa5163daf608191bad6f3dc7b474983",
    "outcome": "Timed out before intended-turn completion; no eligible proposal or approval",
    "elapsedMs": 118442,
    "exaRetrieved": true,
    "validationSucceeded": true,
    "proposalStaged": true,
    "cleanup": "Initial session cleanup was unconfirmed. The successful repair session is retained for follow-ups.",
    "note": "The initial isolated test used a fixed synthetic trace clock. This repair uses real wall-clock timestamps."
  },
  "repair": "Low reasoning effort, one targeted search, concise role notes and immediate completion after staging.",
  "turns": [
    {
      "action": "Disruption and local approval",
      "elapsedMs": 73803,
      "sessionId": "sess_074c320eafc50fe6006aa517213f1881918fa151d5c180e4c2",
      "proposalId": "d587216c-1324-4b49-a79a-1f22165240a4",
      "valid": true,
      "maximumStudyMinutes": 90,
      "sources": [
        {
          "id": "exa-cf0b8e6bbbb0f14e",
          "title": "TOGAF® Series Guide: A Practitioners’ Approach to Developing Enterprise Architecture Following the TOGAF® ADM",
          "url": "https://publications.opengroup.org/g186"
        }
      ],
      "events": [
        {
          "id": "workout",
          "title": "Evening activity",
          "start": "19:45",
          "end": "20:30",
          "kind": "health",
          "fixed": false
        },
        {
          "id": "dinner",
          "title": "Dinner",
          "start": "20:30",
          "end": "21:00",
          "kind": "personal",
          "fixed": false
        },
        {
          "id": "study",
          "title": "TOGAF study",
          "start": "21:00",
          "end": "22:30",
          "kind": "career",
          "fixed": false
        }
      ],
      "approved": true
    },
    {
      "action": "keep the activity at home, remember our approved schedule",
      "elapsedMs": 70389,
      "sessionId": "sess_074c320eafc50fe6006aa517213f1881918fa151d5c180e4c2",
      "proposalId": "f5514754-b4a2-4086-aeaf-4ccfcb8569ec",
      "valid": true,
      "samePersistentSession": true,
      "priorApprovalRead": true,
      "sources": [
        {
          "id": "exa-cf0b8e6bbbb0f14e",
          "title": "TOGAF® Series Guide: A Practitioners’ Approach to Developing Enterprise Architecture Following the TOGAF® ADM",
          "url": "https://publications.opengroup.org/g186"
        }
      ],
      "events": [
        {
          "id": "workout",
          "title": "At-home evening activity",
          "start": "19:45",
          "end": "20:30",
          "kind": "health",
          "fixed": false
        },
        {
          "id": "dinner",
          "title": "Dinner",
          "start": "20:30",
          "end": "21:00",
          "kind": "personal",
          "fixed": false
        },
        {
          "id": "study",
          "title": "TOGAF study",
          "start": "21:00",
          "end": "22:30",
          "kind": "career",
          "fixed": false
        }
      ],
      "approved": true,
      "calendarCRLFAndFoldingValid": true
    }
  ],
  "externalCalendarWrites": false,
  "externalMessages": false,
  "completedAt": "2026-09-12T09:13:19.021Z",
  "retainedSessionId": "sess_074c320eafc50fe6006aa517213f1881918fa151d5c180e4c2"
}
```
