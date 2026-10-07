# AI trial application and management

Baseline: 9395395d896ad149cadf49324f2e1460992ee2ea.

## Scope

Qualification is the first onboarding step, with a local-dashboard exit. Applications use a secret browser receipt, no email or training upload. One administrator approves, rejects, issues and extends trials. Extension adds 30 days from max(current expiry, approval time), never resets usage, reservations or budgets. Existing local training remains available offline.

## Implementation

1. Add bounded application records and atomic approval/claim/extension operations to the existing control transaction; preserve old ledger compatibility and billing rules. Receipt secrets are never stored in plaintext.
2. Add public application APIs and a separately authenticated management gateway. Cloudflare Access identity validation is fail-closed; absent configuration cannot enable admin access. Public admission requires server-side abuse verification outside local tests.
3. Add onboarding qualification, settings entry and management views using current design tokens, bilingual status and explicit failure states.
4. Test duplicate operations, concurrency, lost responses, expiry, revoked sessions, unchanged billing, authentication, retention and offline UI. Run type/build, backend regression and focused browser tests.

## Boundaries

No mail service, training cloud storage, model calls, remote database changes or deployment. Administrator identity and Access configuration are prerequisites for online administration. The bounded single-row application store is an initial local implementation, not a production scale claim; row-capacity and public rate-limit configuration must be reviewed before release.

## Ownership

Backend: src/backend/trial-applications.ts, application HTTP routes, control state and management authentication. Frontend: trial panel, management page, onboarding/settings integration and scoped CSS. Shared contracts and integration have one maintainer.

## Status

2026-10-07 quota amendment: the administrator restores the selected active user's remaining monthly understand/generate counts to configured defaults (currently 8/4), rather than adding an arbitrary number. Immutable usage-offset records preserve original usage, monthly scope, operator reason and idempotency. No qualification extension, fee release or project budget override. Implemented locally with targeted backend and browser evidence in the verification document; not deployed.

Local implementation complete. Type checking, 357 unit tests, frontend build and Worker dry-run passed. New trial UI 10 cases and existing AI UI 26 cases passed; 36 original guided cases have passing evidence, including one isolated rerun of an intermittent WebKit timeout. See docs/verification/trial-applications-2026-10-07.md for limits and resource prerequisites. Access identity, Turnstile and real D1 verification remain integration prerequisites; no deployment occurred.
