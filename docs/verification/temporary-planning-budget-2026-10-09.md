# Temporary planning monetary-budget bypass · 2026-10-09

Authorized by the owner: temporarily remove understanding and generation budget limits.

`CONTROL_POLICY.planningBudgetDisabled=true` disables monthly and per-request monetary admission checks for `understand` and `generate`, including the verified monetary ceiling prerequisite. It does not raise the stored limits or erase pending reservations. The old values remain available for restoration. Pricing validity is not fabricated or extended.

Usage counts, eligibility, consent, adult AI boundaries, concurrent-request limits, ledger integrity, uncertain-request errors and request identity remain enforced. Successful replies without billing evidence remain pending; their reservations and all known charges are retained. Costs above former limits do not automatically disable planning while the switch is on. Summary requests keep monetary enforcement.

Set the flag false or remove it to restore monetary enforcement. Outstanding requests without verified ceilings may then require reconciliation. Do not clear the ledger to restore service.

Validation: typecheck/build; 415 unit tests; 4 bilingual Chromium/WebKit UI tests. Added tests cover expired/unavailable cost proof, monthly/per-call bypass, generation settlement above prior caps, quota and qualification protections, supplier uncertainty, re-enabling with unchanged historical entries. No paid AI calls.

Production activation and exact deployed version are recorded separately after deployment.
