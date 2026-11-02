# ESA AI origin fix — 2026-11-02

Branch: `codex/esa-trial-origin`; base: `76c5fae2`.

## Scope and authorization

User approved appending `https://test.yafit.asia` to production CONTROL_ORIGINS. Runtime update was verified: all 29 bindings retained, no other binding changes. Live access-status remained 403 because assistant V2 did not consult this setting.

User then approved a code patch and tests, with separate approval required before production code publication. This patch has NOT been published.

## Patch

- Assistant status and chat accept the proxy Origin only when both it and the backend request origin are exact HTTPS entries in CONTROL_ORIGINS.
- Existing direct same-origin behavior is preserved. Unknown origins, malformed proxy configuration, and cross-site requests are rejected. Forwarded headers grant no trust.
- Session, quota, and model execution logic are unchanged. Other sameOrigin callers retain their previous behavior.
- Production config file preserves the already approved runtime whitelist addition for future deploys.
- Static layer checker uses fileURLToPath and Windows-compatible path splitting; no check was removed or relaxed.

## Verification

- TypeScript typecheck passed.
- Focused request and assistant suites: 23 tests passed.
- Backend suites: 236 tests passed; 29 pre-existing skipped tests unchanged.
- Lint: zero V8 style violations; layer guard checked 627 files with no forbidden imports.
- Production build passed; existing large-chunk warning remains.
- git diff --check passed.
- Focused security review: proxy allowance is opt-in; both origins validated; no wildcard, forwarded-header trust, session bypass, or quota bypass introduced.

## Failures resolved and remaining limits

Fresh-worktree tests initially lacked generated catalog data; standard preparation generated it after network permission was available. Windows lint initially resolved D:\\D:\\...; corrected URL-to-path handling and separator handling.

Tests used synthetic local sessions and a stubbed model: no paid model request.

User subsequently approved PR and publication. PR #134 first CI run passed the engine audit and all other browser groups, but the calendar group failed on a date-dependent notice assertion: on November 2 the 30-day range ends December 1, and that final valid single-day selection clears the earlier rest-day notice. The assertion now checks the notice immediately after each selection spanning at least seven days. The 26-day selection, saved dates, weekly target and excluded rest-day assertions remain unchanged; no application behavior changed.

Remote CI after that correction and live patched endpoint verification remain required before completion.
