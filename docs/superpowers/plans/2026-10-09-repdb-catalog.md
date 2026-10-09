# RepDB catalog implementation

Approved scope: 637 RepDB exercises, Chinese names/search aliases (English instructions explicitly labeled), existing Exercises UI and attribution, manual training and controlled AI selection. No changes to qualification, budgets, invitation flow, calendar persistence, existing UUIDs, or historical facts. No paid model/translation calls or delegated agents.

Baseline: e94c59f; branch codex/repdb-exercise-catalog in existing fitness-guided worktree. Root checkout has unrelated design edits; do not touch. Existing four exercise IDs and metric semantics remain permanently supported. Keep UUID business IDs; canonical slugs and provider IDs are separate metadata. No Dexie migration.

## Ordered delivery
1. Versioned adapter/build: pinned official archive SHA256; validate real schema v3 (`free.json`, pose arrays), controlled taxonomy/metrics and IDs; generate app-only catalog and static images. Exclude raw archives, generated provider content and images from public Git. Never extract premium previews.
2. Runtime compatibility: shared known-ID validation and metric checks; preserved legacy definitions; metadata/media resolver separate from business persistence. Bounded AI shortlist without images/provenance, no silent mapping of unknown IDs.
3. Existing UI: search aliases/muscles/equipment, incremental list rendering, single/dual/missing images, shared attribution component and Settings Credits. Retain three layouts and existing training editors.
4. Tests: importer/schema/path/deprecation/ID/attribution unit checks; media fallback, filters, new manual exercise and mocked AI tests; affected historical persistence/backup/AI regression. Fixed test data; no paid model calls. Freeze app edits while browser checks run. One full required gate after targeted checks.
5. Review diff and public Git contents; document license distinction and release caveats; create one reviewable PR. This task does not automatically authorize a new production release.

## Evidence / risks
Official ZIP downloaded locally: 27,341,187 bytes, SHA256 8F0FFE22025DF4D9E915A5CBD5577479F240559C7E2C62203D7298BE82DF20C6. 637 rows, 489 start/peak pairs, 148 main poses; all 1,126 exercise image paths exist. Additional icons and paid preview assets are not production inputs.
RepDB Free Tier v1.0 permits attributed in-app use but prohibits dataset redistribution. Public repo receives integration code, notices and synthetic tests, not the raw/derived bulk content or screenshots of a downloadable dataset. Build fetches the pinned official package and embeds only app resources. Reassess distribution if terms change; fail on archive hash drift, do not silently update.
Existing catalog has four UUID entries and metrics, not merely display records. New metrics and equipment require explicit controlled mappings; never infer medical suitability from vendor tags. Translation quality is separate from schema validity. No professional movement review or physical-device claim.

## Ownership / files
Single owner. tools/catalog/* owns source validation/generation; src/catalog/* owns directory and provider metadata; src/domain/schemas.ts only additive validation; src/backend/{prompt,guided-provider}.ts only controlled selection; existing CatalogPage/ExerciseMedia and Settings Credits own display. Tests and docs reflect actual results. Avoid unrelated coach qualification changes (separate recorded request).

## Implementation status
Adapter, all 637 source movements, 1126 local images, Chinese terminology, search/filters/favorites, shared attribution, Settings credits, preserved old IDs and bounded AI integration completed. Full unit/type/build gate passed (457 tests). Catalog/media/Progress browser gate passed (26 cases), plus affected backup/plan/AI/legacy checks. PR #22 merged as ac130fa and published as Worker 65863e31-c7d8-4aee-92ab-a8156806ba68. Final CI passed 457 unit tests and 519 browser executions; public attribution/media checks passed. Detailed evidence: docs/verification/repdb-catalog-2026-10-09.md.
