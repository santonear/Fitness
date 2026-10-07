import { expect, test, type Page } from '@playwright/test';
test.setTimeout(90_000);
async function state(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/persistence/db.ts'; const { database } = await import(/* @vite-ignore */ path);
    return { guided: await database.guidedStates.get('guided'), weights: await database.bodyWeights.toArray(), sessions: await database.sessions.toArray() };
  });
}
async function seedStep(page: Page, step: number, answers: Record<string, unknown> = {}) {
  await expect(page.getByRole('heading', { name: /你的生理性别是|What is your biological sex/ })).toBeVisible();
  await expect(page.locator('.onboarding-flow')).toHaveAttribute('aria-busy', 'false');
  await page.evaluate(async ({ step, answers }) => {
    const path = '/src/persistence/db.ts'; const { database } = await import(/* @vite-ignore */ path);
    await database.guidedStates.update('guided', { onboarding: { id: crypto.randomUUID(), step, answers, completed: false, updatedAt: new Date().toISOString() } });
  }, { step, answers });
}
for (const locale of ['zh', 'en'] as const) {
  test(`${locale}: tap-first answers, partial availability, safety unknown and summary survive reload`, async ({ page }, info) => {
    const t = (zh: string, en: string) => locale === 'zh' ? zh : en;
    await page.addInitScript(language => localStorage.setItem('fitness.language', language), locale);
    await page.goto('/');
    const next = () => page.getByRole('button', { name: t('确认并继续', 'confirm and continue'), exact: true }).click();
    const skip = () => page.getByRole('button', { name: t('跳过', 'skip'), exact: true }).click();
    await skip();
    await expect(page.getByRole('button', { name: t('跳过', 'skip'), exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: t('确认并继续', 'confirm and continue'), exact: true })).toBeDisabled();
    await page.getByRole('button', { name: t('不愿透露', 'Prefer not to say'), exact: true }).click(); await next(); await skip();
    await expect(page.getByRole('heading', { name: t('你现在的体重是多少？', 'what is your current weight?') })).toBeVisible();
    await page.getByRole('button', { name: /填写数值|Choose a value/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/准确数值|Exact value/).fill('301');
    await expect(dialog.getByRole('button', { name: /确认选择|Confirm selection/ })).toBeDisabled();
    await dialog.getByLabel(/准确数值|Exact value/).fill('82.5');
    await dialog.getByRole('button', { name: /确认选择|Confirm selection/ }).click();
    expect((await state(page)).guided.onboarding.answers.weightKg).toBeUndefined();
    await next();
    expect((await state(page)).guided.onboarding.answers.weightKg).toEqual({ status: 'answered', value: 82.5 });
    expect((await state(page)).weights).toEqual([]);
    await skip(); await skip();
    await page.getByRole('button', { name: t('提升力量', 'Get stronger'), exact: true }).click();
    await page.getByRole('button', { name: t('改善耐力', 'Build endurance'), exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: t('确认并继续', 'confirm and continue'), exact: true })).toBeEnabled();
    await page.screenshot({ path: info.outputPath(`goal-${locale}-390.png`), fullPage: true, animations: 'disabled' });
    await next(); await skip(); await skip();
    await page.getByRole('button', { name: t('无器械（徒手）', 'No equipment'), exact: true }).click();
    await page.getByRole('button', { name: t('哑铃', 'Dumbbells'), exact: true }).click();
    await expect(page.getByRole('button', { name: t('无器械（徒手）', 'No equipment'), exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: t('无器械（徒手）', 'No equipment'), exact: true }).click();
    await next();
    expect((await state(page)).guided.onboarding.answers.equipment).toEqual({ status: 'answered', value: ['徒手'] });
    await page.getByRole('button', { name: t('每周3天', '3 days / week'), exact: true }).click(); await next();
    await expect(page.getByRole('heading', { name: t('每次大概能留出多久？', 'How long feels workable?') })).toBeVisible();
    await expect(page.locator('.onboarding-flow')).toHaveAttribute('aria-busy', 'false');
    await page.reload();
    await expect(page.getByRole('heading', { name: t('每次大概能留出多久？', 'How long feels workable?') })).toBeVisible();
    await page.getByRole('button', { name: t('每次30分钟', '30 minutes'), exact: true }).click(); await next();
    await page.getByRole('button', { name: t('返回', 'back'), exact: true }).click(); await skip();
    expect((await state(page)).guided.onboarding.answers.time).toEqual({ status: 'answered', value: ['每周3天'] });
    await page.getByRole('button', { name: t('没有特别偏好', 'No particular preference'), exact: true }).click(); await next(); await skip();
    await skip();
    await expect(page.getByRole('heading', { name: t('这些，是你的出发点。', 'Your starting point.') })).toBeVisible();
    const saved = await state(page);
    expect(saved.guided.onboarding.answers.safety).toEqual({ status: 'skipped' });
    expect(saved.guided.onboarding.answers.preferences).toEqual({ status: 'answered', value: ['没有特别偏好'] });
    expect(saved.guided.onboarding.completed).toBe(false);
    expect(saved.sessions).toEqual([]);
    await page.reload();
    await expect(page.getByRole('heading', { name: t('这些，是你的出发点。', 'Your starting point.') })).toBeVisible();
    await expect(page.locator('.onboarding-summary')).not.toContainText(t('没有已知限制', 'No known restrictions'));
    await page.getByRole('button', { name: t('与 AI 一起制定计划', 'Plan together with AI'), exact: true }).click();
    await expect(page).toHaveURL(/\/ai$/);
    expect((await state(page)).guided.onboarding.completed).toBe(true);
  });
}

test('restriction detail, failed writes, custom text and offline voice fallback preserve facts', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'zh'));
  await page.goto('/');
  await page.getByRole('button', { name: '跳过', exact: true }).click();
  await seedStep(page, 11);
  await page.getByRole('button', { name: '有，需要说明', exact: true }).click();
  await page.getByRole('button', { name: '确认并继续', exact: true }).click();
  await expect(page.getByRole('heading', { name: '训练时，需要注意什么？' })).toBeVisible();
  await page.getByRole('button', { name: '说明必要的限制' }).click();
  await page.getByRole('dialog').getByLabel('用自己的话说').fill('避免膝关节冲击');
  await page.context().setOffline(true);
  await page.getByRole('button', { name: '语音转写', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('请输入文字');
  await page.getByRole('button', { name: '确认选择', exact: true }).click();
  await page.context().setOffline(false);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (this.name === 'guidedStates') { IDBObjectStore.prototype.put = original; throw new DOMException('Synthetic quota failure', 'QuotaExceededError'); }
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '确认并继续', exact: true }).click();
  await expect(page.locator('.onboarding-flow [role=alert]')).toContainText('未能保存');
  await expect(page.getByRole('heading', { name: '训练时，需要注意什么？' })).toBeVisible();
  await expect(page.locator('.onboarding-custom-answer')).toContainText('避免膝关节冲击');
  expect((await state(page)).guided.onboarding.answers.safety).toEqual({ status: 'answered', value: '有，需要说明' });
  await page.getByRole('button', { name: '确认并继续', exact: true }).click();
  await expect(page.getByRole('heading', { name: '这些，是你的出发点。' })).toBeVisible();
  expect((await state(page)).guided.onboarding.answers.safety.value).toBe('有，需要说明：避免膝关节冲击');
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: '确认并继续', exact: true }).click();
  await expect(page.locator('.onboarding-custom-answer')).toContainText('避免膝关节冲击');
  for (const width of [320, 375, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`safety-${width}.png`), fullPage: true, animations: 'disabled' });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.onboarding-question').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.getByRole('button', { name: '跳过', exact: true }).click();
  expect((await state(page)).guided.onboarding.answers.safety.value).toBe('有，需要说明');
});

test('speech requires consent, only fills editable text, and stops on dismiss', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fitness.language', 'en');
    const target = window as unknown as Record<string, unknown>;
    target.speechStarts = 0; target.speechAborts = 0;
    target.SpeechRecognition = class {
      lang = ''; continuous = false; interimResults = false;
      onresult?: (event: unknown) => void; onend?: () => void;
      start() { target.speechStarts = Number(target.speechStarts) + 1; this.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Build a sustainable routine' } }] }); }
      stop() { this.onend?.(); }
      abort() { target.speechAborts = Number(target.speechAborts) + 1; }
    };
  });
  await page.goto('/'); await page.getByRole('button', { name: 'skip', exact: true }).click(); await seedStep(page, 5);
  await page.getByRole('button', { name: 'Something else / add detail', exact: true }).click();
  await page.getByRole('button', { name: 'Voice input', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).speechStarts)).toBe(0);
  await page.getByRole('button', { name: 'Agree and start voice', exact: true }).click();
  await expect(page.getByLabel('In your own words')).toHaveValue('Build a sustainable routine');
  expect((await state(page)).guided.onboarding.answers.goal).toBeUndefined();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).speechAborts)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'confirm and continue', exact: true })).toBeDisabled();
});

test('layout: picker stays reachable above sticky actions at mobile widths, with keyboard dismissal', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'zh'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const width of [320, 375, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: width === 320 ? 700 : 844 });
    const choice = page.locator('.onboarding-numeric-choice');
    await expect(choice).toBeVisible();
    const bounds = await choice.boundingBox();
    const footer = await page.locator('.onboarding-bottom').boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(footer!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`onboarding-${width}.png`), animations: 'disabled' });
    await choice.click();
    await expect(page.getByRole('dialog').getByLabel('准确数值')).toBeFocused();
    await page.screenshot({ path: info.outputPath(`picker-${width}.png`), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(choice).toBeFocused();
  }
});


test('biological sex privacy: understanding excludes it; planning requires renewed explicit body consent', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'en'));
  await page.goto('/');
  await page.locator('.onboarding-flow').waitFor();
  await page.evaluate(async () => {
    const path = '/src/application/guided.ts';
    const { guidedService: service } = await import(/* @vite-ignore */ path);
    const before = await service.read();
    let blocked = false;
    try { await service.completeOnboarding(before.revision); } catch { blocked = true; }
    if (!blocked || JSON.stringify(await service.read()) !== JSON.stringify(before)) throw Error('Missing answer must not complete or modify state');
    await service.saveAnswer('biologicalSex', { status: 'answered', value: '女性' }, 16, before.revision);
  });
  await page.getByRole('button', { name: 'view your dashboard first' }).click();
  await page.getByRole('button', { name: 'discuss your plan' }).click();
  await page.getByLabel('goal, clarification or changes', { exact: true }).fill('Build a regular routine');
  await page.getByRole('button', { name: 'preview scope for understanding', exact: true }).click();
  const scope = page.locator('section').filter({ has: page.getByRole('heading', { name: 'sending scope', exact: true }) });
  await expect(scope.locator('pre')).not.toContainText('biologicalSex');
  await scope.getByRole('button', { name: 'confirm sending', exact: true }).click();
  await page.getByText('review the goal and exact dates', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'goal interpretation', exact: true })).toHaveValue('Build a regular routine');
  const date = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  await page.getByLabel('start date', { exact: true }).fill(date);
  await page.getByLabel('end date', { exact: true }).fill(date);
  await page.getByRole('button', { name: date, exact: true }).click();
  await page.getByRole('button', { name: 'confirm interpretation', exact: true }).click();
  await page.getByRole('button', { name: 'preview sending scope', exact: true }).click();
  await expect(scope.locator('pre')).not.toContainText('biologicalSex');
  await page.getByLabel('include supplied body information this time', { exact: true }).check();
  await expect(page.getByRole('button', { name: 'preview sending scope', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'confirm interpretation', exact: true }).click();
  await page.getByRole('button', { name: 'preview sending scope', exact: true }).click();
  await expect(scope.locator('pre')).toContainText('biologicalSex');
  await expect(scope.locator('pre')).toContainText('女性');
});
