# Committed AI context and candidate saving

`createAiContextService(repo).capture(scope?)` captures profile, dataRevision and restoreGeneration in one whole-library read transaction. History is omitted by default. Explicit scope returns exact canonical HCTX text plus the existing manifest. Over-budget history rejects the whole selection, with no truncation. No stored memo reads/rebuilds/writes occur.

`createAiCandidateService(repo).prepare(request, unknownCandidate)` verifies shared request confirmation, goal confirmation, catalog/date bounds and candidate metrics. It returns a frozen opaque service-owned token without writing. Scoped HCTX is compared against the current committed selected entities; supplied history cannot invent records. `save(token, [{date,name,exercises}])` supports exactly one requested day, validates edits, and creates version/plan/task plus the normal data revision in one repository transaction. Plan source is AI; confirmed goal, request conditions, request ID, contract prompt version and preparation timestamp are persisted. No model name is invented because this input contract does not identify one.

The final transaction checks restore generation, current profile calendar zone/relevant training conditions, selected history and current slot occupants/provenance. Profile locale, legacy weekly weekdays/count and timestamp-only changes do not invalidate a candidate. Unrelated writes do not cause a blanket dataRevision conflict. Completed hidden legacy tasks and hidden ongoing tasks remain occupied. Existing identities are never overwritten. Failed validation/conflict/quota save leaves the token retryable; committed success is protected by token state and persisted request ID, preventing both token and freshly prepared request replay.

Verification on 2026-10-05:

- `npm.cmd run check`: exit 0; typecheck, all 112 unit tests in 17 files, and production build passed. Existing Node experimental SQLite warnings remain.
- Final targeted Chromium/WebKit result: 28/28, exit 0. Combined regression is reported in next-integration.md.
- Browser assertions use random isolated `next-context-*` databases and local Vite port 5203. They cover capture/prepare no writes, exact HCTX transport/manifest bytes, strict date/catalog/metric rejection plus corrected retry, selected versus unrelated history writes, restore/timezone/profile changes, irrelevant profile changes, occupied/current/hidden-completed/hidden-ongoing slot protection, synthetic quota rollback and retry, old CAL identities/full facts/persisted memo and persistent request replay.
- The fidelity assertion compares exact persisted memo and immutable memo session facts. Backup export intentionally synthesizes current export time/sourceRevision; these export-only headers differ across legitimate exports and are not persisted memo mutations.

WebKit logged Dexie deletion-blocked warnings while deletion promises completed. These checks are not clean-console assertions.

This is actual local browser/IndexedDB verification using synthetic fixture data. It provides no real D1, supplier billing, real model output, real-user history transmission, deployment, embed or physical-phone evidence. Combined regression is recorded in next-integration.md.
