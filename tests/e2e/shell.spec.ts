import { test, expect } from '@playwright/test';

test('five destinations stay usable without overflow at 320px', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation');
  await expect(navigation.getByRole('link')).toHaveCount(5);
  for (const name of ['Today', 'Plans', 'Exercises', 'Progress', 'Settings']) {
    await navigation.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.reload();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
});

test('all navigation destinations can be reached with the keyboard', async ({ page }) => {
  await page.goto('/');
  const reached = new Set<string>();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const destination = await page.evaluate(() => document.activeElement?.closest('nav') ? document.activeElement?.textContent : null);
    if (destination) reached.add(destination);
  }
  expect([...reached].sort()).toEqual(['Exercises', 'Plans', 'Progress', 'Settings', 'Today']);
});

test('switching languages persists across refresh in either direction', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('zh');
  await expect(page.getByRole('heading', { name: '今日' })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
  await expect(page.getByRole('heading', { name: '今日' })).toBeVisible();
  await page.getByRole('combobox', { name: '语言' }).selectOption('en');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});

test('an unsupported saved language falls back to English', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'xx'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

