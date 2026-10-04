# Worker assembly and guarded model transport

2026-10-05. Configuration defaults disabled. Real Worker/D1/provider execution is outside the evidence below.

## Result and activation boundary

`src/backend/worker.ts` exports an executable Workers Fetch handler, configuration parser and injectable assembly. The separate `wrangler.backend.jsonc` bundles this handler; the existing static `wrangler.jsonc` is unchanged. Shipped mode is `disabled`, workers.dev and preview URLs are disabled, there are no routes/D1 bindings/secrets, and observability is disabled. Disabled health reports `{status:"disabled",productionModelEnabled:false}`; other requests return `AI_DISABLED` without store or supplier access.

There is **no selected production provider codec**. Setting `CONTROL_MODE=external` alone does not activate model access. The shipped default export has no codec and rejects external configuration with `PROVIDER_SELECTION_REQUIRED` even if an operator supplies valid secrets and a provider name. A reviewed provider-specific `ProviderCodec` must be wired explicitly into `createWorker` in a future approved change. The transport is a source-ready generic Fetch adapter, not an implementation of any vendor API. The `fixture-only` codec exists only in tests.

After a codec exists, the ledger still starts with AI disabled. Operator activation requires authenticated `/api/v1/admin/supplier`; `/admin/mock` remains available for local-test services and rejects external services. Changing deployment mode to disabled stops all access independent of ledger enablement. No browser client, qualification mechanism or UI defaults are changed by this package.

## Operator configuration contract

External configuration requires `CONTROL_ORIGINS` (JSON array of exact HTTPS origins; maximum eight), `CONTROL_POLICY` (strict JSON object), `CONTROL_ADMIN_SECRET`, `CONTROL_DIGEST_SECRET`, `SUPPLIER_API_KEY`, `SUPPLIER_ENDPOINT`, `SUPPLIER_ORIGIN`, and `SUPPLIER_PROVIDER` matching the injected reviewed codec. `CONTROL_DB` must be a separately approved D1 binding unless a store is injected for local protocol testing. Missing D1 never falls back to volatile storage. The operator must apply the existing `src/backend/schema.sql` only after infrastructure authorization.

Policy includes `timeZone`, `k` (exactly 1 for this release), integer RMB-fen `budgetLimit`/`maximumRequestCost`/per-operation `requestBounds`, per-operation `quotas`, `maxInputBytes` (1..65536), and `maxConcurrent` (1..100). Unknown keys, invalid timezone or bounds larger than maximum request/global cost limits reject startup. Each of the three secrets is distinct, 32..4096 characters, with no whitespace or test/placeholder markers. Supply secrets through Cloudflare secrets after future authorization; never put them into Wrangler vars, repository source, logging or browser bundles.

The reviewed codec must define the provider request shape, candidate parsing, token/output constraints, and an independently justified cost mapping into RMB fen. This round does not choose a provider, price, exchange rate, model, region or data processing policy. A supplier's untrusted arbitrary `actualCost` field is not independently verified billing. Fixture decoding proves the interface only. Unknown billing must yield missing cost or throw so the existing ledger keeps the whole reservation pending.

## Transport and accounting

Native Fetch is injectable; tests inject every response. The adapter accepts only HTTPS and an exact configured origin. Endpoint credentials, query strings and fragments are forbidden; redirect following is disabled. It sends one POST with a server-held bearer secret, uses a 30-second Worker timeout and a 256 KiB streamed output cap, decodes fatal UTF-8/JSON and delegates interpretation to the reviewed codec. There is no automatic retry. HTTP errors, oversized output, invalid JSON and timeouts become a sanitized uncertainty error; ControlService retains pending accounting. Provider errors and result bodies are never written into the control ledger.

ControlService now admits external-transport only with external mode and non-test secrets. Existing local-test/local-mock callers remain compatible. Both transports share the original atomic quota/budget reservation, concurrency, admission recheck, cancellation, settlement and reconciliation logic. A candidate that fails validation after verified settlement remains charged; it is not refunded or retried automatically.

## Retention and capacity

Authenticated `/api/v1/admin/retention` removes expired invitation/session credentials and bounds the minimal audit tail to 1000 events. Audit events are also bounded on normal writes. Subjects, requests (including settled/released identity tombstones), all usages and all budgets remain unchanged, including expired-subject accounting and old-period pending reservations. They have **no automatic TTL**: deleting them could revive used quotas, allow duplicate request IDs or forget unresolved charges. Retention does not clear reconciliation or enable AI. A larger durable/archive design requires a separate accounting-preserving migration; current 1.9 MB JSON ledger capacity still fails closed and is not a production scale claim.

## Verification evidence

- Worker tests cover disabled zero store/network, configuration/provider/D1 gates, allowlisted single-attempt transport, timeout and streamed byte bounds, pending accounting, dedupe and credential retention. Malformed envelopes (null, undefined, arrays, missing result, invalid costs and throwing accessors) preserve full pending reservation and block new admission. Non-success streams are cancelled before timeout cleanup.
- `npm.cmd run check` after both fixes: 123 tests across 18 files plus typecheck/build passed. Node emitted its existing experimental SQLite warning; no test failures.
- Existing D1 CAS retry tests and held-admission tests remain in the complete unit suite. D1 tests are protocol simulators, not Cloudflare consistency or real D1 runtime evidence.
- `node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config wrangler.backend.jsonc --outdir .superpowers/backend-dry-run`, with metrics disabled and `WRANGLER_LOG_PATH` set inside the owned worktree: final post-review exit 0, 821.02 KiB bundle / 131.29 KiB gzip, only disabled/unselected vars, no upload. This proves source bundling, not actual deployment/Workers execution.
- `git diff --check`: passed.

Official platform references checked for the assembly/protocol boundary: [Workers Fetch handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/) and [D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/). Real Worker/D1/provider execution, operational secrets/access/rate limits, real billing and production retention scale remain unverified. No dependencies were added.
