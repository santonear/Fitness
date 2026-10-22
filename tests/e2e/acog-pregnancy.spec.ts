import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-18T02:00:00.000Z'));
  await page.route('**/api/**', route => route.fulfill({ status: 403, json: { error: 'offline synthetic test' } }));
  await page.route('**/api/v1/features', route =>
    route.fulfill({
      json: {
        version: 1,
        flags: {
          trainingEngine: true,
          aiAssistantV2: false,
          bodyProfile: false,
        },
        expiresAt: Date.parse('2026-11-01T00:00:00Z'),
      },
    }),
  );
  await page.route('**/api/v1/trial/access-status', route =>
    route.fulfill({
      json: { qualification: 'none', sessionValid: false, aiEnabled: false },
    }),
  );
  await page.goto('/');
});

test('inactive pregnancy first week adopts a bounded plan and preserves the ramp start', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/acog-pregnancy-seed.ts';
    return (await import(/* @vite-ignore */ path)).seedAcogPregnancy();
  });
  expect(result.version.templates.length).toBeGreaterThan(0);
  expect(result.stored.population.prenatalCareConfirmed).toBe(true);
  expect(result.stored.population.inactiveRampStartedAt).toBe('2026-10-18T02:00:00.000Z');
  for (const t of result.version.templates) {
    expect(t.targetMinutes).toBe(10);
    expect(t.estimatedSeconds).toBeLessThanOrEqual(600);
  }
  await page.goto('/plans');
  // V9: only one tip is open at the bottom; the rest stay readable under “还有 N 条说明”.
  await expect(page.locator('.v9-plan-tip')).toBeVisible();
  if (await page.locator('.v9-plan-tip summary').count()) await page.locator('.v9-plan-tip summary').click();
  await expect(
    page.getByText('这次安排比你预留的时间短，先按这份练就好。', {
      exact: true,
    }),
  ).toBeVisible();
});

test('an applied legacy plan stays startable while new generation waits for the prenatal answer', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/acog-pregnancy-seed.ts';
    return (await import(/* @vite-ignore */ path)).seedAcogPregnancy(true);
  });
  expect(result.blocked).toBe(true);
  expect(result.stored.population.prenatalCareConfirmed).toBeUndefined();
  expect(result.preview.blocked, JSON.stringify(result.diagnostic)).toBe(false);
  expect(result.preview.template).toEqual(result.version.templates[0]);
  await page.goto('/plans');
  await page.getByRole('button', { name: '你现在在定期做产检吗？', exact: true }).click();
  await expect(page).toHaveURL(/settings\/engine/);
  const question = page.getByRole('combobox', {
    name: '你现在在定期做产检吗？',
    exact: true,
  });
  await expect(question).toHaveValue('');
  await question.selectOption('false');
  await expect(
    page.getByText('请先在产检时和医生或助产士聊聊运动的事，确认后回来告诉我们，我们再为你安排。', { exact: true }),
  ).toBeVisible();
  const started = await page.evaluate(async templateId => {
    const path = '/src/ui/mainline/context.tsx';
    return (await import(/* @vite-ignore */ path)).workflow.start(templateId);
  }, result.version.templates[0].id);
  expect(started.planVersionId).toBe(result.version.id);
  await page.goto('/workout/' + started.id);
  await page.getByRole('button', { name: '暂停或结束', exact: true }).click();
  await expect(page.getByRole('button', { name: '继续训练', exact: true })).toBeVisible();
});

for (const [id, label] of [
  ['pop', '柔光拟物'],
  ['vivid', '山野暖阳'],
  ['gentle', '温和陪伴'],
  ['data', '专业数据'],
  ['fire', '燃动挑战'],
]) {
  test(`prenatal question and layout in ${id} at 375 and 1280`, async ({ page }, info) => {
    await page.evaluate(async () => {
      const path = '/tests/e2e/helpers/acog-pregnancy-seed.ts';
      await (await import(/* @vite-ignore */ path)).seedAcogPregnancy(true);
    });
    await page.goto('/settings/appearance');
    await page.getByRole('radio', { name: label, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    await page.goto('/settings/engine');
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    const question = page.getByRole('combobox', {
      name: '你现在在定期做产检吗？',
      exact: true,
    });
    await expect(question).toBeVisible();
    await question.selectOption('false');
    await expect(
      page.getByText('请先在产检时和医生或助产士聊聊运动的事，确认后回来告诉我们，我们再为你安排。', { exact: true }),
    ).toBeVisible();
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({
        path: info.outputPath(`acog-prenatal-${id}-${width}.png`),
        fullPage: true,
      });
    }
  });
}

test('database19 upgrade preserves an unanswered prenatal field and applied plan bytes', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const helper = '/tests/e2e/helpers/acog-pregnancy-seed.ts';
    await (await import(/* @vite-ignore */ helper)).seedAcogPregnancy(true);
    const dbPath = '/src/persistence/db.ts',
      repoPath = '/src/persistence/repository.ts';
    const { FitnessDatabase } = await import(/* @vite-ignore */ dbPath);
    const { repository } = await import(/* @vite-ignore */ repoPath);
    const original = {
      state: await repository.db.v8State.toArray(),
      plans: await repository.db.v8Plans.toArray(),
      versions: await repository.db.v8PlanVersions.toArray(),
    };
    const name = 'synthetic-acog-upgrade-' + crypto.randomUUID(),
      probe = new FitnessDatabase(name);
    const stores = Object.fromEntries(
      probe.tables.map((t: { name: string; schema: { primKey: { src: string }; indexes: { src: string }[] } }) => [
        t.name,
        [t.schema.primKey.src, ...t.schema.indexes.map(i => i.src)].join(','),
      ]),
    );
    probe.close();
    const Dexie = Object.getPrototypeOf(FitnessDatabase),
      old = new Dexie(name);
    old.version(19).stores(stores);
    await old.table('v8State').bulkPut(original.state);
    await old.table('v8Plans').bulkPut(original.plans);
    await old.table('v8PlanVersions').bulkPut(original.versions);
    await old.table('metadata').put({ ...(await repository.readMetadata()), schemaVersion: 19 });
    old.close();
    const upgraded = new FitnessDatabase(name);
    await upgraded.open();
    const after = {
      state: await upgraded.v8State.toArray(),
      plans: await upgraded.v8Plans.toArray(),
      versions: await upgraded.v8PlanVersions.toArray(),
    };
    const metadata = await upgraded.metadata.toArray();
    upgraded.close();
    await upgraded.open();
    const repeated = await upgraded.v8State.toArray();
    upgraded.close();
    await upgraded.delete();
    return { original, after, repeated, schema: metadata[0].schemaVersion };
  });
  expect(result.schema).toBe(21);
  expect(result.after).toEqual(result.original);
  expect(result.repeated).toEqual(result.original.state);
  expect(result.after.state[0].coachProfile.population.prenatalCareConfirmed).toBeUndefined();
});

test('changing prenatal no to yes clears the old local blocking copy and the selector has no age group', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/acog-pregnancy-seed.ts';
    await (await import(/* @vite-ignore */ path)).seedAcogPregnancy(true);
  });
  await page.goto('/settings/engine');
  const question = page.getByRole('combobox', { name: '你现在在定期做产检吗？', exact: true });
  await question.selectOption('false');
  const reason = page.getByText('请先在产检时和医生或助产士聊聊运动的事，确认后回来告诉我们，我们再为你安排。', {
    exact: true,
  });
  await expect(reason).toBeVisible();
  await question.selectOption('true');
  await expect(reason).toHaveCount(0);
  const population = page.getByRole('combobox', { name: '孕期 / 产后状态', exact: true });
  await expect(population.locator('option[value="older_adult"]')).toHaveCount(0);
});
