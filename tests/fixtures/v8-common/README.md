# V8 common controls: browser evidence

Scope: `UIUX20261008.md` V8.0.3, part 1 sections 3, 5.1, 5.4 and 8.
Base: `8d2bfafacff4ad7a20628c682c94b4a4b483b449`.

The eight PNG files show the isolated React component fixture in Chromium at
390 × 1100 and 1440 × 1100. Each image was inspected for clipping and hierarchy.
They are review evidence, not screenshot comparison baselines.

Validation on 2026-10-10:

- `node node_modules/vitest/vitest.mjs run tests/unit/v8-common.test.ts tests/unit/v8-theme-tokens.test.ts`: 9 passed.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node tools/v8/check.mjs`: no new violations; two inherited legacy rule/file pairs remain.
- `node node_modules/@playwright/test/cli.js test --config tests/e2e/v8-common.config.ts`: 16 passed, Chromium and WebKit, four themes × two widths.
- Browser assertions cover keyboard activation, visible focus, native disabled state,
  selection and switch semantics, minimum target sizes, horizontal overflow,
  theme-specific pressed transforms, release and reduced-motion behavior.

The fixture is not mounted in the application and does not read or write user data.
No production changes, model calls or real-device tests were performed.
It uses available local font fallbacks; bundled theme fonts, theme provider,
nine signature slots and complete page composition remain subsequent A-line work.
The fixture's settings glyph is test content, not a replacement for the application icon.
It intentionally groups controls for inspection rather than reproducing the full prototype.
MorphPanel, Composer, Capsule and Toast are not part of this first component delivery.

Consumers import controls from `src/ui/components/common` and load `src/ui/theme.css`
once. The host must set a registered `data-theme` on `html` until ThemeProvider lands.
Button defaults to `type="button"`; form callers must explicitly request submit.
Chip, Toggle and Segmented are controlled; consumers own their state and translated labels.
Segmented uses a labeled fieldset of pressed buttons, not tab/panel semantics.
Consumers enforce one primary action per screen and pass `workout` for the 72px primary.
`Pressable` supplies native button behavior and feedback; use Button/IconButton/Chip
for sized controls or provide the appropriate target geometry in a signature slot.
