# A — P0 capacity implementation / local verification

2026-10-05, baseline32f2c6bf427ebf77e63f78ba7e1b65f4faf30d1b, codex/abcd-integration. Isolated synthetic data only. Candidate L=16,777,216 UTF8 bytes; prior G1 measurements:5MiB note10,499,193 bytes,6MiB12,596,345,10k14,877,098. User delegated ABCD implementation decisions. This local candidate is not a physical-phone support guarantee or production-release approval.

Same full JSON3 format, old legal JSON2 accepted; strict references/unknown versions unchanged. Formatted export, raw File.size and final compact envelope use same byte guard; own supported exports remain accepted. Full memo and all facts retained. 8MiB duplicated-note library exceeds L and is refused without mutation, no infinite-growth claim. Old applications retain old capacity and model incompatibilities.

Export receipt captures dataRevision/restoreGeneration from the same read transaction as its blob. Replacement UI refuses a receipt whose revision differs from preview, resets kept/replacement confirmations on each fresh backup download, and clears preview/confirmations on CONFLICT. Existing serialized revision/generation guards remain final transaction authority. Actual download initiation does not check 'kept'. User must explicitly confirm possession and replacement. Public service booleans retain existing API semantics (not cryptographic proof a human kept a file).

Feedback zh/en: preparing, download started, explicit kept checkbox, oversized/unreadable/invalid-reference/version/stale/quota failure. A new successful-restore notice lives above the generation-remounted Routes in App, preventing the BackupPanel's success state from being lost. Notice clears on navigation and new restore.

TDD: candidate boundary test failed with10485760 vs16777216, then7 relevant unit tests passed. Final76 unit/typecheck/build passed. Successful-remount feedback test failed due missing result, then App added result state; final browser verification underway.

`node node_modules/@playwright/test/cli.js test --config playwright.abcd.config.ts tests/e2e/capacity.spec.ts tests/e2e/capacity-feedback.spec.ts tests/e2e/backup.spec.ts tests/e2e/cal-safety.spec.ts tests/e2e/cal-workouts.spec.ts --workers 1`

32 browser cases planned, final outcome pending. Prior intermediate runs: Chromium5/6MiB and10k actual downloaded JSON restored and full canonical fact/memo fields matched; WebKit5/6MiB actual round trips passed. Intermediate zh tests used navigator locale although application defaults English; corrected by explicit language selection. WebKit10k old fixture population already ~2.6min; with actual destination restore, earlier180sec test budget timed out and cleanup blocked. Correctness test now permits600sec with phase logs; this is not performance SLA. No physical phone or actual airplane-mode claim. HTTP blocking after module load verifies local transport independence only.

CAP map: A01 old5/6MiB actualdownloads; A02 exactL-1/L/L+1 plusUnicode; A03 6MiBcurrentdownload independently restored then small replacement; A04 existing backup/CALsafety/workout roundtrips; A05 unreadable unit, invalid/unsupported/unknown references/quota injection/stale and transaction rollback existing browser helper; A06 canonical fact+memo equality excluding operational metadata; A07 fixed100 completedtemporary sessions×100sets, four metrics2500each, fixedbilingual note distribution (not a full mixed-plan capacity profile); A08 HTTPblocked; A09 explicitzh/en download/kept/conflict/remount feedback. Mixed-plan10k and realphones are evidence gaps, not passed by inference.

Files: backup.ts, BackupPanel.tsx, App.tsx; capacity unit/browser helpers/specs/config; existing oversized test now references MAX_BACKUP_BYTES. No library/package/schema/model/route/backend changes. Source frozen during final browser run.

## Final coordinator closure — 2026-10-05
Final integrated typecheck/build and 112/112 unit tests passed; 158/158 Chromium/WebKit integration cases passed. Earlier pending integration statements above are historical. Large-capacity core 32/32 and corrected backup feedback 8/8 passed separately; counts overlap. See abcd-integration.md for exact commands, scope and unverified real-device/real-D1/model boundaries.
