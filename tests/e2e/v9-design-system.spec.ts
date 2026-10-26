import { expect, test } from '@playwright/test';

const gallery = '/tests/fixtures/v9-design-system/index.html';
const v9 = ['pop', 'vivid', 'gentle', 'data', 'fire'];

test('retired V8 preferences open in their V9 successor and are rewritten once', async ({ page }) => {
  for (const [stored, expected] of [
    ['qingci', 'pop'],
    ['liubai', 'gentle'],
    ['jingshe', 'data'],
    ['zhuangse', 'fire'],
    ['atlas-x', 'pop'],
  ]) {
    await page.goto(gallery);
    await page.evaluate(value => localStorage.setItem('fitness-theme', value), stored);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', expected);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('fitness-theme'))).toBe(expected);
  }
});

for (const theme of v9)
  test(`${theme}: tokens, mascot images and slots render at 390`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(gallery);
    await page.getByLabel('主题').selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const images = page.locator('.v9-yaya img');
    await expect(images.first()).toHaveAttribute('src', new RegExp(`-${theme}\\.webp$`));
    await expect
      .poll(() =>
        images.evaluateAll(list =>
          list.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0),
        ),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: '开始训练' }).click();
    await expect(page.locator('output')).toHaveText('开始');
    await expect(page.locator('.v8-rest time')).toHaveText('2:05');
    await expect(page.getByRole('timer', { name: '剩余时间' })).toHaveText('0:42');
  });

test('theme picker shows five live previews and switches immediately', async ({ page }) => {
  await page.goto(`${gallery}?section=mascot`);
  const picker = page.getByRole('radiogroup', { name: '界面风格' });
  await expect(picker.getByRole('radio')).toHaveCount(5);
  for (const theme of v9) await expect(picker.locator(`.v9-theme-preview[data-theme="${theme}"]`)).toHaveCount(1);
  await picker.getByRole('radio', { name: '专业数据' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'data');
  await expect(picker.getByRole('radio', { name: '专业数据' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'fire');
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.querySelector('.v9-theme-preview[data-theme="gentle"]')!)
        .getPropertyValue('--c-bg')
        .trim(),
    ),
  ).toBe('#F3F7EC');
});

test('orb drags vertically, snaps to the nearer side, tucks and opens chat with a quick prompt', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${gallery}?section=mascot`);
  const orb = page.getByRole('button', { name: '芽芽助手，按住可上下拖动' });
  // The tip only shows over empty space: never on top of a picture (Bo 2026-10-26).
  await page.waitForTimeout(1500);
  expect(
    await page.evaluate(() => {
      const tip = document.querySelector('.v9-orb-tip')?.getBoundingClientRect();
      if (!tip) return false;
      return [...document.querySelectorAll('svg, img, canvas, [role="img"]')]
        .filter(element => !element.closest('.v9-orb'))
        .map(element => element.getBoundingClientRect())
        .some(r => r.width > 0 && tip.left < r.right && tip.right > r.left && tip.top < r.bottom && tip.bottom > r.top);
    }),
  ).toBe(false);
  const start = (await orb.boundingBox())!;
  // Over the gallery pictures the orb waits tucked at the edge (Bo 2026-10-26): grab its visible part.
  await page.mouse.move(Math.min(start.x + start.width / 2, 390 - 8), start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(60, start.y - 150, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.v9-orb')).toHaveAttribute('data-side', 'left');
  const moved = (await orb.boundingBox())!;
  expect(moved.y).toBeLessThan(start.y - 100);
  expect(moved.x).toBeLessThan(40);
  await expect(page.getByRole('dialog', { name: '芽芽快捷助手' })).toHaveCount(0);
  await orb.click();
  const panel = page.getByRole('dialog', { name: '芽芽快捷助手' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: '只有 20 分钟' }).click();
  await expect(page.locator('output')).toHaveText('快捷：只有 20 分钟');
  await orb.click();
  await page.getByRole('button', { name: '打开对话' }).click();
  await expect(page.locator('output')).toHaveText('打开对话');
  await orb.click();
  await page.getByRole('button', { name: '靠边', exact: true }).click();
  await expect(page.locator('.v9-orb')).toHaveAttribute('data-tucked', 'true');
  await orb.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.v9-orb')).toHaveAttribute('data-side', 'right');
});

test('orb never stays on top of a primary button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${gallery}?section=kit`);
  const orb = page.getByRole('button', { name: '芽芽助手，按住可上下拖动' });
  for (const name of ['就用这个计划', '问问芽芽怎么改']) {
    const button = page.getByRole('button', { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await expect
      .poll(async () => {
        const [a, b] = [await orb.boundingBox(), await button.boundingBox()];
        return !!a && !!b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
          ? Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > a.width * 0.5
          : false;
      })
      .toBe(false);
  }
});

test('orb starts tucked without a tip on training and onboarding screens', async ({ page }) => {
  await page.goto(`${gallery}?tuck=1`);
  await expect(page.locator('.v9-orb')).toHaveAttribute('data-tucked', 'true');
  await expect(page.locator('.v9-orb-tip')).toHaveCount(0);
});

test('reduced motion stops mascot float and orb ring', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${gallery}?section=home`);
  await page.getByLabel('主题').selectOption('gentle');
  expect(
    await page
      .locator('.v9-yaya-full')
      .first()
      .evaluate(element => getComputedStyle(element).animationName),
  ).toBe('none');
  expect(await page.locator('.v9-orb-ring').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
});
