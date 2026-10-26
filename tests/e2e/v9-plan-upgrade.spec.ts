import { expect, test, type Page } from '@playwright/test';
import { answerTexts, engineSafety, nextButton, startOnboarding, weeklySchedule } from './helpers/onboarding-v9';

/** UIUX20261008 V9.14/V9.17: 今天 panel → 今天练这里 → start; 给未来的自己 and 体能自测; 训练设置; 现在有点烦. */
test.setTimeout(150000);
const flags = (page: Page) =>
  page.route('**/api/v1/features', route =>
    route.fulfill({
      json: { version: 1, flags: { trainingEngine: true, bodyProfile: true }, expiresAt: Date.now() + 3600000 },
    }),
  );

async function toPlan(page: Page, letter?: string) {
  await startOnboarding(page);
  await page.getByRole('radio', { name: '想有些力量，不再容易累', exact: true }).click();
  await nextButton(page).click();
  await page.getByLabel('说说你的身体情况').fill('女，34岁，165厘米，60公斤');
  await nextButton(page).click();
  await weeklySchedule(page, 3, 45);
  await nextButton(page).click();
  await answerTexts(page, ['在家，有一对哑铃']);
  await engineSafety(page, { planMode: 'local' });
  await page.getByRole('button', { name: '生成计划', exact: true }).click();
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click();
  await expect(page.getByRole('heading', { name: '给未来的自己', exact: true })).toBeVisible();
  if (letter) {
    await page.getByPlaceholder('请给未来完成训练的你留言').fill(letter);
    await page.getByRole('button', { name: '收好', exact: true }).click();
  } else await page.getByRole('button', { name: '先不写', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
}

test('今天: minutes panel opens 今天练这里, a card highlights its own groups, and start begins training', async ({
  page,
}) => {
  await flags(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await toPlan(page);
  await page.getByRole('radio', { name: '15 分钟' }).click();
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await expect(page).toHaveURL(/\/today-focus$/);
  await expect(page.getByRole('heading', { name: '今天练这里' })).toBeVisible();
  await expect(page.getByText('主练', { exact: true })).toBeVisible();
  const cards = page.locator('.pu-cards button');
  expect(await cards.count()).toBeGreaterThan(0);
  await cards.first().click();
  await expect(cards.first()).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^开始 · / }).click();
  await expect(page).toHaveURL(/\/workout\//);
  await expect(page.getByText('语音播报')).toBeVisible();
});

test('今天: B plan, fragment scene with the honest line and its evidence fold; no "X 天没练"', async ({ page }) => {
  await flags(page);
  await toPlan(page);
  await page.getByRole('button', { name: '换个练法', exact: true }).click();
  await page.getByRole('button', { name: '累了', exact: true }).click();
  await expect(page.getByText('我给今天备了两套方案', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '办公室', exact: true }).click();
  await expect(page.getByText('说实话，零碎练对健康很有用', { exact: false })).toBeVisible();
  await page.getByText('查看依据 ›', { exact: true }).click();
  await expect(page.getByText('中等把握')).toBeVisible();
  await expect(page.getByText(/\d+\s*天没练/)).toHaveCount(0);
  await page.getByRole('button', { name: '写下何时何地练', exact: true }).click();
  await page.getByLabel('你一般什么时候、在哪儿最可能练？我按这个来排计划 🎯').fill('周二下班后，客厅');
  await page.getByRole('button', { name: '记下', exact: true }).click();
  await expect(page.getByText('周二下班后，客厅', { exact: false })).toBeVisible();
});

test('今天: the panel style switches on the panel itself (knob, arrow keys, swipe) and is remembered; 我的 has no style setting', async ({
  page,
}) => {
  await flags(page);
  await toPlan(page);
  const panel = page.locator('section.v9-home-panel[data-style]');
  await expect(panel).toHaveAttribute('data-style', 'hero');
  const knob = panel.getByRole('radiogroup', { name: '首页面板样式' });
  await knob.getByRole('radio', { name: '双表盘' }).click();
  await expect(panel).toHaveAttribute('data-style', 'twin');
  await knob.getByRole('radio', { name: '双表盘' }).press('ArrowRight');
  await expect(panel).toHaveAttribute('data-style', 'hero');
  await expect(knob.getByRole('radio', { name: '大数字' })).toBeFocused();
  await panel.getByRole('button', { name: '下一个样式' }).click();
  await expect(panel).toHaveAttribute('data-style', 'ring');
  // A horizontal touch swipe (right to left) moves to the next style; a vertical move does nothing.
  const swipe = (dx: number, dy: number) =>
    panel.evaluate(
      (node, [dx, dy]) => {
        const box = node.getBoundingClientRect(),
          x = box.left + box.width / 2,
          y = box.top + 40;
        const fire = (type: string, cx: number, cy: number) =>
          node.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              pointerId: 7,
              pointerType: 'touch',
              isPrimary: true,
              clientX: cx,
              clientY: cy,
            }),
          );
        fire('pointerdown', x, y);
        fire('pointerup', x + dx, y + dy);
      },
      [dx, dy],
    );
  await swipe(-80, 6);
  await expect(panel).toHaveAttribute('data-style', 'twin');
  await swipe(10, 120);
  await expect(panel).toHaveAttribute('data-style', 'twin');
  await page.reload();
  await expect(panel).toHaveAttribute('data-style', 'twin');
  await page.goto('/settings');
  await expect(page.getByText('首页面板样式')).toHaveCount(0);
});

test('我的 › 训练设置: outline toggle; the outline on 我的 respects the toggle and follows 自记录', async ({
  page,
}) => {
  await flags(page);
  await toPlan(page);
  await page.goto('/settings');
  const summary = page.locator('section.v9-change-summary');
  await expect(summary.getByText('轮廓按身高、体重和体脂估算，仅作示意')).toBeVisible();
  await page.getByRole('button', { name: /^自记录/ }).click();
  await page.getByLabel('体重（公斤）').fill('59.5');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.v9-change-value').first()).toContainText('59.5');
  await expect(page.getByText(/胖|肥|瘦|标准身材/)).toHaveCount(0);
  await page.goto('/settings');
  await page.getByLabel('显示体型轮廓').uncheck();
  await expect(summary.getByText('轮廓按身高、体重和体脂估算，仅作示意')).toHaveCount(0);
  await page.goto('/journey');
  await expect(page.getByRole('heading', { name: '我的', exact: true })).toBeVisible();
});

test('给未来的自己 is the last step of making a plan; 体能自测 lives in 我的 › 自测组件', async ({ page }) => {
  await flags(page);
  await toPlan(page, '记得今天为什么出发');
  await page.goto('/settings');
  await page.getByRole('button', { name: /^体能自测/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '体能自测', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '现在测' }).click();
  await expect(page.getByLabel('30 秒坐站')).toHaveCount(0);
  await page.getByLabel('俯卧撑（女性可跪姿）').fill('15');
  await page.getByLabel('1 分钟仰卧起坐').fill('25');
  await page.getByRole('button', { name: '记下成绩' }).click();
  await expect(page.getByText('估算', { exact: true })).toBeVisible();
  await page.goto('/settings/changes');
  // A new letter is sealed (7 days by default): only its opening date shows until then.
  await expect(page.getByText(/^\d+ 月 \d+ 日开启$/)).toBeVisible();
  await expect(page.getByText('记得今天为什么出发', { exact: true })).toHaveCount(0);
});

test('现在有点烦: breathing runs locally and the low-mood line has no emoji', async ({ page }) => {
  await flags(page);
  const sent: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/v1/assistant')) sent.push(request.url());
  });
  await toPlan(page);
  await page.getByRole('button', { name: '换个练法', exact: true }).click();
  await page.getByRole('button', { name: '现在有点烦' }).click();
  await expect(page).toHaveURL(/\/calm$/);
  await page.getByRole('button', { name: '慢慢呼吸' }).click();
  await expect(page.getByText(/^(吸气|呼气)$/)).toBeVisible();
  await page.getByRole('button', { name: '结束' }).click();
  await page.getByRole('button', { name: '还是很烦' }).click();
  await expect(page.getByText('那今天就别勉强了，好好休息。要是一直这样，找个信得过的人聊聊会好受些。')).toBeVisible();
  expect(sent).toEqual([]);
});
