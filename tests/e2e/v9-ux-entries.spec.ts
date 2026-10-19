import { expect, test, type Page } from '@playwright/test';
import { answerTexts, engineSafety, nextButton, startOnboarding } from './helpers/onboarding-v9';

/** Bo 2026-10-19 UX fixes: start date, AI-or-local onboarding, one AI entry on 今天, theme on 今天, tools outside the chat. */
test.setTimeout(120000);
const flags = (page: Page, extra: Record<string, boolean> = {}) => page.route('**/api/v1/features', route => route.fulfill({ json: { version: 1, flags: { trainingEngine: true, bodyProfile: true, planLifecycle: true, ...extra }, expiresAt: Date.now() + 3600000 } }));
const noAccess = (page: Page) => page.route('**/api/v1/trial/**', route => {
  const url = route.request().url();
  if (url.endsWith('/access-status')) return route.fulfill({ json: { qualification: 'none', sessionValid: false, aiEnabled: false } });
  if (url.endsWith('/application-config')) return route.fulfill({ json: { available: false, siteKey: null } });
  return route.fulfill({ json: [] });
});
const localDate = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + offset * 86400000));

async function toReady(page: Page, planMode: 'local' | 'stop' = 'local') {
  await startOnboarding(page);
  await page.getByRole('radio', { name: '想有些力量，不再容易累', exact: true }).click();
  await nextButton(page).click();
  await page.getByLabel('说说你的身体情况').fill('女，34岁，165厘米，60公斤');
  await nextButton(page).click();
  await page.getByRole('button', { name: '3 次', exact: true }).click(); await page.getByRole('button', { name: '45 分钟', exact: true }).click();
  await nextButton(page).click();
  await answerTexts(page, ['在家，有一对哑铃']);
  await engineSafety(page, { planMode });
}

test('onboarding: 芽芽 asks AI or local; AI without access guides activation, local continues offline', async ({ page }) => {
  await flags(page, { aiAssistantV2: true }); await noAccess(page);
  let modelCalls = 0; await page.route('**/api/v1/assistant/**', route => { modelCalls++; return route.abort(); });
  await page.setViewportSize({ width: 390, height: 844 });
  await toReady(page, 'stop');
  await expect(page.getByRole('heading', { name: '想让我怎么帮你排计划？' })).toBeVisible();
  await expect(nextButton(page)).toBeDisabled();
  await page.getByRole('radio', { name: /用 AI 帮我排/ }).click();
  await expect(page.getByText('这台设备还没开通 AI')).toBeVisible();
  await expect(nextButton(page)).toBeDisabled();
  await page.getByRole('button', { name: '现在开通', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: '开通 AI' });
  await expect(sheet.getByRole('heading', { name: 'AI 试用资格' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('ai-activation-390.png') });
  await sheet.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(sheet).toBeHidden();
  await page.getByRole('radio', { name: /先用本地计划/ }).click();
  await expect(nextButton(page)).toBeEnabled();
  await nextButton(page).click();
  await page.getByRole('button', { name: '生成计划', exact: true }).click();
  await expect(page.getByRole('heading', { name: '你的第一版计划', exact: true })).toBeVisible();
  expect(modelCalls).toBe(0);
});

test('onboarding without AI in this deployment does not ask the AI question', async ({ page }) => {
  await flags(page); await noAccess(page);
  await toReady(page);
  await expect(page.getByRole('heading', { name: '想让我怎么帮你排计划？' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '生成计划', exact: true })).toBeEnabled();
});

test('start date: draft picker moves the first week; 计划 can change it as a new version', async ({ page }) => {
  await flags(page); await noAccess(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await toReady(page);
  await page.getByRole('button', { name: '生成计划', exact: true }).click();
  await expect(page.getByRole('heading', { name: '你的第一版计划', exact: true })).toBeVisible();
  const picker = page.getByRole('group', { name: '从哪天开始' });
  await expect(picker.getByRole('button', { pressed: true })).toHaveAttribute('data-date', localDate());
  const later = localDate(3);
  await picker.locator(`[data-date="${later}"]`).click();
  await expect(picker.locator(`[data-date="${later}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.v9-week-summary-label')).toContainText('第一周');
  const dates = await page.locator('.v9-session[data-date]').evaluateAll(rows => rows.map(row => row.getAttribute('data-date')!));
  expect(dates.length).toBeGreaterThan(0);
  for (const date of dates) expect(date >= later).toBe(true);
  await page.screenshot({ path: test.info().outputPath('draft-start-date-390.png'), fullPage: true });
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  await expect(page.getByText(/开始$/).first()).toBeVisible();
  const stored = await page.evaluate(async () => { const path = '/src/ui/mainline/context.tsx'; const data = await (await import(/* @vite-ignore */ path)).workflow.snapshot(); return data.version?.startDate; });
  expect(stored).toBe(later);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '计划' }).click();
  await page.getByRole('button', { name: '改开始日期', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: '改开始日期' });
  await sheet.locator(`[data-date="${localDate(5)}"]`).click();
  await sheet.getByRole('button', { name: '就从这天开始', exact: true }).click();
  await expect(sheet).toBeHidden();
  const after = await page.evaluate(async () => { const path = '/src/ui/mainline/context.tsx'; const data = await (await import(/* @vite-ignore */ path)).workflow.snapshot(); return { start: data.version?.startDate, number: data.version?.versionNumber, versions: data.versions.length }; });
  expect(after).toEqual({ start: localDate(5), number: 2, versions: 2 });
});

test('今天: one AI entry (the orb), theme button switches style, 动作怎么做 opens the guide, 换动作 opens its own sheet', async ({ page }) => {
  await flags(page); await noAccess(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await toReady(page);
  await page.getByRole('button', { name: '生成计划', exact: true }).click();
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天', exact: true })).toBeVisible();
  const main = page.locator('main.v9-home');
  await expect(main.getByRole('button', { name: '和芽芽聊聊' })).toHaveCount(0);
  await expect(page.getByText('跟芽芽说说今天的情况')).toHaveCount(0);
  await expect(main.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '芽芽助手，按住可上下拖动' })).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath('home-pop-390.png') });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.screenshot({ path: test.info().outputPath('home-pop-1440.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  // Theme: visible on 今天, applies live.
  await page.getByRole('button', { name: '换风格', exact: true }).click();
  const themes = page.getByRole('dialog', { name: '选一个你喜欢的样子' });
  await themes.getByRole('radio', { name: '山野暖阳', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'vivid');
  await themes.getByRole('button', { name: '好了', exact: true }).first().click();
  await expect(themes).toBeHidden();
  // 动作怎么做 opens the guide with points.
  const first = main.locator('.v9-home-items details').first();
  await first.locator('summary').click();
  await first.getByRole('button', { name: '动作怎么做', exact: true }).click();
  const guide = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: '动作要点' }) });
  await expect(guide).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: test.info().outputPath('home-guide-390.png') });
  await guide.getByRole('button', { name: '关闭', exact: true }).first().click();
  await expect(guide).toBeHidden();
  // 换动作: its own sheet, a one-time change for today.
  await first.getByRole('button', { name: '换动作', exact: true }).click();
  const swap = page.getByRole('dialog', { name: '换个动作' });
  await expect(swap.getByText('只换今天这一次，计划不变。')).toBeVisible();
  const option = swap.getByRole('radio').first();
  await expect(option).toBeVisible();
  const chosen = (await option.innerText()).trim();
  await option.click();
  await swap.getByRole('button', { name: /^换成「/ }).click();
  await expect(swap).toBeHidden();
  await expect(first.locator('summary')).toContainText(chosen);
  // The orb's quick actions cover the common today requests and open the chat with the text ready.
  await page.getByRole('button', { name: '芽芽助手，按住可上下拖动' }).click();
  const panel = page.getByRole('dialog', { name: '芽芽快捷助手' });
  for (const label of ['只有 20 分钟', '今天有点累', '换个地方练']) await expect(panel.getByRole('button', { name: label })).toBeVisible();
  await panel.getByRole('button', { name: '只有 20 分钟' }).click();
  const chat = page.getByRole('dialog', { name: '芽芽', exact: true });
  await expect(chat.getByRole('textbox')).toHaveValue('只有 20 分钟');
  // The chat holds only the conversation: no exercise pickers or consent checkboxes in view.
  await expect(chat.getByRole('combobox')).toHaveCount(0);
  await expect(chat.getByRole('checkbox').first()).toBeHidden();
  await page.waitForTimeout(900);
  await page.screenshot({ path: test.info().outputPath('chat-390.png') });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(300);
  await page.screenshot({ path: test.info().outputPath('chat-1440.png') });
});
