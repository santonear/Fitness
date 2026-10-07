# Training dates, times and duration

Owner: current Codex task. Branch: codex/training-time-schedule. Baseline: b2792df.

## Confirmed behavior

- Ask for a 1–14 calendar-day planning window, usual start time and session duration.
- Understand the user's goal and constraints in the existing conversation. Before generation, let the user select training dates and confirm or edit each start time.
- Explain allowance consumption at the confirmation action. Only then generate and save the complete plan; show exercises and estimated work/rest time per set.
- Display saved sessions in month and day views. Dragging a pending session changes its time only after confirmation, including the overall plan. Cancel leaves stored data untouched. Time changes do not call AI.
- Preserve existing data, completed/in-progress training, restore/concurrency guards, consent and financial accounting.

## Implementation and verification

1. Add validated optional scheduling and set timing data with old-data compatibility and backup round trips.
2. Add atomic guarded rescheduling and adoption of confirmed schedules.
3. Support 1–14-day confirmed schedules in AI contracts/provider, with bounded responses and timing validation.
4. Connect conversation → per-day confirmation → generation/save, and calendar display/drag confirmation.
5. Test bounds, stale writes, cancellation, protected history, four different start times, no premature AI call, and persistence. Run affected and full regression checks and targeted review.
6. Prepare PR and release using existing user authorization; preserve secrets and live ledger. Verify public assets and access boundaries without paid model calls.

## State

Implementation complete. Typecheck/build and 386 unit tests passed. Chromium/WebKit dialogue tests passed (36). Full regression and release verification are in progress; no public release claim yet.
