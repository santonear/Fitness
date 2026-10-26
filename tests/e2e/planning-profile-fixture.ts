import { expect, type Page } from '@playwright/test';

/** Historical completed profile with no supplied body facts. New onboarding has separate tests. */
export async function completedPlanningProfile(page: Page) {
  await page.goto('/settings');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(async () => {
    const profilePath = '/src/application/profile.ts',
      guidedPath = '/tests/support/legacy/guided.ts',
      repoPath = '/src/persistence/repository.ts';
    const { profileService } = await import(/* @vite-ignore */ profilePath);
    const { guidedService } = await import(/* @vite-ignore */ guidedPath);
    await profileService.initialize(localStorage.getItem('fitness.language') === 'en' ? 'en' : 'zh');
    const { repository } = await import(/* @vite-ignore */ repoPath);
    await repository.write(async () => {
      const state = await guidedService.read();
      await repository.db.guidedStates.put({
        ...state,
        onboarding: {
          id: crypto.randomUUID(),
          step: 0,
          answers: {},
          completed: true,
          updatedAt: new Date().toISOString(),
        },
      });
    });
  });
}
