# B — HCTX verification

Date: 2026-10-05. Worktree: `.worktrees/fitness-hctx`, branch `codex/abcd-hctx`, baseline `32f2c6bf427ebf77e63f78ba7e1b65f4faf30d1b`.

## API for C integration

`buildHistoryContext(snapshot: HistorySnapshot, scope: HistoryScope): HistoryContextResult` exported from `src/application/history-context.ts`.

Snapshot explicitly supplies `capturedAt`, `dataRevision`, `restoreGeneration`, and committed `plans`, `planVersions`, `sessions`, `sets`, `scheduledWorkouts`, `bodyWeights` arrays. This function captures nothing. The caller owns atomic snapshot capture and upstream entity/schema validation; no DB, memo reader, network, model or runtime domain imports occur here. The only import is type-only domain models.

Scope explicitly supplies inclusive `from`, `to`, `sources` (subset of `sessions`, `scheduledWorkouts`, `bodyWeights`), and nonnegative integer `maxUtf8Bytes`. An empty sources list includes no entities. Session range uses actual `localDate`; schedule range uses `originalDate`, preserving later `scheduledDate`. Body weights require their own explicit source opt-in. Local date semantics do not reinterpret source time zones.

Success: `{ ok: true, payload, json, manifest }`. Send the exact canonical `json` when budgeting this payload. Manifest carries captured identity/revisions, selected field whitelist, explicit source/range/date semantics, entity counts/identities, session statuses, temporary/completed set counts and schedule status/link/hidden counts. `utf8Bytes` is exactly `TextEncoder().encode(json).byteLength`; the manifest and outer request envelope are excluded. C must account separately for those bytes if included in its request limit. This is a UTF8 contract, not a model token estimate.

Failure: `{ ok: false, reason: 'over_budget', requiredUtf8Bytes, maxUtf8Bytes, action: 'revise_scope' }`, or `{ ok: false, reason: 'invalid_snapshot', detail }`. Neither has a partial payload or JSON. Caller must request a revised scope explicitly; builder never truncates notes, sets, dates or selected entities.

Plans/versions are included only as dependencies of selected sessions/schedules; only referenced plan days are included, preserving original plan/version/day identities and `date-day` versus legacy model discrimination. Versions omit `goalSnapshot` and `generationMetadata`; this is deliberately a selected-history DTO, not a restorable full PlanVersion. The exported `HistoryPlanVersion` reflects this omission. Plan metadata, original/actual exercise snapshot provenance, per-target metrics and exact planned/session/set notes are whitelisted. Full profile, memo, AI memory notes, unrelated days and arbitrary extra fields are not automatically included.

All four metric types retain their own fields; optional missing distance remains absent and zero remains zero. In-progress/abandoned sessions and uncompleted saved sets remain distinguishable; no completion facts are inferred. Browser form drafts are absent because input is committed entities. Replacement originalExerciseId and originalExerciseSnapshots survive. Entities are never merged by date; identities remain distinct. Sorting uses code-unit comparison independent of locale, entity IDs and exercise order/identity. Target set order remains semantic. Canonical object keys make JSON deterministic and detached from input.

## Evidence

- TDD: initial stub produced seven expected `not_implemented` assertion failures. Later scope test caught unrelated legacy plan day inclusion; missing referenced day test caught invalid linkage acceptance, both corrected and rerun.
- `npm.cmd test -- tests/domain/history-context.test.ts`: 1 file, 7 tests passed. Tests exercise input/output detachment, Unicode notes, replacement provenance, ordering permutations including nested exercises, four metrics/zero/missing, completed/temporary/ongoing states, inclusive range, legacy/new identities, field/source selection, exact UTF8 boundary, whole-result rejection, invalid range/revisions/duplicate IDs/missing version/day links.
- `npm.cmd run typecheck`: passed after final source changes.
- `npm.cmd test`: 12 files, 82 tests passed after final source changes.
- `npm.cmd run build`: passed (189 modules) before the final missing-day guard; final source guard was covered by targeted/full unit and typecheck. No app wiring changed.
- `git diff --check`: passed. Only builder, its test and this report are deliverables. No commits, shared schema/model/package/translations edits, real resources/model calls/network/deployment.

Existing dependencies reused via this worktree's node_modules junction to fitness-cal. Initial skill catalog tool attempted its external cache update and encountered EPERM; the escalation wait was interrupted. Coordinator supplied successful catalog evidence; no retry or external cache write was needed. Procmem, Karpathy and TDD instructions were read. No external memory record written; canonical experience storage is outside this worker's writable scope.

## Limits and follow-up

This is an independently testable pure builder, not UI consent, external transmission authorization, server request validation, cryptographic digest or stale-state lock. `capturedAt`/revision/generation are descriptive input values: C/caller must compare them with current state and bind confirmed input before sending/applying candidates. Typed committed entities are assumed already schema-valid; boundary checks here cover scope/metadata and selected references, not full untrusted backup validation. Completed schedule links remain source references even if linked session's actual date is outside scope; that session body is not silently pulled in.

Synthetic local tests do not validate phone capacity, model token budget, real D1/HTTP integration or production consent. Integration/review by coordinator remains pending; C may consume the API only after contract review and branch integration.

## Final coordinator closure — 2026-10-05
Final integrated typecheck/build and 112/112 unit tests passed; 158/158 Chromium/WebKit integration cases passed. Earlier pending integration statements above are historical. Large-capacity core 32/32 and corrected backup feedback 8/8 passed separately; counts overlap. See abcd-integration.md for exact commands, scope and unverified real-device/real-D1/model boundaries.
