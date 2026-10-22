import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      Object.defineProperty(animation, 'onfinish', { configurable: true, get: () => null, set: () => {} });
      return animation;
    };
  });
});
test('dialog closes and restores focus within fallback even when animation completion is lost', async ({ page }) => {
  await page.goto('/tests/fixtures/v8-components/index.html');
  const trigger = page.getByRole('button', { name: '深蹲 · 20 kg × 8', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const start = Date.now();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 2000 });
  expect(Date.now() - start).toBeGreaterThanOrEqual(500);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveCSS('visibility', 'visible');
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 2000 });
  await expect(trigger).toBeFocused();
});
test('reopening cancels the previous close fallback', async ({ page }) => {
  await page.goto('/tests/fixtures/v8-components/index.html');
  const trigger = page.getByRole('button', { name: '深蹲 · 20 kg × 8', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  // Programmatic reopen while the close animation is still pending.
  await trigger.evaluate(element => (element as HTMLButtonElement).click());
  await page.waitForTimeout(750);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 2000 });
  await expect(trigger).toBeFocused();
});
for (const locale of ['zh', 'en'] as const)
  test(`previous same-name plans display earliest creation dates in profile timezone (${locale})`, async ({ page }) => {
    await page.goto('/manual');
    await expect(page.getByRole('searchbox')).toBeVisible();
    await page.evaluate(async locale => {
      const load = (path: string) => import(/* @vite-ignore */ path);
      const { workflow } = await load('/src/ui/mainline/context.tsx');
      const { repository } = await load('/src/persistence/repository.ts');
      const ids = [];
      for (let i = 0; i < 4; i++) {
        await workflow.adopt(
          await workflow.propose({
            goalText: 'Same name',
            scheduleOriginalText: '每周2次，每次30分钟',
            weeklyTarget: 2,
            sessionMinutes: 30,
            place: 'home',
            equipment: ['none'],
            adultConfirmed: true,
            cautions: [],
            confirmedAt: new Date().toISOString(),
          }),
        );
        ids.push((await workflow.snapshot()).version.id);
      }
      for (let i = 0; i < 3; i++) {
        const version = await repository.db.v8PlanVersions.get(ids[i]);
        await repository.db.v8PlanVersions.put({
          ...version,
          createdAt: i === 2 ? '' : '2026-10-' + (i === 0 ? '02' : '03') + 'T02:30:00Z',
        });
      }
      const profile = await repository.db.profiles.toCollection().first();
      await repository.db.profiles.put({ ...profile, locale, timeZone: 'America/Los_Angeles' });
    }, locale);
    await page.goto('/plans');
    const previous = page.locator('section[aria-labelledby="previous-plans-title"]');
    await expect(previous.getByRole('heading', { name: 'Same name', exact: true })).toHaveCount(3);
    const expected = ['2026-10-02T02:30:00Z', '2026-10-03T02:30:00Z'].map(value =>
      new Intl.DateTimeFormat(locale, {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value)),
    );
    await expect(previous.locator('time')).toHaveCount(2);
    for (const [index, value] of ['2026-10-02T02:30:00Z', '2026-10-03T02:30:00Z'].entries())
      await expect(previous.locator(`time[datetime="${value}"]`)).toHaveText(expected[index]);
    await expect(
      previous.getByText(locale === 'zh' ? '创建日期未知' : 'Creation date unknown', { exact: true }),
    ).toBeVisible();
  });
