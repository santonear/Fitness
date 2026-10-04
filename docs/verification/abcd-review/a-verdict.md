# A independent review — frozen 2026-10-05 snapshot

Scope: A and global requirements in docs/superpowers/plans/2026-10-05-abcd-parallel.md; baseline 32f2c6b; diff docs/verification/abcd-review/a-review.txt. Read actual backup service, repository, BackupPanel/App, capacity helpers/specs/unit test and implementation report. No source/test/resource changes, no test reruns.

## Verdict

Spec: substantially implemented, conditional pending final browser evidence and recovery finding below. Quality: one P2 recovery defect; no newly identified P0/P1 data-integrity defect from static review. Not a production or phone-capacity approval.

The 16,777,216-byte guard is consistently applied to formatted Blob export, input File.size, and serialized validated import. Own legal exports fit the input guard. JSON2/3 validation remains strict and unchanged. Export receipt and blob share the read transaction; UI compares its revision to preview; final repository write validates revision/generation in its whole-store transaction. Full memo reconstruction and table replacement remain intact. Download initiation no longer implies file possession; explicit kept/replacement checks remain required. Backward-compatible boolean service confirmation is its existing contract, not evidence of cryptographic receipt binding.

## Finding

[P2] Reset the file input when discarding a stale preview.

File: .worktrees/fitness-abcd/src/ui/components/BackupPanel.tsx:46 (related input:61).

On CONFLICT the new handler removes preview and all confirmations, while retaining the native file input selection. Both languages tell the user to select the restore file again. A native picker selecting the same unchanged file does not dispatch change, so the sole validateBackup path does not execute and the preview stays absent. The user must reload or choose another file first. This is especially likely when an unrelated current-library write invalidates confirmation: the original restore file is still the correct one. Clear the native input value or remount that input along with invalidating preview.

Reproduction/acceptance: choose backup A using native picker; download current data and check both confirmations; cause a body-weight write; attempt replacement and observe CONFLICT; reopen picker and select unchanged A; assert validation summary returns and fresh current-data download is possible. Also assert the input value is empty after conflict. Existing capacity-feedback tests stop after conflict, and setInputFiles can synthesize change independently of actual same-selection picker behavior, so they do not cover this recovery.

## Evidence limitations

- The implementation report explicitly leaves the final 32 browser cases pending. Unit/typecheck/build pass claims were read from that report, not independently rerun here. Final browser run outcome is required before accepting A.
- Exact L-1/L/L+1 and Unicode are covered by a padded small valid JSON fixture; this proves raw-byte boundary behavior, not a large mixed-profile memory/performance guarantee.
- Large 10k fixture contains temporary completed workouts only. Mixed planned/legacy/date sessions, archived versions, timers and provenance at that scale remain unverified. Small existing backup/calendar cases support semantics but cannot substitute for the missing large profile.
- Offline case blocks HTTP after modules load; it proves local transport independence, not a full cold-start airplane-mode workflow.
- Existing backup.spec covers separate origins plus a sibling with BroadcastChannel disabled; repository guard is statically sound, but final cross-tab/rollback outcomes remain subject to the pending run.
- English success-remount assertion exists; zh/en download/stale messages are tested, but successful restore-remount feedback has no explicit Chinese assertion.
- No physical-phone evidence, as explicitly deferred. No issue inferred from unavailable phone results.

[P2] End the preparation status when file validation succeeds.

File: .worktrees/fitness-abcd/src/ui/components/BackupPanel.tsx:69 (run status assignment:32).

run sets the live message to Preparing backup or validating file / 准备备份或校验文件中，请稍候. The file-selection operation only sets preview after successful validateBackup, and finally only clears busy. Consequently the page simultaneously renders Backup validated and a persistent Please wait message, with actionable download controls enabled. This contradicts the required truthful preparing/validated feedback and leaves the live region reporting work still running. Set a completed validation message or clear it on this success path.

Reproduction/acceptance: select a valid backup, await Backup validated, then assert the preparation/wait text disappears and the live region contains a finished validation status (or is empty), in both locales. Existing feedback test only checks that Backup validated exists.

Amended quality verdict: two P2 UI recovery/status defects; no newly identified P0/P1 data-integrity defect. Fix both before accepting the UI feedback requirement.
