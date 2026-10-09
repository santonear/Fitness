import { test, expect } from '@playwright/test';
import { completedPlanningProfile } from './planning-profile-fixture';

test('an obsolete asynchronous open must not reopen the coach after navigation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'en'));
  await completedPlanningProfile(page);
  await page.goto('/plans');
  await page.evaluate(async () => {
    const modulePath = '/src/application/guided.ts';
    const { guidedService } = await import(modulePath);
    const original = guidedService.onboardingEntry.bind(guidedService);
    guidedService.onboardingEntry = async () => {
      await new Promise<void>(resolve => window.addEventListener('test:release-entry', () => resolve(), { once: true }));
      const result = await original();
      setTimeout(() => document.body.setAttribute('data-entry-settled', 'true'), 100);
      return result;
    };
  });
  await page.getByRole('button', { name: 'Open AI coach', exact: true }).click();
  await page.locator('.v31-mobile-nav a[href="/progress"]').click();
  await expect(page).toHaveURL(/progress/);
  await page.evaluate(() => window.dispatchEvent(new Event('test:release-entry')));
  await expect(page.locator('body')).toHaveAttribute('data-entry-settled', 'true');
  await expect(page.getByRole('dialog', { name: 'AI coach conversation' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open AI coach', exact: true })).toBeVisible();
});

test('/ai close remains closed and can reopen with its unsent input', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'en'));
  await completedPlanningProfile(page);
  await page.goto('/ai');
  const dialog = page.getByRole('dialog', { name: 'AI coach conversation' });
  await expect(dialog).toBeVisible();
  await page.getByRole('textbox', { name: 'Reply to your coach' }).fill('Keep this unsent reply');
  await page.getByRole('button', { name: 'Close coach conversation' }).click();
  const launcher = page.getByRole('button', { name: 'Open AI coach', exact: true });
  await expect(launcher).toBeVisible();
  const box = await launcher.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.coach-scrim')).toBeHidden();
  await expect(page.locator('main')).not.toHaveAttribute('inert');
  await launcher.click();
  await expect(page.getByRole('textbox', { name: 'Reply to your coach' })).toHaveValue('Keep this unsent reply');
});
