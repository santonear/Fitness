import { expect, test, type Page, type Route } from '@playwright/test';
import { answerTexts, ensurePressed, cautions, nextButton, pickTrainingDays, shanghaiDate, startOnboarding } from './helpers/onboarding-v9';

/**
 * Bo 2026-10-19: after picking training days on the calendar, 芽芽 must not ask which days to rest, and
 * "按我的时间表来" keeps the picked days. Mocked assistant: the model "insists" on Mon–Fri, the server
 * assembly drops it, and the draft keeps the picked dates through a chat regenerate.
 */
test.setTimeout(150000);
const flags = (page: Page) => page.route('**/api/v1/features', route => route.fulfill({ json: { version: 1, flags: { aiAssistantV2: true }, expiresAt: Date.now() + 3600000 } }));
const access = (page: Page) => page.route('**/api/v1/trial/access-status', route => route.fulfill({ json: { qualification: 'active', sessionValid: true, expiresAt: Date.now() + 86400000, aiEnabled: true, planningBudgetDisabled: true } }));
const sse = (events: unknown[]) => events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('');

test('picked dates reach the model as a fixed constraint and survive an AI plan and a chat regenerate', async ({ page }) => {
  await flags(page); await access(page);
  const sent: any[] = [], prompts: string[] = [];
  await page.route('**/api/v1/assistant/chat', async (route: Route) => {
    const body = route.request().postDataJSON();
    sent.push(body);
    // Server code (sanitize, prompt, assembly) runs from the dev server's modules in the page.
    // The model ignores the dates and asks for a default Mon–Fri week; the server must not follow it.
    const { attachment, prompt } = await page.evaluate(async raw => {
      const c = '/src/assistant/contracts.ts', a = '/src/backend/assistant/assemble.ts', p = '/src/backend/assistant/prompts.ts';
      const request = (await import(/* @vite-ignore */ c)).sanitizeAssistantRequest(raw);
      const prompt = (await import(/* @vite-ignore */ p)).assistantPrompt(request, 'text')[0].content as string;
      const { attachment } = (await import(/* @vite-ignore */ a)).assembleAssistantIntent({ kind: 'plan_new', params: { daysPerWeek: 5, preferredDays: ['mon', 'tue', 'wed', 'thu', 'fri'] } }, request);
      return { attachment, prompt };
    }, body);
    prompts.push(prompt);
    await route.fulfill({ contentType: 'text/event-stream', body: sse([
      { type: 'text_delta', delta: '按你选的日子排好了。' },
      { type: 'attachment_pending' },
      { type: 'attachment', attachment },
      { type: 'done', success: true, usage: { inputTokens: 1, outputTokens: 1 }, promptVersion: 'test' },
    ]) });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await startOnboarding(page);
  await page.getByRole('radio', { name: '想有些力量，不再容易累', exact: true }).click();
  await nextButton(page).click();
  await expect(page.getByRole('heading', { name: '什么时候练？' })).toBeVisible();
  const picked = [shanghaiDate(2), shanghaiDate(4)];
  await pickTrainingDays(page, picked);
  await page.getByRole('button', { name: '晚上 7:00', exact: true }).click();
  await nextButton(page).click();
  await answerTexts(page, ['在家，有一对哑铃']);
  await ensurePressed(page, '我已年满 18 岁');
  await nextButton(page).click();
  await cautions(page);
  await expect(page.getByRole('heading', { name: '想让我怎么帮你排计划？', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: /用 AI 帮我排/ }).click();
  await nextButton(page).click();
  await page.getByRole('button', { name: '生成计划', exact: true }).click();
  await expect(page.getByRole('heading', { name: '你的第一版计划', exact: true })).toBeVisible();

  // 1. The generation request carries the dates; the prompt forbids asking about rest days.
  expect(sent).toHaveLength(1);
  expect(sent[0].context.schedule).toEqual({ trainingDates: picked, startTime: '19:00' });
  expect(sent[0].context.profile.preferredDays).toBeUndefined();
  expect(prompts[0]).toContain('Fixed training dates');
  expect(prompts[0]).toContain('Do not ask which days to train or rest');

  // 2. The draft keeps exactly the picked dates (not Mon–Fri).
  const month = page.locator('section.v9-month-plan');
  const planned = () => month.locator('.v9-month-day[data-state="planned"]').evaluateAll(cells => cells.map(cell => cell.getAttribute('data-date')));
  await expect(page.getByTestId('draft-days')).toContainText('共 2 天');
  await expect.poll(planned).toEqual(picked.filter(date => date.slice(0, 7) === picked[0].slice(0, 7)));

  // 3. "按我的时间表来" in chat: request still carries the dates, the card says they are kept, applying keeps them.
  await page.getByRole('button', { name: '问问芽芽怎么改', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('按我的时间表来');
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  await expect(dialog.locator('[data-picked-days="kept"]')).toContainText('训练日：按你选的 2 天');
  expect(sent).toHaveLength(2);
  expect(sent[1].context.schedule).toEqual({ trainingDates: picked, startTime: '19:00' });
  expect(prompts[1]).toContain(picked.join(', '));
  await dialog.getByRole('button', { name: '应用建议' }).click();
  await expect(page.getByRole('heading', { name: '你的第一版计划', exact: true })).toBeVisible();
  await expect(page.getByTestId('draft-days')).toContainText('共 2 天');
  await expect.poll(planned).toEqual(picked.filter(date => date.slice(0, 7) === picked[0].slice(0, 7)));

  // 4. The saved plan keeps the picked dates and start time.
  await page.getByRole('button', { name: '就用这份计划', exact: true }).click(); await page.getByRole('button', { name: '先不写', exact: true }).click();
  await expect(page).not.toHaveURL(/plan-draft/);
  const version = await page.evaluate(async () => { const path = '/src/ui/mainline/context.tsx'; return (await (await import(/* @vite-ignore */ path)).workflow.snapshot()).version; });
  expect(version.trainingDates).toEqual(picked);
  expect(version.startTime).toBe('19:00');
  expect(version.preferredDays ?? []).toEqual([]);
});
