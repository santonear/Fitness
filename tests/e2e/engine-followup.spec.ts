import { test, expect } from '@playwright/test';
import { openQuickAdjust } from './helpers/home-coach';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-18T02:00:00Z'));
  await page.route('**/api/**', route => route.fulfill({ status: 403, json: { error: 'synthetic offline test' } }));
  await page.route('**/api/v1/features', route =>
    route.fulfill({
      json: {
        version: 1,
        flags: { trainingEngine: true, aiAssistantV2: false, bodyProfile: false },
        expiresAt: Date.parse('2026-11-01T00:00:00Z'),
      },
    }),
  );
  await page.goto('/');
});

for (const kind of ['pregnancy-active', 'beginner', 'knee-quiet', 'muscle'] as const) {
  test(`fresh synthetic ${kind} plan is visible at 375 and 1280`, async ({ page }, info) => {
    const seeded = await page.evaluate(async kind => {
      const path = '/tests/e2e/helpers/engine-followup-seed.ts';
      return (await import(/* @vite-ignore */ path)).seedFollowup(kind);
    }, kind);
    expect(
      seeded.version.enginePlan?.quality?.issues.filter((issue: { severity: string }) => issue.severity === 'error'),
    ).toEqual([]);
    expect(seeded.version.templates).toHaveLength(3);
    await page.goto('/plans');
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('main')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`followup-${kind}-${width}.png`), fullPage: true });
    }
  });
}

test('saving completed pregnancy checks regenerates a version through the real settings UI', async ({ page }) => {
  const before = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/engine-followup-seed.ts';
    return (await import(/* @vite-ignore */ path)).seedFollowup('normal');
  });
  await page.goto('/settings/engine');
  await page.getByRole('combobox', { name: '孕期 / 产后状态', exact: true }).selectOption('pregnant');
  await page.getByRole('spinbutton', { name: '孕周', exact: true }).fill('20');
  await page.getByRole('combobox', { name: '你现在在定期做产检吗？', exact: true }).selectOption('true');
  // Every negative below is an explicit answer of this synthetic adult, not a migration default.
  const controls = page.getByRole('combobox');
  for (let index = 0; index < (await controls.count()); index++) {
    const control = controls.nth(index);
    if ((await control.inputValue()) === '' && (await control.locator('option[value="false"]').count()))
      await control.selectOption('false');
  }
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  const after = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/engine-followup-seed.ts';
    return (await import(/* @vite-ignore */ path)).followupSnapshot();
  });
  expect(after.state.coachProfile.population.kind).toBe('pregnant');
  expect(after.version.versionNumber).toBe(before.version.versionNumber + 1);
  expect(after.version.basedOnVersionId).toBe(before.version.id);
});

test('upper-only local action uses the shared engine and only changes the active workout', async ({ page }, info) => {
  const prepared = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/engine-followup-seed.ts';
    const helper = await import(/* @vite-ignore */ path);
    const seeded = await helper.seedFollowup('normal');
    const active = await helper.startFollowup(seeded.version.templates[0].id);
    return { ...seeded, active };
  });
  let modelCalls = 0;
  await page.route('**/api/v1/assistant/chat', route => {
    modelCalls++;
    return route.abort();
  });
  await page.goto(`/workout/${prepared.active.id}`);
  await page.getByRole('button', { name: '和芽芽聊聊', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await (await openQuickAdjust(page)).getByRole('button', { name: '只练上肢', exact: true }).click();
  const apply = dialog.getByRole('button', { name: '应用建议', exact: true });
  await expect(apply).toBeVisible();
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: info.outputPath(`followup-upper-only-${width}.png`), fullPage: true });
  }
  await apply.click();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const path = '/tests/e2e/helpers/engine-followup-seed.ts';
        const snapshot = await (await import(/* @vite-ignore */ path)).followupSnapshot();
        const rulesPath = '/src/engine/data.ts';
        const rules = new (await import(/* @vite-ignore */ rulesPath)).Rules();
        const items = snapshot.active?.templateSnapshot?.items ?? [];
        return (
          items.length > 0 &&
          items.every((item: { exerciseId: string }) =>
            ['push_horizontal', 'push_vertical', 'pull_horizontal', 'pull_vertical', 'isolation_upper'].includes(
              rules.byExercise.get(item.exerciseId).primary_pattern,
            ),
          )
        );
      }),
    )
    .toBe(true);
  const after = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/engine-followup-seed.ts',
      rulesPath = '/src/engine/data.ts';
    const snapshot = await (await import(/* @vite-ignore */ path)).followupSnapshot();
    const rules = new (await import(/* @vite-ignore */ rulesPath)).Rules();
    return {
      version: snapshot.version,
      patterns: snapshot.active.templateSnapshot.items.map(
        (item: { exerciseId: string }) => rules.byExercise.get(item.exerciseId).primary_pattern,
      ),
    };
  });
  expect(after.version).toEqual(prepared.version);
  expect(
    after.patterns.every((pattern: string) =>
      ['push_horizontal', 'push_vertical', 'pull_horizontal', 'pull_vertical', 'isolation_upper'].includes(pattern),
    ),
  ).toBe(true);
  expect(modelCalls).toBe(0);
});

test('week20 plan excludes rapid climbers and shows real support for balance', async ({ page }, info) => {
  const seeded = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/engine-followup-seed.ts';
    return (await import(/* @vite-ignore */ path)).seedFollowup('pregnancy-active', true);
  });
  const items = (seeded.version as import('../../src/domain/v8/contracts').PlanVersion).templates.flatMap(t => t.items);
  expect(items.some(i => i.exerciseId === 'c95d05eb-d0e8-5557-84cf-0b1fc11e3e48')).toBe(false);
  const supported = items.filter(i => i.prescription?.safetyCue?.zh === '扶墙或扶椅');
  expect(supported.length).toBeGreaterThan(0);
  expect(supported.every(i => ['wall', 'chair', 'counter'].includes(i.equipment))).toBe(true);
  await page.goto('/plans');
  await expect(page.getByText('扶墙或扶椅', { exact: false }).first()).toBeVisible();
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`pregnancy-support-${width}.png`), fullPage: true });
  }
});

test('pregnancy environment notice links to support and saving adds a supported balance version', async ({ page }) => {
  const seeded = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/engine-followup-seed.ts';
    return (await import(/* @vite-ignore */ path)).seedFollowup('pregnancy-active', false, false);
  });
  expect(seeded.version.enginePlan?.quality?.status).toBe('environmentLimited');
  await page.goto('/plans');
  await page.getByRole('button', { name: /平衡练习需要一个能扶的地方/ }).click();
  await expect(page).toHaveURL(/\/settings\/engine#environment$/);
  await page.getByRole('checkbox', { name: '家里有可扶的墙或椅子', exact: true }).check();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  const after = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/engine-followup-seed.ts';
    return (await import(/* @vite-ignore */ path)).followupSnapshot();
  });
  expect(after.version.basedOnVersionId).toBe(seeded.version.id);
  expect(after.version.enginePlan?.quality?.status).not.toBe('environmentLimited');
  const balance = (after.version as import('../../src/domain/v8/contracts').PlanVersion).templates
    .flatMap(t => t.items)
    .filter(i => i.prescription?.pattern === 'balance');
  expect(balance.length).toBeGreaterThan(0);
  expect(balance.every(i => i.prescription?.safetyCue?.zh === '扶墙或扶椅')).toBe(true);
  await page.goto('/plans');
  await expect(page.getByText('扶墙或扶椅', { exact: false }).first()).toBeVisible();
});
