# Media provenance and recovery

The four existing catalogue identities, original local illustrations and two existing video candidates remain unchanged. No external assets were downloaded. Media metadata is separate from persisted exercise data.

## Evidence boundaries

Source checks retain their original date, 2026-10-05, and the facts recorded in `next-media.md`. No new primary-source or playback verification was performed.

| Resource | Source association | Rights and review |
|---|---|---|
| Four local SVG illustrations | Project-original geometric assets; `public/media/NOTICE.md` | No third-party image licence claimed; movement form not professionally reviewed |
| NASM goblet squat candidate | Publisher page linked video `nfX7IFK9UNI` | Content not reviewed; embedding and actual playback not verified; redistribution rights not verified |
| Bupa bodyweight squat candidate | Search-title match for `m0GcZ24pK6k`; publisher identity not independently verified | Content not reviewed; embedding and actual playback not verified; redistribution rights not verified |
| NHS walking and Catalyst Athletics plank | Existing source-page references; no confirmed matching video | Missing-video fallback retained |

Public availability does not establish download or redistribution permission. A publisher link establishes association, not professional content approval or playable embedding.

## Behavior

The fixed manifest and nested provenance objects are frozen. Lookup rejects unknown and inherited identities such as `constructor`, `toString` and `__proto__`; caller URLs cannot select resources. Video URL construction still accepts only the two literal allowlisted IDs. Local images and written instructions remain available without loading an iframe. Source links and video buttons disclose third-party connections.

After a failed video, retry creates a fresh iframe and close returns to the initial opt-in state. Cross-origin iframe load does not establish playback success; the manual failure action remains available. English and Chinese distinguish source association, pending professional/content review, unverified playback and unverified redistribution rights.

## Verification scope

Added unit coverage checks safe identity lookup, immutable metadata and distinct source/review feedback. Added browser coverage intercepts external video requests and checks keyboard retry, close, both languages, narrow-screen layout and continued access to written steps and the training page. Existing media regressions remain applicable.

Verification: the existing and added media unit tests passed (6 cases), as did all 6 Chromium/WebKit media browser cases in the integration configuration. The full integration check passed 168 unit tests, type checking and the production build. No valid pre-implementation RED run was obtained; these results do not claim red-green proof. Commands: `npm.cmd run check`; `node node_modules/@playwright/test/cli.js test --config playwright.stage2.config.ts --workers 2`, with the project browser cache. See `stage2-integration.md` for the full suite's evidence boundaries.

Real phones, professional movement review, actual video content, channel ownership, subtitles, regional/network availability and actual third-party playback remain unverified. Mocked network failure tests do not complete R35/R36 production acceptance.
