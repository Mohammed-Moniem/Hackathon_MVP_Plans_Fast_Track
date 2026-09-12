Independent HTTP verification completed **2026-09-12, 09:10 UTC**. Final result: **19 Node tests passed, 0 failed, 0 skipped, 0 TODO** (18 scenarios plus their enclosing test). Strict TypeScript checking of the new test file also passed.

Only `test/server.test.ts` and this report were edited. `IMPLEMENTATION_TARGETS.md`, `src/server.ts`, and the relevant service/provider/engine code were reviewed read-only. Three reproduced defects were reported to the coordinator, who fixed the server and rebuilt it; all three now have passing regression tests.

**Execution and isolation**

Run from `/Users/mohammedosman/Downloads/Hackathon_MVP_Plans_Fast_Track` with the coordinator's current compiled `dist/server.js`:

```sh
node --test test/server.test.ts
node node_modules/typescript/bin/tsc --noEmit --target ES2022 --module NodeNext --strict --skipLibCheck --esModuleInterop --noUncheckedIndexedAccess test/server.test.ts
```

Verified on Node **v24.18.0**. The HTTP run completed in approximately **0.87 seconds**. It tested `dist/server.js` SHA-256:

```text
f5de30049c9d3d10281e8797adb407cade023e087ccb051a8ce7de197c626329
```

The harness launches the existing compiled server directly on **127.0.0.1:3211**, uses a fresh temporary working directory with a copied `web` tree, and sets `MENTOR_STATE_PATH` inside that directory. It refuses an occupied port and confirms its own child announced listening before sending requests. It terminates only its own child, including an isolated persistence-restart check, and removes its fixtures afterwards.

No real environment files or credential values were inspected. Child processes receive a minimal environment with empty provider keys; they cannot load the project's dotenv files from the temporary cwd. Outbound child `fetch` is blocked, and the test fails if the guard is triggered. No guard was triggered. All app scenarios select replay. The only voice calls verify input rejection or explicit missing-provider errors.

All HTTP client calls use native `fetch`. Because Node's native fetch ignores a supplied `Host` header, Host tests use a loopback TCP relay to replace only that header on the wire. This verifies the server's actual Host enforcement without a false positive caused by client header normalization. The relay is also cleaned up.

Port **3210 was never requested, reset, restarted, or stopped by this tester**. A final read-only socket inventory showed the coordinator's server listening on 3210 (PID 98536), with no remaining listener on 3211.

**Coverage and observed results**

| Surface | Verified behavior |
| --- | --- |
| HTTP/static | Both app HTML pages, canonical redirects, HEAD without body, content types, no-store JSON, nosniff, framing denial, referrer policy, unknown API 404 and unsupported static method 405. |
| Request validation | Malformed/empty JSON, scalar/array/null bodies, missing JSON content type, invalid mode/text/ID/area/coach, text/ID/area/speech length limits; rejected inputs preserve business state. |
| Request sizes/voice | JSON over 24,000 bytes and audio over 10 MiB return 413. Empty audio returns 400, unsupported media returns 415, and valid-shaped voice requests with no key return explicit 503 errors without network calls. |
| Origin/Host | Hostile origins, wrong port, HTTPS origin, deceptive localhost suffix, malformed/null origins, and cross-site mutation requests are rejected; allowed localhost origins succeed. Forged Host values return 403 even with an allowed Origin. |
| Traversal | Encoded slash/dot traversal, sibling-prefix escape, double encoding, malformed escapes, NUL path, and a synthetic symlink escape cannot disclose outside bytes. |
| DealGuard approval | Pending proposals produce no buyer message. Unknown IDs fail. Eight concurrent approval requests and a later repeat yield exactly one approval audit, one send-start audit, one simulated receipt, and one buyer message. Client-supplied replacement terms/text cannot alter the stored proposal. Reconcile does not resend. |
| DealGuard follow-up/hold | Changed 48-month terms block action and preserve memory of the previously delivered counteroffer. New input invalidates an older pending ID; rejection/reset revoke approval. Arbitrary custom replay text remains blocked with no inferred terms, metrics, outgoing text or receipt. |
| Mentor approval | Disruption proposes changes without applying movable events. Wrong IDs fail. Six concurrent approvals plus a repeat apply exactly the reviewed changes, preserve fixed events, and produce one approval audit without duplicate memory. |
| Mentor calendar | Export is unavailable before approval, while the first proposal is pending, after rejecting the first proposal, and after reset. Approved exports have calendar/download headers, CRLF, UTF-8 physical lines of at most 75 bytes, UTC times corresponding to Dubai time, and only movable events. |
| Mentor persistence/follow-up | Approved events/memory and exact ICS bytes survive an isolated child restart; state file mode is 0600. Pending/rejected follow-ups retain the last approved export, superseded IDs cannot approve, and an unsupported replay constraint fails without calendar access. |
| Removed setup route | Current `GET /setup/exa` returns 404; POST is rejected by the generic 405 handler. No temporary `.env.local` file is created, and search remains unconfigured. No credential persistence success was exercised in the final suite. |

**Defects reported and fixed by the coordinator**

| ID | Concrete original reproduction | Resolution verified |
| --- | --- | --- |
| SEC-01 | A symlink inside the temporary `web` tree pointed to a synthetic outside file. `GET /escape-link.txt` returned HTTP 200 with `SERVER_TEST_PRIVATE_SENTINEL`. | `src/server.ts:183` now resolves the requested file and actual web root before checking containment; outside symlink bytes are not returned. The original issue required an existing outside-target symlink under the served tree; no real outside file was read. |
| SEC-02 | POST `/api/dealguard/unregistered/reset` and `/api/mentoros/unregistered/reset` with replay mode returned 200 and reset state because dispatch matched action suffixes. | Exact endpoint allowlists and exact action comparisons at `src/server.ts:149` and `src/server.ts:166`. Tests now exercise nested reset/message/approve/reject/reconcile/disrupt paths, all returning 404 without state changes. |
| VAL-01 | A reset with `Content-Type: application/json-not-real` returned 200 and executed because media validation used a prefix check. | `src/server.ts:97` compares the trimmed, case-normalized media type exactly. Misleading types return 415 without state changes; `Application/JSON; charset=utf-8` succeeds. |

The temporary Exa bootstrap form was removed by the coordinator during this review. Its original success contract is therefore absent from the final tests; the remaining check verifies removal. POST 405 is the current generic non-API behavior, rather than evidence that a setup handler remains.

These results cover the compiled **local replay server** and its tested security boundaries. No live Agents/Exa/Slack delivery, real transcription/speech generation, browser microphone permissions, external calendar import, sustained-load behavior, or production deployment was exercised. No claim of live provider connectivity or production security certification follows from these results.
