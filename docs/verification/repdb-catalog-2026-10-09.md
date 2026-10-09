# RepDB catalog integration

Base: `e94c59f37cdd03ef6f8fdcd277ae96e63b8d31ec`; branch: `codex/repdb-exercise-catalog`.

## Delivered behavior

- All 637 free exercises are available with Chinese names and aliases, original English names/instructions, local WebP images and visible linked attribution.
- Original four IDs and definitions remain unchanged. RepDB walking/plank share their matching existing identities; RepDB barbell squat and kettlebell goblet squat remain distinct from the legacy bodyweight/dumbbell variants. Total: **639 distinct catalog entries**.
- Search, category/equipment/body-area filters and browser-local favorites use the expanded directory. Initially 24 cards render; users can show more. Details load English instructions on demand. Missing/failed media keeps instructions and attribution accessible.
- `source`, external ID, canonical slug, muscles, media and license are separate metadata. Exercise schemas and persisted snapshots retain their existing fields; no Dexie migration or rewrite of user facts is required. The numeric training contract catalog version remains 1 because this is additive; the provider integration has its separate `2026.10.1` revision.
- A frozen Fitness namespace and canonical key produce stable UUIDs, independently of display-name translations. Future provider replacement must retain the canonical key/ID mapping. Unknown IDs fail validation; replacement chains are checked for missing targets and cycles.
- New movements are eligible for both AI generation paths. Deterministic shortlists contain at most 64 movements; exact name/alias matches are prioritized, then equipment matches with body-area diversity. This is vocabulary selection, not a personal suitability judgment. The model must still respect all supplied constraints. Return validation checks the request-specific shortlist, metrics, dates and existing confirmation envelope. No images, vendor instructions or provenance are sent in the catalog prompt.
- Timed holds/stretching/carries and cardio use duration metrics; supported travel cardio optionally records distance. Resistance bands/bodyweight movements use repetitions; other loaded movements use repetitions/load. Existing four metrics remain unchanged. Mapping is a recording convention, not a professional movement or medical assessment.

## License and source

See [third-party source notice](../../third_party/repdb/README.md). Official archive SHA256 and quantities are checked during generation. Raw/derived dataset files and bulk images are excluded from public Git. Shared attribution renders **Exercise data by RepDB** with `https://repdb.co/` in Settings and image views. No premium assets or bulk dataset endpoint.

## Verification

- Final `npm run check`: typecheck, **457 unit tests across 61 files**, and production frontend build passed. Both AI pathways, wrong metrics, IDs outside the shortlist, strict importer boundaries and unchanged-output write behavior are covered.
- Chromium/WebKit: 26 catalog/media/Progress checks passed. Covers all three themes, single/dual/broken media, credits link, favorites, new manual exercise backup round trip, and unchanged original media controls.
- Additional plan/backup/invitation regression: 14 passed initially; six legacy fixture failures were traced to fixed four-metric fixtures iterating the expanded directory. Fixtures now explicitly use the original four movements. Follow-up legacy checks passed, including both browsers restoring 10,000 records. One Chromium view check and a download wait were interrupted by concurrent asset regeneration; unchanged-output writes now preserve mtimes. The affected checks passed in isolation. Three queued Chromium boundary checks were completed separately; **70 distinct affected browser checks passed across these runs**; no full browser-suite claim is made.
- Production-config Worker dry-run passed: 1,561.30 KiB uncompressed / 250.51 KiB gzip. No upload or production mutation occurred.
- Frontend detail chunk is lazy (about 177 kB gzip); initial app chunk is about 250 kB gzip. Vite reports its existing size advisory; the app does not download all 1,126 images at startup.
- Screenshots: local `outputs/repdb/{atlas,serene,orbit}-{320,390,1440}-{chromium,webkit}.png`. Orbit narrow-screen and Atlas desktop screenshots visually reviewed; automated overflow checks passed. These are desktop-browser viewport simulations, **not physical-phone verification**.

No paid translation/model calls, real AI generation, production deployment, invitation mutation or budget changes were performed. Chinese terminology has software-level consistency checks; professional exercise/translation review remains unverified. Unloaded images/instructions need a network connection; already-loaded local training remains available offline.

## Focused review

Single-owner review covered stable historical IDs, source separation from snapshots, strict AI IDs/metrics, attribution in success/failure views, ZIP path safety, pinned source integrity, Git exclusions and fixture scope. Existing public app architecture and design tokens were retained. No unrelated coach qualification changes were included.
