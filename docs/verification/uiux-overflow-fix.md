# PR #1 Linux WebKit 320px overflow correction

Coordinator review: PR #1 remains a draft and must not be merged, tagged or deployed by this agent.

## Root cause
The diagnostic-only commit 883895d20ca1e223e36ee5e0eac0b450f12e1f74 reproduced the original failure on Linux WebKit in run https://github.com/santonear/Fitness/actions/runs/37120182581. Route /settings, viewport 320, document width 365. The Restore JSON file label and native input[type=file] extended from x=18 to x=365, width347px. The native control is outside a form, so the pre-existing form input width rules did not apply. Native platform font/control metrics explain why Windows WebKit passed.

## Minimal fix
Only styles.css adds a scoped application file-input rule: display:block, width/max-width:100%, min-width:0 and font:inherit. The file picker occupies its own line and is bounded by its real parent content width. No overflow hiding, test tolerance, route, model, service, backup behavior or dependency changes. shell.spec.ts retains the same viewport-width assertion and adds route/element bounds to its failure message for future platform differences.

## Verification
Local npm run check: typecheck, 55 unit tests and build passed.
Local full browser regression: node node_modules/@playwright/test/cli.js test --config ../uiux-playwright.config.mjs --workers 2: 82 passed (3.5m), Chromium and Windows WebKit, unchanged 320x700 default viewport.
Remote complete Linux CI: consult PR #1 checks for the fix commit; its final result and run URL are recorded in the delivery handoff after completion.
Screenshots: settings-320px-webkit.png and settings-320px-webkit-zh.png, captured in Windows Playwright WebKit at 320x700; native picker is x18, width284, right302. They are not Linux screenshots.

## Preserved limitations
The independent 10,000-record performance benchmark does not mount Dashboard against the seeded database. Dashboard plus large history interaction latency remains unverified; there is no evidence establishing a performance regression. Physical mobile devices, native Safari/Firefox and full screen-reader testing remain unverified.
