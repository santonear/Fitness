# V7.1 implementation and acceptance

Owner: coordinator, single-agent local implementation. Branch: `codex/v71-coach-intelligence`.
Baseline: `d1e5e12c538e7b54a25d7ff2c4cd1a0f4a4d2af2`, verified against remote main on 2026-10-09.
Root worktree is older and dirty; preserve it and all existing untracked artifacts. Do not edit `docs/productdesign`.
Design SHA256: `B75057916EED99461ABB99717021CB7E843EEC3F2E3A722AD4D4C7AE431A3732`.

## Reuse and ownership

| Flow / design | Existing owner | V7.1 work / verification |
|---|---|---|
| Ten-stage onboarding and summary | OnboardingV4Page, onboarding-v5 | Preserve saved answers and adult gate |
| Global chat, /ai deep link | FloatingCoach, CoachRoute | Reopen, async route races, focus and viewport |
| Create, proposal, selected dates, review | GuidedDialoguePage | Keep one reachable flow; bounded authorized context |
| Modify / management | CoachPlanActions, coach-plans | Bind immutable target identity; preserve domain operations |
| Supplier prompt | guided-provider, prompt, deepseek | Backend-only versioned registry, no new supplier path |
| Context and response | guided-ai-contracts, guided-dialogue | Strict bounded schema; reuse identity and consent validation |
| Candidate save | guided, ai-candidate-save, day-plans | Reuse atomic save, revision, occupancy and restore guards |
| Quality | prompt tests, guided-provider tests | Offline deterministic cases plus explicit human-review rubric |

All files are owned by this coordinator; no parallel agents. Shared limits belong in the domain layer, not an imported backend prompt module. AI output has no write authority. Existing control-service configuration remains authoritative; this task does not reinstate disabled budget settings or change K.

## Contract proposal

Keep the existing versioned transport and request identity. Introduce backend-owned prompt IDs for safety/create/generate-days/modify/manage/clarify. Adapt existing understand+draft to Proposal and program to DateCandidate; do not create parallel endpoints. Bind modification to plan/version/task/revision. Management stays an explicit domain command and must not invent cancelled tasks. Server-owned metadata is constructed after validation, never accepted as a chat override. No clinical quality claims from schema tests.

## Sequence and evidence

- [x] Read handoff; verify local and remote source baseline; isolate branch.
- [x] Render reference and record component mapping.
- [x] Reproduce close/reopen and route-race cases; repair only demonstrated failures.
- [x] Registry, bounded context and strict response integration with targeted unit tests.
- [x] User-readable scope, candidate and modification review; no raw JSON in user views.
- [x] Offline quality suite and human-review criteria.
- [x] Typecheck/build, impacted browser regressions, three-theme screenshots, UIUX20261008 update.

P0 mobile acceptance: iPhone 16 Pro Max Safari and OnePlus Ace 5 Chrome remain unverified until physical devices are available. Browser emulation is supplemental. Never mark P0 fully accepted without that evidence.

Evaluation matrix: adult/minor; beginner/experienced; equipment/time/restriction constraints; unknown measurements; declined history; cross-month exact dates; invalid IDs/metrics/JSON; prompt injection; stale identity/restore; concurrent budget admission; timeout/unknown charges; occupied/completed/in-progress dates; supported management; en/zh. Reuse unchanged existing boundary tests, add only missing cases. No paid model calls, migrations, production changes, merge or release in this local implementation.

Local evidence: docs/verification/v71-local-2026-10-09.md. Physical-device acceptance and real-model semantic quality remain pending; no release authorization is inferred from historical approvals.
