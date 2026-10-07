import { expect, test } from '@playwright/test';

test('guided JSON roundtrip preserves local decisions, rolls back and upgrades old backup without invented phase', async ({ page }) => {
  await page.goto('/settings');
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/guided-backup-browser.ts';
    return (await import(/* @vite-ignore */ path)).verifyGuidedBackup(`guided-backup-${crypto.randomUUID()}`);
  });
  expect(result).toEqual({ version: 5, preserved: true, staleWriter: true, rollback: true, oldCleared: true, upgraded: true, noInventedProgram: true });
});
