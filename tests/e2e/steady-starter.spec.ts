import { expect, test, type Page } from '@playwright/test';
import { fillBirthMonth } from './helpers/birth-month';
import {
  answerTexts,
  cautions,
  choosePlanMode,
  ensurePressed,
  nextButton,
  startOnboarding,
} from './helpers/onboarding-v9';

/** 稳健 route (H) and 新手 4 周 (J), Bo 2026-10-25. */
test.setTimeout(150000);
const flags = (page: Page) =>
  page.route('**/api/v1/features', route =>
    route.fulfill({ json: { version: 1, flags: { trainingEngine: true }, expiresAt: Date.now() + 3600000 } }),
  );
const shot = (page: Page, name: string) =>
  process.env.STEADY_SHOTS ? page.screenshot({ path: `test-results-review/steady/${name}.png`, fullPage: true }) : null;

test('60+ gets 稳健 preselected, its 芽芽 lines, and 新手 4 周 can start and be left on 计划', async ({ page }) => {
  await flags(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await startOnboarding(page);
  await answerTexts(page, ['想有些力量，不再容易累', '每周 2 次，每次 30 分钟', '在家，没有器械']);
  await ensurePressed(page, '我已年满 18 岁');
  await ensurePressed(page, /同意将运动前自查/);
  await nextButton(page).click();
  await fillBirthMonth(page, '1960-01');
  await nextButton(page).click();
  for (let group = 0; group < 3; group++) await page.getByRole('button', { name: '以上都没有', exact: true }).click();
  await page.getByRole('radio', { name: '是', exact: true }).click();
  await page.getByRole('radio', { name: '低于 160/90', exact: true }).click();
  await expect(page.getByRole('heading', { name: '选一条路线', exact: true })).toBeVisible();
  const steady = page.getByRole('radio', { name: /稳健/ });
  await expect(steady).toHaveAttribute('aria-checked', 'true');
  await expect(steady).toContainText('腿有劲、站得稳、走得远');
  await expect(page.getByText(/我会按 60 岁以上的安全要求来排/)).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(4);
  await shot(page, 'route-390');
  await nextButton(page).click();
  await page.getByRole('radio', { name: '都不是', exact: true }).click();
  await expect(page.getByRole('heading', { name: /先问 4 个关于走路和平衡的小问题/ })).toBeVisible();
  await page.getByRole('button', { name: '以上都没有', exact: true }).click();
  const intensity = page.getByRole('heading', { name: '关于强度' }),
    care = page.getByRole('heading', { name: '身体有需要照顾的部位吗？' });
  await expect(intensity.or(care)).toBeVisible();
  if (await intensity.isVisible()) await nextButton(page).click();
  await cautions(page);
  await nextButton(page).click();
  await choosePlanMode(page);
  await page.getByRole('button', { name: '生成计划', exact: true }).click();
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click();
  await page.getByRole('button', { name: '先不写', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  const route = await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx',
      c = await import(/* @vite-ignore */ path);
    return (await c.workflow.snapshot()).state?.coachProfile?.route;
  });
  expect(route).toBe('steady');
  await expect(page.getByText(/今天练腿力和平衡，大约 \d+ 分钟/)).toBeVisible();
  await shot(page, 'today-390');

  await page.goto('/plans');
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: '新手 4 周', exact: true }) });
  await expect(card.getByText(/刚开始练？试试新手 4 周/)).toBeVisible();
  await expect(card.getByText(/体型变化通常要更久/)).toBeVisible();
  await card.getByRole('button', { name: '用新手 4 周', exact: true }).click();
  await expect(card.getByTestId('starter-progress')).toHaveText('第 1 周 / 共 4 周');
  await expect(card.getByText(/第 1 周 · 先熟悉动作/)).toBeVisible();
  await shot(page, 'starter-390');
  await page.setViewportSize({ width: 1440, height: 900 });
  await shot(page, 'starter-1440');
  await page.setViewportSize({ width: 390, height: 844 });
  await card.getByRole('button', { name: '退出', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /退出新手 4 周？/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '退出', exact: true }).click();
  await expect(page.getByText(/好，已经退出了。想再试的时候，在计划页可以重新开始/)).toBeVisible();
  await expect(page.getByRole('button', { name: '用新手 4 周', exact: true })).toBeVisible();
  // Start and leave each added a version; the first one is untouched. Poll: the leave save can land after its toast; the store does not keep version order.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = '/src/ui/mainline/context.tsx',
          c = await import(/* @vite-ignore */ path),
          s = await c.workflow.snapshot();
        return [...s.versions]
          .sort((a: { versionNumber: number }, b: { versionNumber: number }) => a.versionNumber - b.versionNumber)
          .map((v: { starterProgram?: unknown }) => !!v.starterProgram);
      }),
    )
    .toEqual([false, true, false]);
  await page.getByRole('button', { name: '自己排', exact: true }).click();
  await expect(page.getByRole('button', { name: '用新手 4 周', exact: true })).toHaveCount(0);

  await page.goto('/');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await expect(page).toHaveURL(/\/today-focus$/);
  await expect(page.getByText('旁边放一把结实的椅子，需要的时候扶一下。', { exact: true })).toBeVisible();
});
