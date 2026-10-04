# D — P1 VIS verification (2026-10-05)

Baseline `32f2c6bf427ebf77e63f78ba7e1b65f4faf30d1b`, branch `codex/abcd-vis`, isolated worktree `.worktrees/fitness-vis`. No commit, push, service changes, dependencies, data schema or shared translation edits.

## Implementation and boundary

- `src/ui/components/ExerciseTargets.tsx`: renders existing current workout snapshot targets in ordered groups, with reps/kg/s/km. Distinguishes 0 kg, missing distance, 0 distance, and empty target arrays. Count/target location is visible before expanding. React text nodes preserve notes and escape markup; pre-wrap/anywhere preserves lines and wraps long notes.
- `src/ui/components/ExerciseEditor.tsx`: replaces JSON target display, exposes planned notes and saved set notes separately, and labels current unsaved inputs. An unchanged saved form is not labeled unsaved. Form state, keys, native validation, callbacks and timer behavior retained. No prefill, autosave, copying, new notes layer or write path.
- `src/ui/pages/WorkoutPage.tsx`: coordinator explicitly approved a one-line prop passing the original snapshot matched by exerciseInstanceId. Renderer independently checks this identity. Replacements show original reference provenance and original notes; cross-type targets cleared by existing service remain absent and are not reconstructed. Shared WorkoutPage is also embedded in Today.
- Isolated unit/browser tests and `playwright.vis.config.ts`; Vite port 5188 and output `test-results/vis`, report `test-results/vis-report.json`. Existing dependency directory is a junction to fitness-cal; no installation/package changes.

## Evidence

- TDD: initial renderer stub produced 3 expected assertion failures (missing readable units, empty/source notes and replacement labels). Then implementation passed. A fourth meaningful regression first failed because unchanged saved rows were incorrectly labeled unsaved (2 labels rather than 1); dirty comparison fixed it without changing state ownership.
- `npm.cmd test`: 12 files, 79 tests passed (latest run 01:21 local execution time).
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed, 190 modules.
- `git diff --check`: passed.
- Browser batch command: `npm.cmd run test:e2e -- --config playwright.vis.config.ts tests/e2e/vis.spec.ts tests/e2e/feedback.spec.ts tests/e2e/fidelity.spec.ts tests/e2e/workouts.spec.ts tests/e2e/timer.spec.ts`.

Browser completion is **unverified**: final sandboxed session `13208` logged all 40 Chromium/WebKit cases green, but stalled at server teardown without exit 0 or final JSON report. `test-results/vis-report.json` remains the stale earlier port-in-use failure report, not evidence for the green cases. An interrupt plus escalated rerun was requested in one tool call; that tool was aborted by user after 879.9 seconds and returned no exec result/session/PID. Do not assume the escalation ran or the interrupt completed. Coordinator takes over process cleanup and final integration verification. Earlier session `71567` logged 38 green cases then was interrupted; no interrupted batch is counted as a completed command. Direct node Vite did not resolve teardown in sandbox. No further worker tests are running intentionally.

Earlier fixture/locator fixes: save UTC profile before UTC plans; use translated group name after language switch; use accessible combobox role for replacement. No product fixes were needed. At coordinator request, the final layout test now covers zh/en × Today/Workout × 320/390/768/1440; **this last test-only expansion has not been run**. Production source was unchanged after the 79-unit/typecheck/build evidence.

## Coverage and self-review

VIS-A01: all four valid catalog metric fixtures; nonuniform groups, 1250 g, 90 s, 1500 m, 0 kg, missing/zero distance. Unit asserts immutable input; browser compares planVersions, schedules, sessions, sets and trainingMemo around view/expand.

VIS-A02/A04: separate scheduled dates show their own snapshot; added and temporary exercises have explicit no-target messages. Same-type replacement is exercised through existing service (current catalog has one exercise per metric type, so selecting the identical selected option cannot fire an HTML change event); cross-type replacement uses UI. Original notes stay reference-only, actual notes stay empty.

VIS-A03: planned multiline Chinese/English and long script-like notes; saved notes separately displayed; draft survives label language change; script text does not execute and unit confirms escaping.

VIS-A05: existing feedback/fidelity/timer/workouts regressions cover saving A retaining B, invalid/native validity clears old success, failed save retains drafts, restored generation invalidates drafts, stop timer only provides candidate, completion/history read-only, removal and transactions.

VIS-A06: observed green case logs for Today/Workout English 320/390/768/1440, Chinese label and retained draft checks, offline expand with unchanged facts. Final test expands the full bilingual layout matrix; awaits coordinator execution. Desktop Chromium/WebKit are not real phone evidence. No new history UI is introduced.

Self-review: original source is matched by exercise instance rather than date/catalog position; no read initiates service mutations; no current latest-plan reads; target/actual values remain separate. Existing input control for notes remains single-line; preserved multiline saved/planned text is shown readably without introducing a new note editor.

## Skills and experience

Read canonical Karpathy, ProcMEM and TDD skills. Reused `D:/AI-Library/memory/records/2026-10-03-2225-fitness-form-identity-plan-rename-af7e78d.md`: preserve own-action reset keys, restore/terminal lifecycle invalidation, wait for committed profile fixture. Canonical skill catalog cache write was denied outside workspace; coordinator completed scan separately. Canonical memory is readable; no external memory writes under this worker's explicit no-external-changes boundary. Coordinator may persist the verified reuse outcome after final review.

## Final coordinator closure — 2026-10-05
Final integrated typecheck/build and 112/112 unit tests passed; 158/158 Chromium/WebKit integration cases passed. Earlier pending integration statements above are historical. Large-capacity core 32/32 and corrected backup feedback 8/8 passed separately; counts overlap. See abcd-integration.md for exact commands, scope and unverified real-device/real-D1/model boundaries.
