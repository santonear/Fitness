import { test, expect } from '@playwright/test';
test('urgent UI interrupts thirteen actual IndexedDB negative dates and refresh retains the new evidence boundary', async ({
  page,
  baseURL,
}) => {
  await page.route('**/api/**', route =>
    route.fulfill({ status: 403, json: { error: 'offline local safety verification' } }),
  );
  await page.route('**/api/v1/features', route =>
    route.fulfill({
      json: {
        version: 1,
        flags: { trainingEngine: true, aiAssistantV2: false, bodyProfile: false },
        expiresAt: Date.parse('2026-11-01T00:00:00Z'),
      },
    }),
  );
  await page.route('**/api/v1/trial/access-status', route =>
    route.fulfill({ json: { qualification: 'none', sessionValid: false, aiEnabled: false } }),
  );
  await page.route(
    url => /^https?:$/.test(url.protocol) && url.origin !== new URL(baseURL!).origin,
    route => route.abort(),
  );
  await page.clock.setFixedTime(new Date('2026-10-01T02:00:00Z'));
  await page.goto('/');
  const seeded = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/b-safety-seed.ts';
    return (await import(/* @vite-ignore */ path)).seedSafety('postpartum');
  });
  const regression = async () =>
    JSON.stringify(
      (
        await page.evaluate(async () => {
          const path = '/tests/e2e/helpers/b-safety-seed.ts';
          return (await import(/* @vite-ignore */ path)).safetySnapshot();
        })
      ).state.postpartumSafety?.regression ?? null,
    );
  await page.goto('/workout/' + seeded.workoutId);
  const initial = await regression();
  await page.getByText('出现以下情况请立即停止', { exact: true }).first().click();
  await page.getByRole('button', { name: '漏尿', exact: true }).click();
  // The click saves asynchronously; wait for it so the day-2 report below cannot be overwritten by it (WebKit flake: 12 of 13 dates).
  await expect.poll(regression).not.toBe(initial);
  for (let day = 2; day <= 14; day++) {
    await page.clock.setFixedTime(new Date(`2026-10-${String(day).padStart(2, '0')}T02:00:00Z`));
    await page.evaluate(async () => {
      const cp = '/src/ui/mainline/context.tsx',
        rp = '/src/engine/data.ts',
        w = (await import(/* @vite-ignore */ cp)).workflow,
        r = new (await import(/* @vite-ignore */ rp)).Rules();
      await w.reportPostpartumSymptoms(undefined, {
        urgent: Object.fromEntries(r.get('postpartum.urgent').items.map((key: string) => [key, false])),
        regression: Object.fromEntries(
          r.get('postpartum.symptom_regression').when.contains_any.map((key: string) => [key, false]),
        ),
      });
    });
  }
  const before = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/b-safety-seed.ts';
    return (await import(/* @vite-ignore */ path)).safetySnapshot();
  });
  expect(before.state.postpartumSafety.regression.symptomFreeDates).toHaveLength(13);
  await page.clock.setFixedTime(new Date('2026-10-14T03:00:00Z'));
  await page.reload();
  await page.getByText('出现以下情况请立即停止', { exact: true }).first().click();
  await page.getByRole('button', { name: '发烧', exact: true }).click();
  await expect(page).toHaveURL(/workout\/recovery/);
  await page.reload();
  const after = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/b-safety-seed.ts';
    return (await import(/* @vite-ignore */ path)).safetySnapshot();
  });
  expect(after.state.postpartumSafety.regression).toMatchObject({
    phase: 2,
    requiredAt: '2026-10-14T03:00:00.000Z',
    symptomFreeDates: [],
  });
  expect(after.state.postpartumSafety.urgentAt).toBe('2026-10-14T03:00:00.000Z');
  expect(after.workouts[0].sets).toEqual(seeded.sets);
  expect(after.workouts[0].status).toBe('partial');
});
