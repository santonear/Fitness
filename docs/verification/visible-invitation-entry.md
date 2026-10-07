# Visible invitation entry

The trial page now opens with a visible name and invitation-code form. Switching to the application form keeps an explicit invitation action near the top. Pending and approved application states appear before the forms; the existing claim flow remains available.

The entered name is a local display name only. Redemption sends only the code to the existing endpoint and does not introduce username/password authentication. Successful redemption and qualification refresh proceed directly to /ai, which resumes or starts onboarding. The code is not persisted. Invalid-code errors preserve the form for correction. New applications and existing invitations remain separate paths.

## Verification

- Typecheck, production build, 380 unit tests passed.
- 30 trial/admin browser tests passed across Chromium and WebKit in English and Chinese.
- New checks cover visible mobile name/code inputs, switching between application and activation, code-only request payloads, successful navigation, reload without repeat redemption, local name storage, pending applications, unavailable application service and invalid-code rejection.
- 320/390/1280 widths have no horizontal overflow; English and Chinese 390px screenshots inspected.
- Tests use synthetic HTTP fixtures; no real invitation, model call or production ledger write is required for this interface change.
- Targeted review: existing authentication and quota boundaries are unchanged. Names are never authentication credentials and are not added to AI or redemption requests.
