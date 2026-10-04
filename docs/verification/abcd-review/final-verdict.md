# ABCD final independent review

Date: 2026-10-05. Reviewed local integration worktree `.worktrees/fitness-abcd-review`, baseline `32f2c6bf427ebf77e63f78ba7e1b65f4faf30d1b`, against `docs/superpowers/plans/2026-10-05-abcd-parallel.md`. READ-ONLY source review; only this review document was written.

## Verdict

PASS for the authorized four-package local integration scope. No new actionable correctness, privacy, contract-compatibility or accidental-write finding was identified in the reviewed final source. This is not production merge/deployment approval or real-device certification. Final integrated browser verification remains a separate coordinator gate.

## Specification and quality assessment

- A: Export and file import use the same 16,777,216 UTF8-byte cap; complete backup/memo/reference validation remains intact. Export metadata and content are captured together in a read transaction. Replacement requires the exported receipt revision to match the preview, and the repository transaction checks that revision again before clearing tables. Failure/conflict UI resets stale permissions appropriately; the app-level restore message survives route remounting. This does not certify phone capacity or the browser's actual download completion, which remains explicitly user-confirmed.
- B: HCTX is type-only/pure, explicitly scoped, detached and deterministic. It preserves legacy/date model and source identities, selects referenced days rather than unrelated history, distinguishes committed temporary sets from completed facts, preserves notes and zero/missing metrics, and rejects whole over-budget output. Caller atomic capture/schema validation remains an explicitly documented precondition. Manifest bytes exclude the manifest and enclosing request, as stated in the contract.
- C: Executable mock service, strict Fetch endpoints and SQLite adapter satisfy the authorized local-control scope. Persisted state contains control/accounting metadata and keyed digests, with no training/goal/history/result bodies. Backend has no frontend production entry, model/network supplier or local training write. B's payload and C's self-contained mock history envelope are deliberately separate APIs; direct automatic interoperability is not claimed. Candidate validation uses existing catalog/metric schemas and exact sparse date sets. Reserve/submission/settlement, cancellation and reconciliation retain conservative accounting, original qualification/quota identity and distinct refusal codes.
- D: The shared Workout component serves Today and Workout. Display uses committed snapshots, human units, explicit replacement provenance, exact notes and zero/missing distance distinction. Inputs are marked unsaved when diverging from saved values; no copying/prefill/autosave or new notes persistence is introduced. Existing form identity and native submission validity paths are retained.

The small App/Workout/BackupPanel changes are necessary support for the authorized backup-feedback and shared-target-display behavior. No fifth AI frontend workstream or dependency changes were found.

## C-R1 repair rereview

The final `ControlService.submit` submission transaction now rechecks `needsReconciliation(state, this.period())`, as admission does, before granting supplier submission. It first verifies the entry is still reserved. Pending accounting or a month transition releases only the provably unsubmitted reservation; submitted calls remain occupied. The deterministic `tests/backend/submission-boundary.test.ts` fixtures explicitly hold B after committed admission, change A/month state, then check B supplier calls remain zero and A accounting is unchanged. Source-level rereview finds the previously reported race addressed; no new issue found in this repair. Execution results below are coordinator-reported, not rerun here.

## Evidence boundaries

Reviewed the full final source/diff snapshot and actual integration files for backup, BackupPanel/App, HCTX, target display/editor/Workout, backend contracts/control/HTTP/store/SQLite/D1 and the submission-boundary regression. Read package verification documents and existing domain schemas to assess compatibility. Applied Karpathy review principles and consulted ProcMEM workflow instructions. No application edits, dependency installation, network/model calls, external catalog cache scan or test repetition occurred in this review.

Coordinator reports final unit 112, typecheck and build passing; capacity core 32/32, actual downloaded-file restoration for 5/6 MiB notes and 10k samples, and backup feedback 8/8. Those results are supplied evidence, not independent executions by this reviewer. The integrated 158 browser run was still running when the review was requested; this document does not claim it passed.

Remaining declared boundaries: real phones deferred, real D1 consistency/transactions and production HTTP/auth/key management unverified, model disabled by default, production AI entry absent, and the single-row metadata ledger safely capped rather than production-scaled. HCTX-to-C/caller consent and local candidate-save wiring remain outside the authorized implementation. These are stated limits, not defects invented as extra scope.
