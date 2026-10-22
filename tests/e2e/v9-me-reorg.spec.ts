import { expect, test, type Page } from '@playwright/test';
import { answerTexts, engineSafety, nextButton, startOnboarding, weeklySchedule } from './helpers/onboarding-v9';

/** Bo 2026-10-19: 我的 grouped (我 first, with 我的变化), and a separate 营养建议 entry with its own AI chat. */
test.setTimeout(150000);
const flags = (page: Page) => page.route('**/api/v1/features', route => route.fulfill({ json: { version: 1, flags: { trainingEngine: true, bodyProfile: true, planLifecycle: true, aiAssistantV2: true, nutrition: true }, expiresAt: Date.now() + 3600000 } }));
const access = (page: Page) => page.route('**/api/v1/trial/**', route => {
  const url = route.request().url();
  if (url.endsWith('/access-status')) return route.fulfill({ json: { qualification: 'active', sessionValid: true, aiEnabled: true, summaryAvailable: true } });
  if (url.endsWith('/application-config')) return route.fulfill({ json: { available: false, siteKey: null } });
  return route.fulfill({ json: [] });
});
const localDate = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + offset * 86400000));

async function toPlan(page: Page) {
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
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click(); await page.getByRole('button', { name: '先不写', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
}

test('我的: grouped sections with 我 first; 我的变化 shows measurements, strength and months; 营养建议 chat sends only the conversation', async ({ page }) => {
  await flags(page); await access(page);
  const sent: Record<string, unknown>[] = [];
  await page.route('**/api/v1/assistant/chat', route => { sent.push(route.request().postDataJSON()); return route.fulfill({ contentType: 'text/event-stream', body: ['训练后吃点主食和蛋白质，比如米饭配鸡蛋。', ''].map((delta, index) => index ? `data: ${JSON.stringify({ type: 'done', success: true, usage: { inputTokens: 1, outputTokens: 1 }, promptVersion: 'test' })}\n\n` : `data: ${JSON.stringify({ type: 'text_delta', delta })}\n\n`).join('') }); });
  await page.setViewportSize({ width: 390, height: 844 });
  await toPlan(page);
  // A finished session with a weighted set, through the real workflow.
  await page.evaluate(async () => {
    const path = '/src/ui/mainline/context.tsx';
    const { workflow } = await import(/* @vite-ignore */ path);
    const data = await workflow.snapshot();
    const record = await workflow.start(data.version.templates[0].id);
    const items = record.templateSnapshot.items as { target: { metricType: string; reps?: number; durationSeconds?: number } }[];
    const index = Math.max(0, items.findIndex(item => item.target.metricType === 'reps_load'));
    const target = items[index].target;
    const values = target.metricType === 'reps_load' ? { reps: target.reps, loadGrams: 8000 } : target.metricType === 'reps' ? { reps: target.reps } : { durationSeconds: target.durationSeconds };
    await workflow.recordSet(record.id, index, 0, values);
    await workflow.finish(record.id, { reasons: [] });
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();

  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '我的' }).click();
  await expect(page.getByRole('heading', { name: '我的', exact: true })).toBeVisible();
  const groups = await page.locator('main.v9-settings > section.v9-settings-group > h2').allInnerTexts();
  expect(groups).toEqual(['我', '营养建议', '自测组件', '训练设置', '芽芽与 AI', '数据与隐私', '通用']);
  await expect(page.getByRole('button', { name: '运动前自查与训练偏好' })).toHaveCount(1);
  await expect(page.getByRole('radiogroup', { name: '界面风格' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^给我们留言/ })).toHaveCount(1);
  const summary = page.locator('section.v9-change-summary');
  await expect(summary.getByText('这个月', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^体能自测/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^我的山路/ })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('me-pop-390.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: test.info().outputPath('me-pop-1440.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });

  // 自记录: the periodic body record is an inline form, then the change shows.
  await page.getByRole('button', { name: /^自记录/ }).click();
  await expect(page.getByRole('heading', { name: '自记录', exact: true })).toBeVisible();
  await expect(page.getByTestId('month-current')).toContainText('1');
  const record = page.locator('section.v9-change-card').filter({ has: page.getByRole('heading', { name: '阶段性数据记录', exact: true }) });
  await expect(record.getByRole('img')).toHaveCount(0);
  await record.getByLabel('日期').fill(localDate(-30));
  await record.getByLabel('体重（公斤）').fill('61.5');
  await record.getByLabel('体脂率（%，可选）').fill('28');
  await record.getByRole('button', { name: '保存', exact: true }).click();
  await expect(record.getByRole('status')).toHaveText('已记下');
  await record.getByLabel('日期').fill(localDate(0));
  await record.getByLabel('体重（公斤）').fill('60');
  await record.getByLabel('体脂率（%，可选）').fill('26.5');
  await record.getByRole('button', { name: '保存', exact: true }).click();
  await expect(record.locator('.v9-change-delta')).toContainText('-1.5公斤');
  const fat = page.locator('section.v9-change-card').filter({ has: page.getByRole('heading', { name: '体脂', exact: true }) });
  await expect(fat.locator('.v9-change-delta')).toContainText('-1.5%');
  await expect(page.getByRole('img', { name: /^最近 6 个月每月训练次数/ })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('changes-pop-390.png'), fullPage: true });
  await page.getByRole('button', { name: '看月度回顾', exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);

  // 营养建议 from 我的: conversation only, records below.
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '我的' }).click();
  // The body outline on 我的 follows the latest record, with the earlier one dashed.
  await expect(summary.getByRole('img', { name: /全身肌群图/ })).toBeVisible();
  await expect(summary.locator('.v9-am-ghost')).not.toHaveCount(0);
  await expect(summary.getByText('轮廓按身高、体重和体脂估算，仅作示意')).toBeVisible();
  await page.getByRole('button', { name: /^营养建议/ }).click();
  await expect(page.getByRole('heading', { name: '营养建议', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: '练完吃什么比较好' }).or(page.getByRole('button', { name: '练完吃什么比较好' })).first().click();
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByRole('log').getByText('训练后吃点主食和蛋白质')).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ topic: 'nutrition', consent: { body: false, history: false } });
  expect(sent[0].context).toBeUndefined();
  expect(sent[0].currentWorkout).toBeUndefined();
  await expect(page.getByRole('button', { name: '保存记录', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('nutrition-pop-390.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: test.info().outputPath('nutrition-pop-1440.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });

  // 今天's 芽芽 orb also opens 营养建议.
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '今天' }).click();
  // The orb may still be tucked aside on a busy runner; a tap first brings it out, the next opens the panel.
  await expect(async () => {
    if (!await page.getByRole('dialog', { name: '芽芽快捷助手' }).isVisible()) await page.getByRole('button', { name: '芽芽助手，按住可上下拖动' }).click();
    await expect(page.getByRole('dialog', { name: '芽芽快捷助手' })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole('dialog', { name: '芽芽快捷助手' }).getByRole('button', { name: '吃什么、喝多少' }).click();
  await expect(page.getByRole('heading', { name: '营养建议', exact: true })).toBeVisible();
});

test('今天: the muscle map follows the plan and the body answer, and names the same main muscles as the focus list', async ({ page }) => {
  await flags(page); await access(page);
  await toPlan(page);
  const map = page.locator('.v9-anatomy').first();
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute('data-sex', 'female');
  await expect(map.locator('.v9-am-muscle[data-role="primary"]')).not.toHaveCount(0);
  const label = await map.getByRole('img').getAttribute('aria-label');
  const focus = await page.locator('.v9-focus-list .v9-focus-item').allInnerTexts();
  expect(focus.length).toBeGreaterThan(0);
  for (const name of focus.map(text => text.replace(/^\d+\s*/, '').trim())) expect(label).toContain(name);
});
