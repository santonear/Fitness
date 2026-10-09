# V7.1 Coach contracts

Source baseline: d1e5e12c538e7b54a25d7ff2c4cd1a0f4a4d2af2. Implementation lives on codex/v71-coach-intelligence, not the older root worktree.

## One reachable flow

`OnboardingV4Page` already presents ten V5 stages → confirmed local summary → `CoachRoute` opens the single `FloatingCoach` → `GuidedDialoguePage` sends necessary confirmed fields → unscheduled proposal → user selects exact dates and times → optional body fields/history review → date candidate → explicit atomic local save. `AiPage` is a compatibility implementation, not a second App route. Existing Today, Plans, Workout, Progress and Backup services remain authoritative.

The create/modify/manage modes share the global drawer. Closing preserves mounted state; route cleanup invalidates pending opens. Restore-generation changes still remount the local library boundary to prevent saving stale candidates. The P0 route race is reproduced and fixed; the reported physical-phone disappearance is not declared resolved without device evidence.

## Prompt registry

Backend `coach-prompt-registry.ts` defines safety, create, generate-days, modify, manage and clarify, each with a stable `fitness/...` ID and `v7.1.0` version. `guided-provider.ts` composes task rules with the existing schema and catalog instructions. No new provider, endpoint or model is introduced. Build verification checks that prompt text does not enter production browser assets.

Legacy non-coach summary/date adapters keep their compatibility contract, including their existing K=1 behavior. Coach maximum capacity remains 14 and server-configured K can be smaller. This is intentionally not a change to approved limits or the current disabled monetary-budget setting.

## Context and consent

| Desired concept | Existing/extended contract |
|---|---|
| Request/conversation identity | requestId, conversationId, version |
| Restore and authorization | restoreGeneration, canonical inputSnapshot and hashed sendConfirmation |
| Required confirmed scope | scope.goal, scope.conditions, confirmedSummary |
| Optional body | scope.body only contains individually selected fields; retains source and observation metadata |
| Optional history | scope.history omitted by default and when declined; existing selected-range capture |
| Conversation summary | deterministic excerpt of at most eight messages, at most 1600 characters each, no invented summary facts |
| Exact date authorization | dates, schedule, startDate/endDate, timeZone |
| Modification target | targetPlanRef: planId/versionId/taskId/revision, included in consent identity |
| Catalog slice | existing 64-entry selection, IDs/equipment/metricType/allowedMetrics; client and server use the same slice |
| Server metadata | coachContract stores task/prompt/schema/catalog version beside existing request digest; no dialogue/body/history text |

The excerpt policy is shown before sending. Scope is bounded to 49152 UTF-8 bytes, history to 32000 characters, request identity snapshot to 65536 characters; existing total transport byte limits remain authoritative. Changes invalidate reviewed sending. Body freshness compares only selected fields, while existing relevant profile/restore dependency checks remain in force.

No change to provider logging/retention terms is claimed. Local ledger exclusion does not imply provider zero-retention. No APM service was introduced.

## Response compatibility adapter

The strict provider discriminated union remains behind the existing versioned transport:

| Provider reply | Existing client review |
|---|---|
| proposal {summary,sessions,needsExactDates:true} | understand + human-readable unscheduled draft; no date candidate/save |
| clarify | one question; no automatic request loop |
| program | candidate validated against exact dates, timings and catalog |
| change_proposal {targetPlanRef,...program fields} | target identity must match; candidate goes to existing before/after editor |
| management_proposal {message,supportedOperations,impact} | explanation only; accepted operations are paused/active/terminated |
| refused | existing safe refusal and user recovery path |

Old understand/program replies remain accepted for compatibility. Metadata is assigned by the server. Unknown response fields are rejected. Management suggestions have no write authority; existing explicit confirmed domain actions decide state. No cancelled task state or new history deletion is introduced.

## Evaluation and release boundaries

`coach-evaluation.ts` reuses request and response validators, reports structural failure and deterministic equipment issues where the equipment vocabulary is known, and explicitly lists human-review dimensions. `evaluateAiCandidate` delegates guided requests to it. This is offline assessment, not clinical validation or a real-model quality baseline.

Review rubric: (1) adult scope, symptoms, privacy and write authority; (2) feasible equipment/time/volume/recovery; (3) goals and restrictions without invented facts; (4) necessary, nonrepetitive questions with optional continuation; (5) understandable rationale, uncertainty and next action. Structural failures reject the candidate; semantic suitability in free-form language still needs human review. No invented numerical pass-rate target.

Existing unit suites cover dates/metrics/restore/consent/accounting concurrency/pending costs/legacy conflicts; new cases cover prompt separation, bounded excerpts, structured unscheduled proposals, management states and version metadata. Browser tests cover proposal review, selective body transfer, target-bound modification, explanation without mutation, access recovery and reopen. Actual paid-model latency/cost/quality measurements and both physical devices remain pending separate access/authorization. No production migration, merge or deployment was performed.
