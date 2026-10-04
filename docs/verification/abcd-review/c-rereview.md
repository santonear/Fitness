# C-R1 scoped independent rereview — 2026-10-05

Scope: compare the original `c-review.txt`/`c-verdict.md` with revised `c-fix-review.txt`, the current `control.ts` repair and new `submission-boundary.test.ts`. Only C-R1 closure and breakage introduced by its repair were reviewed. No application edits, test reruns, resources, real D1/network/model calls or expanded review.

## Verdict

- Spec: **PASS for C-R1 closure within the authorized local/mock package**.
- Quality: **PASS for this scoped repair**. No new important finding identified. The prior change-required verdict is resolved by this repair; existing production limitations remain unchanged.

## Repair assessment

`control.ts:45–48` extracts the existing authoritative recovery/pending/old-period predicate into `needsReconciliation`; admission invokes it at line 118. The reserved-to-submitted transaction now invokes the same predicate with the current server period at line 136, before assigning `submitted` at line 137. Thus A becoming pending while B's admitted return is held causes B's submission authorization to fail, even when `aiEnabled` remains true and `recoveryRequired` remains false. An old-period active entry at the month boundary is also recognized.

The line 134 guard returns without a state change unless B is still `reserved`. Consequently a cancellation that has already released B, recovery that changed B to pending, or an already submitted/settled entry cannot be refunded or resubmitted by this boundary. When a provably reserved B is blocked, `releaseUnsubmitted` changes only B's status and subtracts only B's fixed bound/count from its original period; it does not alter A's pending/submitted record. Supplier invocation remains after successful transaction return. The D1 CAS adapter therefore retries the predicate against newly read state on revision conflict and grants authority only after its existing one-row-change condition; zero-row changes still do not grant permission.

## Regression assessment and evidence boundary

The new test parametrizes `pending` and `month-boundary`, using a committed SQLite transaction plus an asynchronous delivery wrapper to hold B after its reservation commit. A's supplier has started before B is held. The test then either commits A's uncertainty or advances the controlled server month, releases B, and checks `NOT_SUBMITTED`, A supplier calls 1/B calls 0, B `released`, A's record exactly unchanged, original-period reserved cost 100 and understanding usage 1. These assertions directly cover the reported behavioral failure and preservation of submitted accounting; they do not merely mirror the helper implementation.

Worker/coordinator evidence provided for this rereview: both new cases failed against the old source (2/2 RED), then the new cases plus related control tests passed (20/20), with typecheck passing. Coordinator additionally reports integrated check 112/112, typecheck and build passing. These are supplied execution results; this reviewer inspected the source/tests and did not independently rerun them. Real multi-Worker D1 concurrency and production deployment remain unverified, as in the original review.
