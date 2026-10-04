# Local exercise media

2026-10-05. No domain/schema/IDs, dependencies, training flows, backend or telemetry changed.

## Interface and product behavior

`ExerciseMedia({ exerciseId, exerciseName, locale })` is catalogue-only. `src/catalog/media.ts` keeps resources separate from persisted exercise data. Four original local geometric illustrations; source links explicitly disclose third-party connection. Two optional, allowlisted YouTube privacy-enhanced embeds load only after a keyboard-accessible explicit button. No remote thumbnail, autoplay, initial iframe, preconnect or training data upload. Iframe uses no-referrer, a limited sandbox and fullscreen permission only. Close removes iframe. A video-not-working action removes the failed frame and shows fallback; browser onError also triggers fallback where supported. Cross-origin iframe load does not prove playable media; written instructions and source links stay accessible independently.

## Source and rights evidence

Live primary-source web lookup on 2026-10-05:

- Goblet squat: https://www.nasm.org/resource-center/exercise-library/goblet-squat . Page title and movement text identify this exercise; primary page explicitly links https://www.youtube.com/watch?v=nfX7IFK9UNI . Source association verified, video playback/content not reviewed, embedding/platform/regional availability unknown.
- Bodyweight squat: https://www.youtube.com/watch?v=m0GcZ24pK6k . Search returned title `How to do a bodyweight squat | Bupa Health`; opening primary YouTube page yielded only generic footer. Title match only, content/channel ownership/playability not independently reviewed. UI expressly marks pending content review and unconfirmed embed availability. Candidate, not professionally approved demonstration.
- Walking: https://www.nhs.uk/live-well/exercise/walking-for-health/ . Primary page verifies walking resource. Research surfaced rehabilitation/crutch/falls videos, excluded as mismatched to generic catalogue walking. No confirmed matching embedded video.
- Plank: https://www.catalystathletics.com/exercise/448/Plank/ . Primary page describes forearm plank. ACE primary video library also links `Plank School with Jonathan Ross`, but YouTube target retrieval failed; no fabricated video ID or unsupported embed used. No confirmed matching embedded video.

All video content remains on publisher/YouTube infrastructure; no download, rehosting, copied thumbnail, or invented reuse licence. `public/media/NOTICE.md` records that four SVGs are newly drawn original geometry, illustrative and professionally unreviewed. The app makes the same distinction visible. External pages are linked, not copied into the app.

## Verification

Media tests cover fixed video IDs, unchanged catalogue identities, explicit keyboard opt-in, blocked embeds, broken images and bilingual fallback. Combined verification is recorded in next-integration.md.

Real phone, actual third-party playback, network policies, channel/content professional review and platform restrictions remain unverified. Blocked browser requests do not prove actual YouTube availability.
