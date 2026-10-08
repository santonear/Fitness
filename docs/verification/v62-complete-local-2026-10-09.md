# Fitness V6.2 — local verification and release record

Date: 2026-10-09 (Asia/Shanghai). Baseline: 07fb6c630c6a6a9b53d5d727c7394debfa715cea. Implementation branch: codex/v62-coach-reminders. Owner: primary agent. No delegated implementation or paid model tests.

## Scope delivered

- Global original ceramic sprout avatar with four real states, two docking sides, recoverable collapsed entry and a persistent conversation drawer.
- Create, independent-day modification and existing pause/cancel lifecycle within the same coach. Optional AI questions do not block understanding approval; essential clarification remains a refusal. Unscheduled draft precedes exact user-selected dates and explicit save.
- Device-local deterministic reminders, actual task/session sources, atomic cross-tab claims, daily cap, quiet hours, snooze, dismissal, restore/clock/DST protection and Settings controls.
- Weekly frequency 1–7 in onboarding, removal of understanding quota admission and redundant checkbox, explicit send-consent button, no user-facing understanding/generation counters. Backend generation/summary safeguards and existing temporary monetary-policy bypass remain intact.

## Evidence

- TypeScript passed; unit suite: 439 tests in 58 files passed.
- Production build passed. App JavaScript approximately 495 kB raw / 158 kB gzip before final visual polish; final build manifest recorded with release.
- Four coach action scenarios passed in Chromium/WebKit: real day replacement, reviewed lifecycle transitions, optional suggestions and essential clarification refusal.
- Real source tests passed in both engines: competing tabs yield one claim; actual completed set/session produces completion encouragement; backup restore keeps training facts and device suppression; changed time cancels old reminders without replay.
- Reminder View / four-hour snooze / Dismiss UI passed in both engines without model POSTs or training dataRevision changes.
- Three themes × seven widths (320/375/390/420/768/1024/1440) rendered in both desktop browser engines. Source tests include keyboard, focus return, reduced motion, route/draft preservation and onboarding gate.
- Integrated browser run and affected retests: final results appended below. A test fixture initially tried to complete a workout without a completed set; corrected to use the real recordSet/completeWorkout flow. Comparison of restored facts now canonicalizes object keys rather than treating JSON key order as changed facts.
- Portable training snapshots exclude the new device-only coachDevice table. Reminder-specific tests separately assert this table is retained through restore. Whole-training rollback assertions remain intact.

## Design and screenshots

Reference SHA256: 6F3B85B46E9C913461B25F4D74EAC31B5CF9D56A1F9AA60026200D2EDDAAA381.
Actual component/gallery and application captures: outputs/v62-coach. Reference-only captures: outputs/v62-reference. The avatar is original inline SVG with a 120×120 viewBox, no external image calls and no prototype board crops. Component gallery captures are identified as galleries, not product-flow evidence.

## Review boundaries

Explicit send consent precedes every model request. Reminder code does not import transport or write training facts. Plan modification validates source snapshot, revision, restore generation, profile/onboarding dependencies and existing day-save protections. Lifecycle actions re-use existing services and cannot introduce a new task status. Failed local saves do not resend AI requests.

Old managed-phase and complex weekly-plan editing remains in its existing editor. The coach independent-day modification path does not claim to replace these distinct editors. The existing single nonterminated phase constraint remains enforced.

## Unverified and production boundary

Physical iPhone 16 Pro Max/Safari and OnePlus Ace 5/Chrome were unavailable. Desktop WebKit/Chromium narrow layouts are not physical-device or real keyboard evidence. No live paid-model quality/latency test was run. Final artistic preference acceptance is distinct from code verification.

Read-only production preflight succeeded: external control mode and required secret bindings present, production ledger revision 98. Existing pricing evidence expiry is 2026-10-08T00:00:00Z (already expired); this task does not silently change prices or extend that timestamp. Existing planningBudgetDisabled policy is preserved. This preflight is not a deployment or paid AI verification.

## Release

Pending final local verification, one scoped PR and authorized public deployment. Before/after binding and ledger equality plus public route and asset checks must be recorded before claiming release success.

## Final local closure

The interrupted 490-case integrated run recorded 450 passes, 36 failures and four missing outcomes. All failed-file and missing-outcome coverage was subsequently run in a bounded 140-case pass: 136 passed, four new UI assertions remained. Final focused coach run: 20/20 passed, resolving those four remaining cases. Large WebKit backup (10,000 records), restore, old schema migration, read-only snapshots, trial states, Progress and history all passed in the affected run. No outstanding local test failure remains; this is combined evidence, not a claim that the interrupted run itself was green.

Final UI: send action occupies its own drawer footer, avoiding WebKit sticky/scroll clipping; new route dates require explicit adoption without clearing the goal; portal output exists only in create step 1. Three-mode and focus regressions passed. Typecheck passed after the final code change; production build passed. Existing 439-test unit evidence is reused because the last edits affect layout/navigation only.

Actual app captures: [Atlas mobile](../../outputs/v62-coach/atlas-390-webkit.png), [Atlas desktop](../../outputs/v62-coach/atlas-1440-chromium.png), [Serene mobile](../../outputs/v62-coach/serene-390-webkit.png), [Serene desktop](../../outputs/v62-coach/serene-1440-chromium.png), [Orbit mobile](../../outputs/v62-coach/orbit-390-webkit.png), [Orbit desktop](../../outputs/v62-coach/orbit-1440-chromium.png). [Original avatar component states](../../outputs/v62-coach/avatar-states-chromium.png).
