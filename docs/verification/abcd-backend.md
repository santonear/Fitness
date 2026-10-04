# ABCD C — BE1 local control evidence

Date: 2026-10-05. Baseline `32f2c6bf427ebf77e63f78ba7e1b65f4faf30d1b`; worktree `fitness-backend`, branch `codex/abcd-backend`. Local implementation only; no production wiring, resources, secrets, supplier network calls, spending, commits, or deployment.

## Executable surfaces

- `src/backend/control.ts`: invite issue/revoke, one-time redemption, subject revoke/reissue, qualification/status, mock switch, atomic admission/submission/settlement, cancellation, recovery/reconciliation, stale-context check.
- `src/backend/http.ts`: executable Fetch `Request → Response` handler; `/api/v1/health`, trial redeem/status, goals interpret, plans generate, request cancel and protected local admin routes. Unknown API routes return JSON404. No live HTTP listener or production worker added.
- `src/backend/contracts.ts`: existing Zod4/catalog reused for strict operation-specific requests and candidate metrics; independent exact date-set verification; generation accepts sparse dates beyond old12-week spans. No week schema reused for new generation.
- `src/backend/sqlite-store.ts`: Node24 native SQLite local adapter, `BEGIN IMMEDIATE` with complete callback rollback. Tests use separate isolated connections, in-memory DBs or task-specific temp directories; no user's browser/SQLite data.
- `src/backend/d1-store.ts` + `schema.sql`: D1-ready single-row metadata aggregate and primary-session revision CAS. Conditional update0 never grants admission; callback retries are pure and supplier remains outside transaction. Unit protocol simulator is NOT real D1 transaction/consistency evidence.
- `src/backend/ledger-capacity.ts`: UTF8 serialization precommit guard at1,900,000 JSON bytes, below D1's documented2,000,000-byte row limit with overhead allowance. Boundary and+1 tests executed; failed capacity admission rolls back all state and calls supplier0 times. This aggregate architecture is an isolated candidate, not approved production scaling/TTL/index design.

## Test-only parameters and privacy

`testConfig` explicitly uses `mode: local-test`, local-mock supplier, UTC server natural month, K1, 8 understanding/4 generation, AI3500 integer RMB fen, request worst bounds100/300fen, maximum request1000fen, global concurrency4, input65536UTF8 bytes. These are configurable isolated test parameters, not validated production pricing, selected model, production timezone or availability guarantees. Summary is unavailable; its historical4 calls are never reallocated. Fresh ledger disables mock; constructor rejects nonmock supplier/mode.

Trial code is256 random bits; persisted codes/cookies/input use HMAC-SHA256 with a test-only server digest secret. Unredeemed code expires after7days, one redemption; original subject ends after30days. Reissue first revokes old sessions and outstanding replacement codes, creates one-use replacement code capped by original expiry; later redemption reuses original subject, quota, pending reservations and request namespace. Admin receives replacement code, NOT a trial cookie. Actual trial redeem sets `__Host-` Secure/HttpOnly/SameSite=Strict cookie, no token in JSON. This is qualification, not account/device identity; stolen bearer tokens remain bearer tokens. Production admin protection/key management/authentication are unverified and must replace explicit test credentials.

Unsafe HTTP calls require exact allowed HTTPS origin and host. Safe GET may omit Origin for normal same-origin browser fetch; explicit foreign Origin or Sec-Fetch-Site cross-site rejects. No wildcard CORS. Handler requires explicit nonempty origin configuration. HTTP body streaming rejects UTF8 byte overflow without logging body/errors. This handler is exercised with synthetic Fetch requests; actual mobile cookie transport/CSRF/deployment headers remain unverified.

Only control subjects, digests, per-period counters, reservation/request status, costs and administrative metadata persist. No goal/conditions/height/weight/history/memo/free notes/result text/credential plaintext is stored, and no telemetry/logger/SDK/network supplier exists. Source and built browser bundle inspection found no backend/test credential markers. HCTX is a strict self-contained mock envelope, NOT B's unpublished API or a browser history reader.

Public content fingerprints bind sending confirmation to operation, goal, dates, conditions/history, locale and restoreGeneration. Goal-understanding confirmation is separately checked before generation. They express the contract; a server cannot prove human consent solely from client-supplied hashes. The frontend consent/preview/local-save flow is outside this package. `assertApplicable` checks restoreGeneration and current input fingerprint; unrelated dataRevision changes do not blanket-invalidate a candidate. No backend action writes training facts.

## Accounting and recovery

Qualification/input/confirmations run before atomic dedupe/quota/global-budget/concurrency admission. One transaction reserves individual request count and worst cost before mock supplier. Changed input with sameID conflicts; sameID in-flight/pending refuses another call; completed requests have RESULT_UNAVAILABLE because result bodies are not retained. Personal quota/global budget/request bound have distinct codes. Submitted cancellation never releases quota/cost, supplier failures or missing cost retain pending reservation indefinitely, no timeout release or automatic retry exists. Known valid charges settle even if candidate is invalid/cancelled. Duplicate settlement is idempotent; conflicting amounts reject. Actual cost exceeding reserved bound records actual charge and pauses further calls for review.

Cross-month in-flight/pending entries block new calls until resolved; original period/bound stays fixed during settlement. Reissue and browser restore cannot reset counters. Recovery hook marks AI disabled and all active entries pending; new calls remain blocked. Reconciliation requires all pending entries resolved, independently observed spent amounts for all known/current periods and current-month counts for every known subject; known amounts/counts only increase. Explicit mock-enable is a separate admin action after reconciliation. External evidence accuracy and inclusion of records completely absent from an old restored snapshot are operator responsibilities; code cannot infer unknown supplier charges. Any actual external D1/SQLite restore MUST run this recovery hook before exposing calls. Automatic detection of out-of-band database rollback is not implemented.

## Coverage boundary

| Acceptance | Local evidence / remaining work |
|---|---|
| BE-T01 | Disabled/default, invalid/revoked/expired qualification and admin denial; supplier0 before admission. No production auth/resource measurement. |
| BE-T02 | Concurrent single redemption, expiry/revoke/reissue/one-use replacement, original quota/expiry preserved. Real browser/device exchange not tested. |
| BE-T03 | SameID concurrent dedupe, changed input409, no result-body replay; one supplier call. |
| BE-T04 | Two requests at one-call remaining budget, distinct quota/budget/bound refusal, separate SQLite connections, CAS zero-row protocol; no partial count. Real multi-Worker D1 remains unverified. |
| BE-T05 | Supplier throw/missing cost, cancellation retention, no timeout retry/refund, original cross-month settlement, duplicate/conflicting settlement, cost-bound breach. Real supplier billing/disconnect/Worker kill unavailable. |
| BE-T06 | Sparse exact dates beyond12weeks, K boundary, duplicate/missing dates, controlled metric rejection and zero distance valid. Model quality and real output limits untested. |
| BE-T07 | Changed sending content, independent goal confirmation and strict field whitelist. No frontend human-consent integration. |
| BE-T08 | Context stale generation checks; no model retry due local-save behavior because backend never saves. CAL candidate editor/local-save/conflict flow not implemented here. |
| BE-T09 | Persistence lacks synthetic goal/result/code/token/test secrets; HMAC separation; sanitized HTTP errors, byte cap, browser build marker scan. No actual D1/log/SDK/network audit or supplier retention claim. |
| BE-T10 | Existing unit suite/build remain green; frontend/import graph unchanged. Offline browser regression is not rerun by C. |
| BE-T11 | Deferred; zero real iPhone/Android evidence. |
| BE-T12 | Deferred; no Cloudflare CPU/memory/row/query/concurrency evidence, no real model latency/quality/billing. |
| BE-T13 | Synthetic HTTPS Fetch routing/exact origin/safe GET/secure cookie/JSON404/admin replacement tests. No production origin/env deployment changes. |
| BE-T14 | Local recovery pause, unresolved refusal, nondecreasing independent count/spend reconstruction and explicit reopen. Real D1 backup/time-travel/application rollback not tested. |

## Verification

Commands from this worktree: `npm.cmd test -- tests/backend`23/23 pass; final `npm.cmd test`98/98 across13 files pass; final `npm.cmd run typecheck` and `npm.cmd run build` pass. Independent review is coordinator-owned and pending. Node24 prints ExperimentalWarning for native SQLite; this is a runtime compatibility risk, not a failed assertion.

Skill-reuse scan failed EPERM while writing `D:/AI-Library/skill-catalog/catalog.json.*.tmp`; installed skills were inspected directly. Profile/procmem index and relevant transaction-experience search succeeded; no applicable verified remote backend accounting procedure was found. Applied procmem, Karpathy guidelines and TDD. First test import failed because backend did not exist; later actual reconciliation omission was reproduced as assertionRED and fixed; date expiry fixture corrected against actual30-day timestamp. No claim that every initial feature got separate assertionRED.

No shared domain/schema/package/wrangler/translations/frontend edits. `node_modules` is authorized junction to existing fitness-cal dependencies; no install. No production defaults approved, new dependencies, real model, network, external Git operations or automatic retention cleanup. Single-row ledger growth stops safely; near-capacity postsubmission settlement failure can leave conservative unresolved occupancy requiring reconciliation/capacity work. Production normalized/indexed storage and approved retention policy are outstanding.

## C-R1 independent-review repair — 2026-10-05

The independent reviewer found that a committed admission could wait before its reserved→submitted transaction, while another supplier call became accounting-pending. The old submission boundary rechecked only flags/qualification/cancellation and could authorize this waiting request despite unresolved accounting. The same gap affected a month transition after admission.

Added `tests/backend/submission-boundary.test.ts` with a deterministic asynchronous store wrapper: A starts its mock supplier; B admission commits reserved quota/cost but delivery of that commit result is held. While B is held, A either becomes pending or remains submitted across the natural-month boundary. Releasing B's admission return previously allowed its supplier call. The first isolated run reproduced both assertion failures:2/2 RED, B returned a settled result when NOT_SUBMITTED was required.

`needsReconciliation` now supplies the same authoritative pending/old-period gate to admission and the reserved→submitted transaction. The latter uses the current server month and rejects entries which are no longer reserved. When B is still provably reserved but another pending/old-period entry blocks authorization, only B's unsubmitted cost reservation and individual count are released in that transaction. A's entry is unchanged,100fen remains reserved, one understanding count remains occupied, A supplier calls1/B supplier calls0. No front-end timeout or submitted cancellation refund was added.

Scoped postrepair verification: `npm.cmd test -- tests/backend/submission-boundary.test.ts tests/backend/control.test.ts`20/20 across2 files PASS; `npm.cmd run typecheck`PASS. No frontend/browser/build/full-suite/capacity rerun was performed for this narrow repair. Prior98-test evidence above predates this repair; the new two cases bring the source suite to100 tests but no100-test full-suite pass is claimed. SQLite ExperimentalWarning persists. Independent scoped rereview is pending; real D1 concurrency remains unverified.

## Final coordinator closure — 2026-10-05
Final integrated typecheck/build and 112/112 unit tests passed; 158/158 Chromium/WebKit integration cases passed. Earlier pending integration statements above are historical. Large-capacity core 32/32 and corrected backup feedback 8/8 passed separately; counts overlap. See abcd-integration.md for exact commands, scope and unverified real-device/real-D1/model boundaries.
