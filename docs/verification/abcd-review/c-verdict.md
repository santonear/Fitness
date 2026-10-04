# C independent read-only review — 2026-10-05

Scope: C and shared authorization in `docs/superpowers/plans/2026-10-05-abcd-parallel.md`, baseline `32f2c6bf427ebf77e63f78ba7e1b65f4faf30d1b`, supplied `c-review.txt`, current source/tests in `.worktrees/fitness-backend`, and worker report. No application changes, test reruns, network, model calls, deployment, resources or spending. Test pass counts below are worker-reported evidence, not independently rerun results.

## Verdicts

- Spec: **changes required** for the local control package. The executable mock/backend scope and explicit production limitations match authorization, but an already reserved request can cross the supplier submission boundary after another request becomes accounting-pending.
- Quality: **changes required**, one important concurrency finding below. Storage admission and same-ID dedupe are otherwise straightforward and atomic; this review does not require production wiring, a new storage architecture, or new dependencies.

## Important finding

### C-R1 [P1] Recheck accounting-pending state at the supplier submission boundary

Location: `.worktrees/fitness-backend/src/backend/control.ts:127–132` (especially line 131), together with the admission guard at line 114 and `pending()` at line 145.

Admission rejects any accounting-pending request, but `pending()` only changes an entry's status; it leaves `aiEnabled=true` and `recoveryRequired=false`. The later reserved-to-submitted transaction checks only qualification, cancellation and those two flags. Therefore a request which has reserved budget but has not yet contacted the supplier can start a new supplier call after the ledger enters the uncertainty state which should block new AI until reconciliation. This is a real asynchronous-store interleaving; SQLite's short synchronous callback does not establish safety for the D1 adapter's awaited read/CAS operations.

Deterministic reproduction recipe (source-derived, not executed in this review):

1. Use an isolated mock service with mock enabled, at least two available slots and budget for both requests. Supplier A returns a controllable rejected promise.
2. Submit A and wait until it has status `submitted` and its supplier has started.
3. Submit B through an asynchronous `ControlStore` wrapper. Allow B's admission transaction to commit its `reserved` entry, then hold delivery of that transaction's result so B has not reached its second transaction.
4. Reject A's supplier promise; await A's `ACCOUNTING_PENDING` rejection. Assert A is `pending`, B is `reserved`, and both enable/recovery flags remain unchanged.
5. Release B's admission result. Its submission transaction passes line 131 and supplier B is called, despite the unresolved A entry.

Expected: B does not call the supplier after A becomes pending; A's reservation/quota remain occupied and only B's definitely unsubmitted reservation may be released. Check authoritative ledger conditions within the same transaction that grants submission, including the accounting-pending gate already used at admission. Add the pause-store interleaving regression; the current tests wait until the first supplier has already started, and do not exercise a held reserved-to-submitted transition.

## Checked contracts and evidence boundaries

- Invite redemption is one-use inside the store transaction; expiry/revocation and reissue preserve original subject expiry, quota/request identity and pending costs. Reissue returns a replacement invite rather than installing the user's cookie for an administrator.
- Atomic admission covers individual usage, worst-cost reserve and request identity together. Same-ID duplicates have no second supplier call path; changed payloads conflict. Separate SQLite connections share the aggregate transaction. D1 retries reread revision and accept authority only for `success` plus exactly one changed row; zero/unknown change counts fail closed.
- Submitted cancellation keeps accounting occupancy. Supplier failure/missing/invalid cost becomes pending without a timeout release. Settlement fixes the original request period, is idempotent for the same amount, rejects differing amounts and pauses after a successfully persisted over-bound cost.
- Recovery marks active entries pending and disables AI. Reopening requires pending resolution and current-month evidence for every known subject plus all known/current budget periods; `Math.max` prevents reducing recorded counts or spend. Evidence completeness for records entirely missing from an old snapshot remains an explicit operator limitation.
- Request/response contracts reuse existing Zod/catalog metric schemas, reject unknown fields, bind sending and separate goal confirmations, require exact selected result dates and preserve sparse dates beyond twelve weeks. Restore-generation and input-fingerprint applicability checks are present. Human consent and frontend local-save flows remain outside this source-only package.
- Persisted aggregate holds control metadata/keyed digests rather than request/result/note bodies. Fetch handler has sanitized errors, streamed body byte checks, protected local admin routes, explicit HTTPS origin configuration and Secure/HttpOnly/SameSite trial cookies. Production identity/key management, mobile cookie delivery and a live listener are deliberately unverified.
- The UTF8 precommit ledger guard uses the provided local candidate `1,900,000` bytes; it is not a real D1 row-limit verification or production retention/scaling claim. Postsubmission capacity failures can preserve unresolved conservative occupancy as disclosed; no production readiness is inferred.

Worker reports 23/23 backend tests, 98/98 full unit tests, typecheck and build passing. Source inspection found the tests cover normal dedupe, budget/quota admission, cross-month settlement, uncertainty, exact candidate dates/metrics, HTTP origins/cookies, recovery and capacity rollback, but not C-R1's interleaving. No repeated broad test run was performed.

Workflow note: profile and canonical procmem index/search were readable; no matching verified remote-backend accounting procedure was adopted. Karpathy/procmem source skills were read. Skill-catalog search failed `EPERM` writing its index temporary file, so it did not establish a complete catalog scan. No durable memory was written during this read-only review.
