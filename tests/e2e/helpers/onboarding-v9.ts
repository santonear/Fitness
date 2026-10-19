import { fillBirthMonth } from './birth-month';
import { expect, type Page } from '@playwright/test';

/** V9 entry flow helpers: welcome → tap onboarding → one-question health check. Chinese UI. */
export const nextButton = (page: Page) => page.getByRole('button', { name: '下一步', exact: true });

/** Fresh user lands on the welcome screen at /onboarding and taps 开始. */
export async function startOnboarding(page: Page, path = '/') {
  await page.goto(path);
  await expect(page).toHaveURL(/onboarding/);
  await page.getByRole('button', { name: '开始', exact: true }).click();
}

/** Taps a listed option when the answer matches one, otherwise writes it under “自己写一句”. */
export async function answerText(page: Page, text: string) {
  await expect(nextButton(page)).toBeVisible();
  const option = page.getByRole('radio', { name: text, exact: true });
  if (await option.count()) await option.click();
  else {
    const custom = page.getByRole('button', { name: /自己写一句|收起/ });
    if ((await custom.getAttribute('aria-pressed')) !== 'true') await custom.click();
    await page.getByLabel('你的回答', { exact: true }).fill(text);
  }
  await nextButton(page).click();
}
export async function answerTexts(page: Page, texts: readonly string[]) { for (const text of texts) await answerText(page, text); }

/** Basic (no training engine) safety: adult, cautions, then the ready screen. */
/** Presses a check-style choice only when it is not already on (answers may be restored). */
export async function ensurePressed(page: Page, name: string | RegExp) {
  const choice = page.getByRole('button', { name });
  await expect(choice).toBeVisible();
  if ((await choice.getAttribute('aria-pressed')) !== 'true') await choice.click();
}
export async function basicSafety(page: Page, caution?: string, planMode: PlanModeChoice = 'local') {
  await ensurePressed(page, '我已年满 18 岁');
  await nextButton(page).click();
  await cautions(page, caution);
  await choosePlanMode(page, planMode);
}
/** V9.0.2: when AI exists in the deployment, 芽芽 asks AI-or-local before the ready screen. */
export type PlanModeChoice = 'local' | 'stop';
export async function choosePlanMode(page: Page, planMode: PlanModeChoice = 'local') {
  const ready = page.getByRole('heading', { name: '都准备好了', exact: true }), ask = page.getByRole('heading', { name: '想让我怎么帮你排计划？', exact: true });
  await expect(ready.or(ask)).toBeVisible();
  if (planMode === 'stop' || !(await ask.isVisible())) return;
  await page.getByRole('radio', { name: /先用本地计划/ }).click();
  await nextButton(page).click();
  await expect(ready).toBeVisible();
}
export async function cautions(page: Page, caution?: string) {
  if (caution) { await page.getByRole('radio', { name: '有，选一下部位' }).click(); await page.getByRole('button', { name: caution, exact: true }).click(); }
  else await page.getByRole('radio', { name: '没有', exact: true }).click();
  await nextButton(page).click();
}
export async function generate(page: Page) { await page.getByRole('button', { name: '生成计划', exact: true }).click(); }

export interface EngineSafetyOptions { planMode?: PlanModeChoice; birth?: string; population?: '都不是' | '在孕期' | '在产后'; activity?: '是' | '没有或不确定'; bp?: '低于 160/90' | '160/90 或更高' | '不知道'; falls?: boolean[]; caution?: string; skipPopulation?: boolean; prefs?: (page: Page) => Promise<void> }
/** Training-engine safety, every screening answer explicit; stops on the ready screen. */
export async function engineSafety(page: Page, options: EngineSafetyOptions = {}) {
  await ensurePressed(page, '我已年满 18 岁');
  await ensurePressed(page, /同意将运动前自查/);
  await nextButton(page).click();
  await fillBirthMonth(page,options.birth ?? '1991-06');
  await nextButton(page).click();
  for (let group = 0; group < 3; group++) await page.getByRole('button', { name: '以上都没有', exact: true }).click();
  await page.getByRole('radio', { name: options.activity ?? '是', exact: true }).click();
  await page.getByRole('radio', { name: options.bp ?? '低于 160/90', exact: true }).click();
  if (!options.skipPopulation) await page.getByRole('radio', { name: options.population ?? '都不是', exact: true }).click();
  if (options.falls) {
    if (options.falls.every(answer => !answer)) await page.getByRole('button', { name: '以上都没有', exact: true }).click();
    else {
      await page.getByRole('button', { name: '有其中一项，逐个确认' }).click();
      for (const answer of options.falls) await page.getByRole('radio', { name: answer ? '是' : '否', exact: true }).click();
    }
  }
  const intensity = page.getByRole('heading', { name: '关于强度' }), care = page.getByRole('heading', { name: '身体有需要照顾的部位吗？' });
  await expect(intensity.or(care)).toBeVisible();
  if (await intensity.isVisible()) await nextButton(page).click();
  await expect(care).toBeVisible();
  await cautions(page, options.caution);
  if (options.caution && options.caution !== '其他') await page.getByRole('button', { name: '以上都没有', exact: true }).click();
  await expect(page.getByRole('heading', { name: '最后，说说训练条件' })).toBeVisible();
  await options.prefs?.(page);
  await nextButton(page).click();
  await choosePlanMode(page, options.planMode);
}

/** Whole basic flow for the common test profile; ends on the plan draft. */
export async function onboardBasic(page: Page, texts: readonly string[], caution?: string) {
  await startOnboarding(page);
  await answerTexts(page, texts);
  await basicSafety(page, caution);
  await generate(page);
}

/** From welcome or any onboarding screen (answers may be restored), go back to the first question. */
export async function toFirstQuestion(page: Page) {
  const start = page.getByRole('button', { name: '开始', exact: true }), goal = page.getByRole('heading', { name: '你想练成什么样？' }), back = page.getByRole('button', { name: '上一步', exact: true });
  await expect(start.or(back).first()).toBeVisible();
  for (let i = 0; i < 30; i++) {
    if (await goal.isVisible()) return;
    if (await start.isVisible()) await start.click(); else await back.click();
    await page.waitForTimeout(60);
  }
  await expect(goal).toBeVisible();
}
