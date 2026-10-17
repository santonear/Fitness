import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page, baseURL }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 403, json: { error: "offline test" } }),
  );
  await page.route("**/api/v1/features", (route) =>
    route.fulfill({
      json: {
        version: 1,
        flags: {
          trainingEngine: true,
          aiAssistantV2: false,
          bodyProfile: false,
        },
        expiresAt: Date.parse("2026-11-01T00:00:00Z"),
      },
    }),
  );
  await page.route("**/api/v1/trial/access-status", (route) =>
    route.fulfill({
      json: { qualification: "none", sessionValid: false, aiEnabled: false },
    }),
  );
  await page.route(
    (url) =>
      /^https?:$/.test(url.protocol) && url.origin !== new URL(baseURL!).origin,
    (route) => route.abort(),
  );
  await page.clock.setFixedTime(new Date("2026-10-17T10:00:00Z"));
  await page.goto("/");
});
test("replacement browser cannot offer or apply a running movement to a quiet no-jump profile", async ({
  page,
}) => {
  const seeded = await page.evaluate(async () => {
    const p = "/tests/e2e/helpers/b-safety-seed.ts",
      result = await (await import(/* @vite-ignore */ p)).seedSafety("general");
    const w = "/src/ui/mainline/context.tsx",
      r = "/src/persistence/repository.ts",
      workflow = (await import(/* @vite-ignore */ w)).workflow,
      repo = (await import(/* @vite-ignore */ r)).repository;
    const state = await repo.db.v8State.get("v8"),
      metadata = await repo.readMetadata();
    await workflow.saveEngineSettings(
      {
        ...state.coachProfile,
        constraints: {
          ...state.coachProfile.constraints,
          quiet: true,
          noJump: true,
        },
      },
      metadata.dataRevision,
    );
    return result;
  });
  await page.goto("/workout/" + seeded.workoutId);
  await page.getByRole("button", { name: "换动作", exact: true }).click();
  await page.getByRole("searchbox").fill("高抬腿");
  await expect(
    page.locator('.manual-card .manual-pick[aria-label="高抬腿"]'),
  ).toHaveCount(0);
  const guard = await page.evaluate(async (id) => {
    const w = "/src/ui/mainline/context.tsx",
      d = "/src/engine/data.ts",
      r = "/src/persistence/repository.ts";
    const workflow = (await import(/* @vite-ignore */ w)).workflow,
      repo = (await import(/* @vite-ignore */ r)).repository,
      rules = new (await import(/* @vite-ignore */ d)).Rules();
    const forbidden = rules.data.exercises.find(
        (e: { slug: string }) => e.slug === "high-knees",
      ).id,
      before = await repo.db.v8Workouts.get(id);
    let rejected = false;
    try {
      await workflow.substitute(id, 0, forbidden, "other");
    } catch {
      rejected = true;
    }
    return {
      rejected,
      same:
        JSON.stringify(before) ===
        JSON.stringify(await repo.db.v8Workouts.get(id)),
    };
  }, seeded.workoutId);
  expect(guard).toEqual({ rejected: true, same: true });
});

test("settings exposes support editing and population controls stay clean in all themes", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.evaluate(async () => {
    const p = "/tests/e2e/helpers/b-safety-seed.ts";
    await (await import(/* @vite-ignore */ p)).seedSafety("general");
  });
  await page.goto("/settings");
  await page
    .getByRole("main")
    .getByRole("button", { name: "运动前自查与训练偏好", exact: true })
    .click();
  await expect(page).toHaveURL(/settings\/engine/);
  const population = page.getByRole("combobox", { name: /孕期 \/ 产后状态/ });
  await expect(
    population.locator("option").filter({ hasText: "65 岁及以上" }),
  ).toHaveCount(0);
  await population.selectOption("pregnant");
  await expect(page.getByText(/待核实/)).toHaveCount(0);
  for (const [theme, label] of [
    ["qingci", "青瓷"],
    ["liubai", "留白"],
    ["jingshe", "静奢"],
    ["zhuangse", "撞色"],
  ]) {
    await page.goto("/settings/appearance");
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.goto("/settings/engine");
    await expect(
      page.getByRole("combobox", { name: /孕期 \/ 产后状态/ }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({
        path: info.outputPath(`settings-screening-${theme}-${width}.png`),
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
  }
});
