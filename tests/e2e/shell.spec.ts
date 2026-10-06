import { test, expect } from '@playwright/test';

test('five destinations stay usable without overflow at 320px', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'view your dashboard first' }).click();
  await page.getByRole('button', { name: 'menu', exact: true }).click();
  const navigation = page.getByRole('navigation').first();
  await expect(navigation.getByRole('link')).toHaveCount(5);
  for (const name of ['Today', 'Plans', 'Exercises', 'Progress', 'Settings']) {
    const dashboard = page.getByRole('button', { name: 'view your dashboard first' });
    if (new URL(page.url()).pathname === '/') {
      await dashboard.or(page.getByRole('region', { name: 'training analytics', exact: true })).waitFor();
      if (await dashboard.isVisible()) await dashboard.click();
    }
    const menu = page.getByRole('button', { name: 'menu', exact: true });
    if (await menu.getAttribute('aria-expanded') === 'false') await menu.click();
    const heading = name === 'Today' ? 'let’s start with you.' : name;
    await navigation.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('main')).toBeVisible();
    const layout = await page.evaluate(() => ({
      path: location.pathname,
      viewport: window.innerWidth,
      width: document.documentElement.scrollWidth,
      overflowing: Array.from(document.querySelectorAll('body *')).flatMap(element => {
        const rect = element.getBoundingClientRect();
        if (rect.right <= window.innerWidth || !rect.width) return [];
        const style = getComputedStyle(element);
        return [{ tag: element.tagName, className: element.className, type: element.getAttribute('type'),
          text: element.textContent?.trim().slice(0, 80), left: rect.left, right: rect.right,
          width: rect.width, minWidth: style.minWidth, maxWidth: style.maxWidth, font: style.font }];
      }),
    }));
    expect(layout.width <= layout.viewport, JSON.stringify(layout)).toBe(true);
    await page.reload();
    await expect(page.getByRole('main')).toBeVisible();
  }
});

test('all navigation destinations can be reached with the keyboard', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'view your dashboard first' }).click();
  await page.getByRole('button', { name: 'menu', exact: true }).click();
  await expect(page.getByRole('navigation').first().getByRole('link')).toHaveCount(5);
  await expect(page.getByRole('navigation').first().getByRole('link', {name:'Settings',exact:true})).toBeVisible();
  const reached = new Set<string>();
  await page.getByRole('navigation').first().getByRole('link').first().focus();
  for (let i = 0; i < 5; i++) {
    const destination = await page.evaluate(() => document.activeElement?.closest('nav') === document.querySelector('.app-sidebar nav') ? document.activeElement?.textContent : null);
    if (destination) reached.add(destination);
    await page.keyboard.press('Tab');
  }
  expect([...reached].sort()).toEqual(['Exercises', 'Plans', 'Progress', 'Settings', 'Today']);
});

test('switching languages persists across refresh in either direction', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('zh');
  await expect(page.getByRole('heading', { name: '从了解你开始。' })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
  await expect(page.getByRole('heading', { name: '从了解你开始。' })).toBeVisible();
  await page.getByRole('combobox', { name: '语言' }).selectOption('en');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'let’s start with you.' })).toBeVisible();
});

test('an unsupported saved language falls back to English', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'xx'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'let’s start with you.' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

