# Local HTTP integration runner

Run the existing compiled server through real loopback HTTP requests:

```sh
node scripts/verify-integrations.mjs --output /tmp/integrations-run-001.json
node scripts/verify-integrations.mjs --fixture-state /path/to/council-fixture.json --output /tmp/integrations-run-002.json
node scripts/verify-integrations.mjs --port 43217 --timeout-ms 120000 --output /tmp/integrations-run-003.json
```

Use a new output filename each time; its parent directory must already exist. Existing files and symlinks are refused rather than overwritten. Output inside `.mentor` is refused. Run `--help` for the options. The repository is located relative to the script, so invocation does not depend on the shell's working directory.

The runner requires Node 24+ and an existing `dist/server.js` with its installed application dependencies. It neither builds nor installs anything. The parent should finish its integrated build before rerunning. The report includes hashes for the server entry, all compiled JavaScript modules, and the copied web snapshot. A compiled build changing during verification fails the run.

## Isolation and lifecycle

- Creates a private `mkdtemp` working directory and copies only `web`. Symlinks in that tree are refused; dotenv files, `.mentor`, `.git`, and `node_modules` are excluded.
- Runs the existing compiled entry by absolute path. Child environment contains only `PORT`, an isolated `HOME` and `TMPDIR`, and an isolated `MENTOR_STATE_PATH`. No parent environment is spread: OpenAI, Exa, all Slack credentials, proxies, `NODE_OPTIONS`, and provider configuration are absent. No `.env` is copied or loaded from the project.
- Installs a non-writable global `fetch` rejection before loading the server. Every attempted child fetch fails and increments an observation counter; any such attempt fails verification. No URL, prompt, credential value, fixture payload, or child log is included in the report. This is an application-level fetch guard, not an operating-system network sandbox.
- Uses native parent `fetch` only against the exact loopback origin; redirects are never followed. Each request, including response consumption, has a five-second deadline and a 16 MiB response limit. Startup is bounded to ten seconds; the overall default budget is 120 seconds, configurable from 10 to 300 seconds.
- Port `0` selects a free loopback port for each child startup. An explicitly selected port must be available. The runner waits for its own child's guard and listening announcements before sending HTTP requests; it never adopts an existing server or kills a process by port.
- Stops only its own child on success, assertion failure, SIGINT, SIGTERM, or a time-budget failure. Teardown allows two seconds for SIGTERM and two more after SIGKILL. Temporary state is removed only after the child stops. An unkillable child causes a reported cleanup failure and retains its isolated directory.

The real project `.mentor` is neither discovered nor mutated. The only optional source-state read is the file explicitly named by `--fixture-state`. The runner adds no dependencies and changes no application source, package files, or compiled output.

## Optional council fixture

`--fixture-state` accepts **one complete EcosystemState JSON file**, not a folder or planner state wrapper. Supply a separate, preferably synthetic snapshot with these persisted fields: `mentors`, `profile`, `profileRevision`, `run`, and `memory`. The file must be a regular file, not a symlink, and at most 2 MiB. Mentor/profile definitions must satisfy the application's normal startup validation.

For full council coverage, `run.status` must be `pending`, with its actual `id`, `mentorIds`, `messages`, `sources`, `decision`, `createdAt`, and `profileRevision`; the run revision must match the top-level revision. The decision must include the normal council fields, including its title and recommendation. No provider is invoked to create a recommendation, and the runner does not invent or alter a pending run.

The runner first executes ordinary workflows against fresh generated local defaults. For each council scenario it then stops its child, writes the **original fixture bytes** into the isolated `.mentor/ecosystem.json`, and restarts. Approval, rejection, and profile invalidation therefore begin from independent copies of the same pending recommendation. Persisted business fields are checked against the supplied fixture; capability flags and image-generation configuration are runtime metadata and are not compared to old fixture values. Source-file hashes are checked before and after the run.

An already `approved` or `rejected` fixture instead exercises repeated same-action idempotency and refusal of the opposite action. Pending-only scenarios receive explicit skips. With no fixture, all four council fixture scenarios receive explicit skips. A pending fixture exercises both terminal outcomes, so the separate supplied-terminal scenario is skipped as inapplicable.

## Observed HTTP coverage

| Check | Assertions |
| --- | --- |
| Configuration | OpenAI agents, voice, Exa search, Slack, vision and image capabilities unavailable; local demo and ICS-only calendar explicit. |
| Manual mentors | Create, exact edit, delete, revoked ID rejection, unrelated mentor preservation and persistence across server restart. |
| Shared profile | Exact accepted fields, revision increment, rejected invalid budget and restart persistence. |
| Limits | Two-mentor minimum, twelve-mentor maximum, unchanged state after rejection; council selections of one, five, or duplicate mentors rejected. |
| Planner | Replay message, exact stored approval despite replacement fields, repeated approval, disruption, supersession, rejection and reset boundaries. |
| Calendar | Approval required; approved export survives pending/rejected follow-ups and restart; download MIME/disposition, CRLF, 75-octet line folding, unique UIDs, UTC timestamps, Dubai time conversion, exact event titles/times/count, approved proposal ID and byte stability. |
| DealGuard | Labelled first offer from the HTTP response, no send before approval, exact stored counteroffer, one replay receipt/message/audit sequence, repeat approval and reconciliation, remembered follow-up, changed-term invalidation, rejection/reset, and blocked freeform send attempts. |
| Missing providers | Explicit errors for council, mentor draft, vision, meal images, transcription, speech, live planner and live DealGuard; repeated failures release locks and do not fabricate proposals. |
| Routes/assets | Fifteen deep links return the real shell; redirects and HEAD; local HTML-linked assets and CSS URL dependencies; inline data assets require no request; missing assets/images/APIs retain error status instead of HTML fallback; unsupported methods and hostile Origin rejected. |
| Council fixture | Exact stored approve/reject, wrong-ID rejection, duplicate decisions, opposite terminal-action refusal, approval-only memory, restart persistence, stale-profile approval denial, and unchanged fixture source. |

Independent Exa error behavior receives an explicit skip: there is no standalone search HTTP endpoint, and the live planner checks OpenAI availability first. Both keys remain absent; `search:false` is verified. The runner does not enable OpenAI or mock an HTTP provider to reach that branch.

This validates local HTTP behavior and fixed replay workflows. It does not claim browser interaction, rendered UI acceptance, provider access or output quality, paid image generation, real Slack delivery, or external calendar writes. Those checks remain with the parent.

## Report and exit status

Stdout contains one compact JSON summary with `status`, `pass`, `fail`, `skip`, and `output`. The mode-600 JSON report contains:

- `schemaVersion`, start/finish timestamps, build/web hashes and optional fixture hash/status;
- `checks[]`: stable check IDs, `pass`/`fail`/`skip`, observed HTTP methods/paths/statuses, duration where applicable, concise measurements, errors or explicit skip reasons;
- `isolation`: child PIDs, ports, guard readiness, exit signals, cleanup outcome and attempted fetch count;
- `summary`, aggregate `status`, and the explicit local-only scope.

Exit `0` means no observed failures; `pass-with-skips` remains distinct from complete coverage. Exit `1` means a failed assertion, isolation/setup problem, timeout, interruption, or output error. Output-path/argument errors are printed to stderr when no safe report file can be created. No response bodies or fixture text are logged. Inspect check-level skips before accepting coverage.

## Verification performed on 2026-09-12

Against the compiled build available during implementation:

- Fresh defaults: **12 passed, 0 failed, 5 explicit skips**.
- Separate synthetic pending council fixture: **16 passed, 0 failed, 2 explicit skips**. Both decision outcomes and stale-profile rejection passed. Dummy OpenAI, Exa and Slack values supplied to the runner remained absent from its child.
- Separate synthetic approved fixture: **14 passed, 0 failed, 4 explicit skips**.
- Occupied selected port: refused before any child started; the existing listener remained alive. Free selected port, existing-output refusal, and malformed-fixture failure were also exercised.

The successful runs observed zero outbound fetch attempts, stopped every child, removed isolated state, and preserved fixture source hashes. These are local observations, not evidence that paid integrations succeeded. Machine-readable reports were written under `/tmp/integration-local-*-20260912-*.json`; rerun after subsequent builds rather than treating these observations as current indefinitely.
