# V6.2 implementation — canonical plan

Status: P-A shell implemented locally; 8 shell browser tests, 6 AI flow browser tests, 25 selected unit tests, typecheck and build passed. Avatar final design sign-off and real-device testing remain pending. P-B through P-E not complete. Design HTML located at C:/Users/xxgos/Desktop/UIUX/Fitness_UX_V6_2_Floating_AI_Coach_Reminders_20261009.html. SHA256: 6F3B85B46E9C913461B25F4D74EAC31B5CF9D56A1F9AA60026200D2EDDAAA381. Handoff Markdown read in full; HTML initial structure and floating-assistant script inspected. Full semantic review/render and asset approval remain pending.

Baseline: worktree fitness-guided, base branch codex/temporary-budget-bypass; implementation branch codex/v62-coach-reminders, HEAD 07fb6c630c6a6a9b53d5d727c7394debfa715cea. Preserve 20 modified tracked files and unrelated untracked artifacts. Root and worktree AGENTS.md files absent; apply conversation instructions. Owner for all shared files: primary agent, no delegated writes.

## Mapping and real sources
| Design/state | Proposed component | Existing integration | Verification |
|---|---|---|---|
| Global launcher / edge docking | FloatingCoachLauncher, CoachAvatar | App.tsx outside route switch, Appearance | one instance, theme and route persistence |
| Shared conversation drawer | CoachDrawer / shared coach session | GuidedDialoguePage, application/guided.ts, backend/guided-provider.ts | drafts/candidates survive close and navigation; no automatic request |
| Reminder bubble | CoachNudge | read-only plan/task/session snapshot | identity, version and completion provenance |
| Reminder settings | CoachPreferences | SettingsPage, profile identity | bilingual settings, keyboard and persistence |
| Save / modify / pause / cancel | shared coach modes | day-plans.ts, plans.ts, workouts.ts, ai-candidate-save.ts | version conflict and atomic rollback; completed history preserved |
| Restore invalidation | reminder coordinator | backup.ts, repository metadata restoreGeneration | no resurrected reminders/candidates |

HTML read and rendered in three themes at desktop/mobile widths. SHA256: 6F3B85B46E9C913461B25F4D74EAC31B5CF9D56A1F9AA60026200D2EDDAAA381. The original 120×120 SVG character is implemented in CoachAvatar.tsx; no board crops or demo facts are used.

## Proposed reminder contract
Preferences: profileId, enabled, dailyLimit (0/1/2), quietStart, quietEnd, fixed IANA timeZone, dockSide.
Record: reminderId, profileId, restoreGeneration, taskId?, planVersionId?, sessionId?, scheduledDate, scheduledStartTime?, timeZone, kind, windowStart/End, status, shownAt?, dismissedAt?, snoozeUntil?.
Coordinator metadata: monotonic lastEvaluatedAt, per-day shown counts, category lastShownAt. Pure rule evaluation produces at most one eligible candidate; IndexedDB read/write transaction revalidates generation, source identity and limits before atomic claim. BroadcastChannel is notification only, not the lock.

Suppress when hidden/unfocused, training active, onboarding incomplete, chat/modal open, disabled, quiet hours or snoozed. Prioritize upcoming real pending task (inclusive T-90 through T-30), then verified completion, then idle neutral encouragement. Do not backfill after sleep. No model call and no training writes.
Use persisted profile/calendar zone for daily limits; device-zone changes do not reset counters. Invalid zones and nonexistent DST local start times suppress reminder; ambiguous local times require a single deterministic occurrence (earliest), with stable task/day key preventing repeats. Clock rollback suppresses evaluation until persisted watermark is reached. Same task/day dedupe survives version/time edits; changed sources invalidate displayed candidate.
Proposed backup boundary: device-local reminder history stays outside portable training backup; restore-generation change invalidates pending sources while preserving suppression/count ledger. Confirm against existing export/import validation before schema edits. Preferences compatibility documented explicitly; no AI entitlement in backup.

## Ordered phases and checks
1. Obtain/read/hash/render HTML; compare current screenshots, assets and business modes. Preserve prior changes in scoped branch. No model/image generation expenditure.
2. P-A: single launcher/drawer, reviewed avatar assets, docking/focus/Escape/reduced motion. Component and route-persistence tests.
3. P-B: pure reminder engine and atomic store; boundary, DST, time rollback, cross-tab and snooze tests using synthetic clock/snapshots.
4. P-C: actual local task/session adapters, settings and restore integration. Offline, backup and cancellation regression.
5. P-D: unify create/modify/pause/cancel using existing service semantics; advisory versus blocking AI questions distinguished. User-selected exact dates, preview and explicit save. No visible usage counts; retain approved backend protections. No paid model tests.
6. P-E: three themes at 320/375/390/420/768/1024/1440, Chromium/WebKit, keyboard/focus/ARIA and screenshot comparison. Real-device evidence requires actual devices; simulation explicitly labeled.
7. Update docs/uiux/UIUX20261008.md with source hashes, data contract, tests, screenshots, limitations and rollback. Do not edit docs/productdesign. User has approved PR and public publication after full delivery.

Cost strategy: one implementation owner, no subagents or paid model calls; scoped checks followed by one integrated browser run. Preserve valid evidence and rerun affected failures only. Physical mobile devices are unavailable and must remain explicitly unverified.
