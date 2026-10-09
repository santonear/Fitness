# Coach access recovery and CI isolation — 2026-10-09

Baseline: PR #22 / ac130faae82d16f43cd7fabacb1be5f9b764aab6. Branch: codex/coach-access-ci. Scope: recover administrator direct activation inside the coach, share eligibility logic with the trial page, independently rerunnable CI groups, and current-state documentation. No model requests, qualification-policy changes or data migration.

## Behavior and boundaries

The coach's existing Refresh access button now checks the current session, then only on QUALIFICATION_REQUIRED reads the current browser receipt. A valid receipt can retrieve applications and claim an unexpired, approved/claimed direct activation. Ordinary approval, pending/rejected applications, missing/invalid receipts and expired claim windows cannot auto-activate. The server remains authoritative; the final status must validate before the UI becomes active. A failed post-claim status does not recurse. Network failures or malformed data never become qualification success.

Pending status calls share a promise across clients using the same fetch transport. Pending claims share a promise keyed by receipt/application, including trial-page repeated initialization. Both maps clear after completion/failure, so a later explicit refresh checks fresh server state. Refreshing does not navigate away or erase goal/reply drafts. No receipt is placed in a URL or model request.

## Validation

- Final local typecheck, unit suite and production build passed: 470 tests / 62 files.
- All four CI browser suites collected under Node 24: main 360, AI 30, trial 34, V3.1 96. The narrow 3-case WebKit precheck remains.
- Targeted Chromium/WebKit run: 26 passed, covering explicit and automatic coach recovery, preserved unsent goal/reply, exactly one claim, zero model calls, and all existing V3.1 trial states/ordinary approval.
- Initial automatic fixture failures were traced to an empty goal, then premature trial-page activation. Network trace identified repeated trial initialization. The shared claim guard and fixture isolation fixed this; the final run verified activation from the coach itself.
- Unit boundaries cover concurrent clients, separate claim callers, absent/denied storage, malformed responses, missing cookies after a claim, existing sessions, and revoked subjects. No live user account was modified.

## CI

The checks job performs type/unit/build and test collection before browser installation. browser-main and browser-flows run independently after checks. The existing verify name is an always-run aggregate that succeeds only if every dependency succeeds. Failed jobs can be rerun without rerunning successful jobs. Main push and PR triggers remain; branch push duplication is absent; a newer run cancels stale work on the same ref. Budgets are 10/20/15 minutes plus 2 minutes for the aggregate. No test or assertion was removed.

## Focused review and release gate

Reviewed receipt ownership, direct-only eligibility, bounded recovery, rejected/malformed responses, same-origin transport, pending-request cleanup, draft preservation, original trial behavior and fail-closed CI aggregation. Shared application schema is unchanged. No backend authorization change. No changes to docs/productdesign or the dirty root checkout.

Local results do not represent final remote CI or public deployment. Final PR, merge commit, CI and public version will be recorded separately. Real phones and paid AI quality remain unverified.
