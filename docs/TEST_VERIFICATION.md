# Test verification — 12 September 2026

## Final integration run — 13:49 Dubai

`npm run check && npm run build && npm test` exited 0: **120 tests, 119 passed, 1 optional live test skipped, 0 failures**, 1730.5465 ms. This includes seven accepted-turn recovery regressions and an HTTP check proving `/api/mentoros/retry` rejects a resolved rehearsal without changing saved state. The isolated server tests execute freshly transpiled source, use port 3211 with no credentials, and block all outbound fetches. Earlier results below remain historical evidence.

The final approved-export refinement was then checked with the same command: 119 passed, 1 skipped, 0 failures, 1719.542333 ms. Existing persistence tests now also verify `calendar.canExport` before approval, during a pending follow-up and after reset. Both browser JavaScript files passed `node --check`.

The completed `npm test && npm run check` run exited with code 0. This records its retained stdout summary; no tests or live API calls were repeated to write this document.

```text
ℹ tests 112
ℹ suites 0
ℹ pass 111
ℹ fail 0
ℹ cancelled 0
ℹ skipped 1
ℹ todo 0
ℹ duration_ms 1011.397209

> agents-everywhere-dual-demo@0.1.0 check
> node node_modules/typescript/bin/tsc --noEmit
```

## Why one test is skipped

The optional real Agents/Exa integration test is guarded by `process.env.MENTOR_LIVE_CHECK !== '1'` in `test/mentor.test.ts`. Normal `npm test` intentionally skips paid live requests. The separately authorized two-turn live verification passed and is recorded in [MENTOR_LIVE_VERIFICATION.md](MENTOR_LIVE_VERIFICATION.md).

## Exact fix for the suite hang

The stalled-transport test deliberately supplies a fetch promise that never resolves and ignores abort signals. The application's deadline rejected that request, so its assertion passed, but the underlying OpenAI SDK request retained its default **600,000 ms (10-minute) timeout timer**. That active timer kept the test worker alive after its final assertion.

The fixes are:

- `src/mentor.ts` passes the bounded request timeout to the SDK itself: `const opts = { signal: controller.signal, maxRetries: 0, timeout };`. The stalled test uses `timeoutMs: 150`, so it no longer leaves the SDK's ten-minute default timer behind.
- `test/mentor.test.ts` also gives fake SDK clients a defensive `timeout: 1500` default.
- Cancellation has its own bounded `Promise.race`; timers and stream observers are cleaned up in `finally` blocks.

The current whole suite exits normally in approximately one second, without forced process exit. A test process already running older compiled code does not receive these changes. No action was taken on the coordinator's stale process while preparing this report.
