# Verified reservation excess release

Successful bounded-pending requests previously retained the configured admission reservation even when the provider adapter had verified a lower ceiling. The service now releases only that excess after candidate validation. It retains the verified ceiling as pending, preserves usage and actual fees, and records an audit event. Uncertain/failed calls keep their full reservation. Admission still requires the configured full bound. A later bill exceeding the retained ceiling disables AI for reconciliation.

The submission transaction preserves the greater of admission and submission ceilings. Settlement and cancellation races remain handled in the existing atomic transaction; already settled entries are not adjusted again.

## Verification

- Red: revised bounded-pending behavior produced five expected failures before implementation.
- Green: full npm run check: typecheck, 380 tests across 52 files, and production build passed.
- Regression coverage: duplicate request does not release twice; quota is not refunded; actual cost is absent until settlement; concurrent and cross-month budget limits; missing/expired proof; uncertain supplier calls; changing proof; over-ceiling settlement; accounting anomalies.
- Targeted diff review: release and audit are inside the ledger transaction; no new public API, price assumption, secret, or frontend behavior.

Tests use synthetic supplier fixtures. This document does not claim a new real-provider planning round trip. Production operation records are kept separately and are not included in this change.
