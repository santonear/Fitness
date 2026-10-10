# E onboarding component evidence

Scope: `UIUX20261008.md` Part 2 sections 3.1 and 3.2; Part 1 typography, token-only controls, exercise capsules and immersive scenes. The three questions preserve suggested Chinese wording and custom answers. Adulthood gates both AI and basic-plan intent. Only an explicit confirmation emits a save intent, preserving the candidate request ID and restore generation.

2026-10-10 checks: TypeScript passed; 3 focused unit tests passed; 10 Chromium browser tests passed; V8 checker reported 0 new violations (2 existing legacy exemptions). Browser cases cover four theme token sets at 390 and 1440 pixels, custom 15-minute text, back navigation, safety selection exclusivity, adult gates, manual training callback, consent visibility, original-text preservation, keyboard activation, busy save blocking and explicit candidate confirmation. Each theme/width has question, safety and draft screenshots (24 files).

These are local component fixtures, not mounted application routes, live AI, database saves, mobile devices or complete production theme verification. The fixture uses neutral injected BrandMark/AiLine/Suggestions because signature components are owned by A/G. It inherits actual theme tokens and common controls. The three numbered outputs below the page are fixture-only callback counters. Prototype differences: neutral signatures, fixture exercise descriptions and a controlled two-template sample; no live generation or persistence.

Integration must interpret the original schedule/equipment answers, render the actual resolved outbound field list before authorizing any request, enforce adult eligibility server-side, supply approved theme slots and localized catalog text, and revalidate candidate/version/restore generation before persistence. The current consent list describes exactly the raw answer callback, not an already implemented ONBOARD_PLAN request. No height, weight or history fields are collected or sent by these components.

Commands (from E worktree):

```powershell
$env:TEMP = (Resolve-Path .cache/v8-e-temp).Path
$env:TMP = $env:TEMP
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run tests/unit/v8-e-onboarding.test.ts --configLoader runner
node node_modules/@playwright/test/cli.js test --config tests/e2e/v8-e-onboarding.config.ts
node tools/v8/check.mjs
```

Browser verification required an approved local run outside the sandbox after the sandbox could start Vite but could not reach its local server. Vite uses a worktree-local cache. The existing generated catalog and dependency junction were reused; no dependency fetch or model call was made.
