import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EngineProfileEditor } from "../../../src/ui/pages/settings/EngineProfileEditor";
import { engineCopy } from "../../../src/coach/engine-copy";
import { baseProfile } from "../../../tools/eval/training-engine-profiles";
const screen = baseProfile().screening;
function render(ageYears: number, rescreenRequired = false) {
  return renderToStaticMarkup(
    createElement(EngineProfileEditor, {
      ageYears,
      value: {
        healthStorageConsent: { acceptedAt: screen.completedAt! },
        screening: { ...screen, rescreenRequired },
      },
      locale: "zh",
      onChange: () => {},
    }),
  );
}
it("shows the approved advisory at45, and not at44", () => {
  expect(render(45)).toContain(engineCopy("safety.copy.age45_advisory", "zh"));
  expect(render(44)).not.toContain(
    engineCopy("safety.copy.age45_advisory", "zh"),
  );
});
it("requires a fresh screening before advisory acknowledgement can be offered again", () => {
  expect(render(45, true)).not.toContain(
    engineCopy("safety.copy.age45_advisory", "zh"),
  );
});
it.each(["zh", "en"] as const)(
  "shows only source environmental guidance for pregnancy, without inventing weather or altitude facts (%s)",
  (locale) => {
    const value = {
      healthStorageConsent: { acceptedAt: screen.completedAt! },
      screening: screen,
      population: {
        kind: "pregnant" as const,
        week: 12,
        providerCleared: true,
        prenatalCareConfirmed: true,
        contraindicationsConfirmedNone: true,
        lastScreenedWeek: 12,
      },
    };
    const html = renderToStaticMarkup(
      createElement(EngineProfileEditor, {
        ageYears: 30,
        value,
        locale,
        onChange: () => {},
      }),
    );
    expect(html).toContain(
      engineCopy("pregnancy.environment.copy.heat", locale),
    );
    expect(html).toContain(
      renderToStaticMarkup(
        createElement(
          "p",
          null,
          engineCopy("pregnancy.environment.copy.altitude", locale),
        ),
      ),
    );
    expect(render(30)).not.toContain(
      engineCopy("pregnancy.environment.copy.heat", "zh"),
    );
  },
);
