import { expect, test } from '@playwright/test';
for (const reducedMotion of ['reduce', 'no-preference'] as const)
  test(`manual and training dialogs return focus to their real triggers (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    // Reproduce browsers/input modes where clicking a button does not move keyboard focus.
    await page.addInitScript(() =>
      document.addEventListener(
        'mousedown',
        event => {
          if ((event.target as Element).closest('button')) event.preventDefault();
        },
        true,
      ),
    );
    await page.goto('/manual');
    await page.getByRole('searchbox').fill('臀桥');
    const card = page.locator('.manual-card').filter({ has: page.getByRole('button', { name: '臀桥', exact: true }) });
    await expect(card).toContainText('臀部');
    await expect(card).not.toContainText('大腿');
    const detail = card.getByRole('button', { name: '动作提示', exact: true });
    await detail.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(detail).toBeFocused();
    await expect(detail).toHaveCSS('visibility', 'visible');
    await detail.click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(detail).toBeFocused();
    await card.getByRole('button', { name: '臀桥', exact: true }).click();
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await expect(page).toHaveURL(/\/workout\//);
    for (const name of ['查看动作指导', '暂停或结束', '修改数值', '换动作']) {
      const trigger = page.getByRole('button', { name, exact: true });
      await trigger.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveCSS('visibility', 'visible');
    }
  });
