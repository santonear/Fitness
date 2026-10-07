# Trial verification repair and manual invitations

Scope: fix trial application verification and expose existing invitation issuance in the authenticated management UI. Based on PR11 merge eed1b583c47206ad6b4729ebbf7e851a12b6af1f.

## Root cause evidence

On 2026-10-07, an isolated local Cloudflare workerd instance launched through Wrangler 4.147.0 sent the same official Turnstile dummy verification request with two redirect modes. `error` threw `Invalid redirect value, must be one of "follow" or "manual"`; `manual` returned HTTP 200 with success=true. No production secret, application receipt, model API or ledger was used in this probe. This reproduces the same runtime incompatibility previously observed by the Gemini transport investigation.

The application verifier now uses manual redirects and refuses non-2xx responses. Hostname and action validation remain mandatory; network errors still fail closed. The applicant error message explicitly says the application was not submitted. A fresh green widget after failure is not evidence that an application entered the queue.

## Manual invitations

The Trials management page can generate and copy a code, list unredeemed invitation identifiers and expiry dates, and revoke unused codes. Existing Access authentication, the single administrator email, same-origin POST checks, server-only admin credentials and issuance audit apply to both new management routes.

Existing business rules are preserved: 7 days to redeem, once only, 30-day trial after redemption, normal personal quotas and project budget. No plaintext code is persisted. Leaving the page removes the displayed code. Generation is never retried automatically; if a response is lost, refresh the list and revoke the undelivered invitation before issuing another. Browser clipboard rejection leaves the selectable code available for manual copying.

## Verification

- Type checks, unit suite and production asset build passed locally.
- Real SQLite-backed management gateway issuance/list/revoke/redemption test passed; budget and requests remain unchanged.
- Access rejection and same-origin tests cover both new routes. Redirect regression checks reject 302 without following it or retrying.
- Chromium and WebKit application/management suite: 18 passed, including English/Chinese generation, cancellation, revocation and 320/1280px overflow checks.
- Production Worker dry-run passed. Scoped review checked authentication, non-disclosure, error paths, expiry, once-only redemption and budget preservation.
- Real administrator email login was confirmed by the user after PR11. A real Turnstile submission through the repaired production code still requires the user's browser; the runtime fixture is not that end-to-end acceptance.

No model calls or production ledger changes were made by these checks. Publication evidence is recorded separately after deployment.
