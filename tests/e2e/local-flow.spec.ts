import { seedLegacyPlan } from './helpers/legacy-plan';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test.use({ locale: 'en-US' });
test.setTimeout(60_000);
// Preserve the real IndexedDB contract after retiring the legacy presentation.
test.beforeEach(async({page})=>{await page.goto("/tests/e2e/helpers/capacity-entry.html");});
test('10,000 set records: transaction save p95 stays below the desktop engineering target', async ({ page }, testInfo) => {
  test.slow();
  await page.goto('/tests/e2e/helpers/capacity-entry.html');
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/acceptance-browser.ts';
    return (await import(/* @vite-ignore */ path)).measureSetSave(`performance-${crypto.randomUUID()}`);
  });
  await testInfo.attach('set-save-performance', { body: JSON.stringify({ ...result, platform: process.platform, browser: testInfo.project.name }), contentType: 'application/json' });
  console.log(`PERFORMANCE ${testInfo.project.name} ${JSON.stringify(result)}`);
  expect(result.historyCount).toBe(100);
  expect(result.persistedSets).toBe(10_050);
  expect(result.p95Ms).toBeLessThan(300);
});
test('editing the current plan preserves the original calendar and due classification', async ({ page }) => {
  await page.goto('/tests/e2e/helpers/capacity-entry.html');
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/acceptance-browser.ts';
    return (await import(/* @vite-ignore */ path)).calendarProvenance(`calendar-${crypto.randomUUID()}`);
  });
  expect(result).toEqual({ before: 1, after: 1, startDate: '2026-10-03', scheduleTimeZone: 'Asia/Shanghai', backupValid: true });
});
