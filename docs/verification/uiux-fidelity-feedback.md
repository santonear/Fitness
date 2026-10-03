# UI/UX fidelity feedback — local review handoff

## Authority and isolation

User/coordinator authorization: docs/verification/uiux-feedback-fix-handoff-2026-10-03.md in D:/Project/xxgospel/Fitness (read-only source). Exact baseline: af7e78d4d37fa5cb8b770468b3c75df5693b99de on codex/fitness-implementation. Branch: codex/uiux-fidelity-feedback; intended PR target: codex/fitness-implementation.

Implementation worktree: C:/Users/xxgos/Documents/Codex/2026-10-03/new-chat-3/work/fitness-feedback. The writable Documents clone was used because D:/Project is read-only in this session. Its parent is the exact authorized baseline fetched from the local product checkout. The coordinator checkout and its uncommitted documents were not copied into this branch or changed. docs/productdesign remains read-only.

The coordinator is the only review, integration and release entry. This branch may be committed locally. Do not push or create a draft PR until the coordinator confirms the remote target includes the full baseline above. Do not push integration, change the target to main, merge, tag, deploy, or edit release/branch protection settings. No such remote confirmation has been received; no push/PR has been attempted.

## Changes

- PlanEditor.tsx: one inline conflict message with English/Chinese cause and copy-name/reload/reopen guidance. Unsaved name remains in the editor; failed saves show no success.
- PlansPage.tsx: editor handles its own save/rename errors; other page operations retain their parent alert. Service calls, revisions and ongoing-workout rules unchanged.
- ExerciseEditor.tsx: report a save attempt before custom parsing, and on native required validation. This clears stale page feedback without saving or resetting inputs.
- WorkoutPage.tsx: the callback clears feedback only. Existing save callbacks, saved facts and per-action drafts remain intact.
- tests/e2e/feedback.spec.ts: 2 scenarios x 2 UI languages x 2 browsers, using real IndexedDB/services and conflicting revisions. No weakened existing assertions.

No product changes beyond these four files. No APIs, routes, models, styles, training logic, automatic saving, refresh recovery or completion facts added.

## Verification (Windows host)

Application: node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5181 --strictPort. Coordinator 5173 was not used or stopped.

Temporary config outside repository: C:/Users/xxgos/Documents/Codex/2026-10-03/new-chat-3/work/feedback-playwright.config.mjs. baseURL http://127.0.0.1:5181; viewport 320x700; Chromium and WebKit; outputDir C:/Users/xxgos/Documents/Codex/2026-10-03/new-chat-3/work/feedback-test-results. Source and tests were frozen during each browser run.

RED before fixes: all 8 new feedback cases failed, reproducing duplicate plan alerts and stale set-save success. A subsequent native-required check reproduced stale success in all 4 English/Chinese browser cases before the onInvalid fix. Logs: C:/Users/xxgos/Documents/Codex/2026-10-03/new-chat-3/outputs/feedback-red.log and feedback-native-red.log.

Final command: node node_modules/@playwright/test/cli.js test --config C:/Users/xxgos/Documents/Codex/2026-10-03/new-chat-3/work/feedback-playwright.config.mjs tests/e2e/feedback.spec.ts tests/e2e/fidelity.spec.ts tests/e2e/plans.spec.ts tests/e2e/plan-delete.spec.ts tests/e2e/workouts.spec.ts --workers 2

Result: 40/40 passed, exit 0 (1.1m). Breakdown: feedback 8, fidelity 10, plans 8, plan-delete 6, workouts 8. Existing coverage includes legal JSON import, varied-week plans, immutable versions/schedules/completion facts, draft failure/restore, deletion, and workout lifecycle. New cases verify single localized rename alert, retained name, no false success, unchanged facts; new/update-set success, custom/native validation failures, other action drafts, and real service CONFLICT. Existing fidelity storage-failure coverage also ran. Initialization awaits actual DB readiness/editing values, not sleeps; empty-editor fixture prevents a preexisting field value from masking async initialization.

Final npm run check (invoked via node C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js run check): typecheck passed, 55/55 unit tests passed across 8 files, build passed, exit 0. One initial runner invocation used a nonexistent local npm entry; corrected to installed npm before the successful check. git diff --check passed.

Logs: C:/Users/xxgos/Documents/Codex/2026-10-03/new-chat-3/outputs/feedback-check.log and feedback-browser.log. Screenshots: C:/Users/xxgos/Documents/Codex/2026-10-03/new-chat-3/outputs/feedback-plan-conflict-en.png, feedback-plan-conflict-zh.png, feedback-workout-invalid-en.png, feedback-workout-invalid-zh.png. Screenshot viewport 390x844; browser regression viewport 320x700. Plan screenshot: unsaved name + single alert. Workout screenshot: invalid next input + unchanged saved set + other action draft, no stale success.

## Risks / not verified

Local Windows Chromium/WebKit only; Linux CI, full browser suite, physical devices and history/dashboard capacity performance not run. No remote CI evidence because no PR is authorized yet. Existing metric-validation messages remain the service/parser's English text even under Chinese UI; localization beyond the authorized conflict guidance was not added. No new business writes: callbacks only clear UI feedback.

Training, history, backup and language behavior were exercised by the relevant cases above, not claimed as exhaustive certification. Capacity remains: 合成数据下已复现，安全出口待决策. No limits/formats/memos/restore prerequisites changed. Real-device formal measurement stays 50 samples per round, at least 2 rounds; 20 is exploration only. Actual device versions still require recording; real-device measurement is not a new requirement of this round. AI phase schedule unchanged.

Personal skill catalog lookup returned cache-write EPERM; relevant available/canonical skills were read directly. Canonical experience library remains outside session write permissions; no substitute global memory/rules were edited.

## Next coordinator action

Review the local commit/diff and validation artifacts, then confirm remote codex/fitness-implementation contains af7e78d4d37fa5cb8b770468b3c75df5693b99de. Only after that confirmation may UI/UX push its own branch and open a draft PR. Approval and publication are not implied by this handoff.
