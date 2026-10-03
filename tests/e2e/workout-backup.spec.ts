import { expect, test } from '@playwright/test';

for (const kind of ['timers', 'order', 'skip'] as const) {
  test(`workout ${kind} adjustments preserve export and restore invariants`, async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async selected => {
      const path = '/tests/e2e/helpers/workout-backup-browser.ts';
      return (await import(/* @vite-ignore */ path)).verifyWorkoutBackup(selected);
    }, kind);
    expect(result).toEqual({ invariant: true, roundTrip: true });
  });
}
