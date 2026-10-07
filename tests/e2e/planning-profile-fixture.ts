import type { Page } from '@playwright/test';

/** Transport tests start after the separately tested profile onboarding flow. */
export async function completedPlanningProfile(page: Page) {
  await page.goto('/settings');
  await page.evaluate(async () => {
    const profilePath = '/src/application/profile.ts', guidedPath = '/src/application/guided.ts';
    const { profileService } = await import(/* @vite-ignore */ profilePath);
    const { guidedService } = await import(/* @vite-ignore */ guidedPath);
    await profileService.initialize('en');
    await guidedService.saveAnswer('biologicalSex', { status: 'answered', value: '不愿透露' }, 1, (await guidedService.read()).revision);
    await guidedService.completeOnboarding((await guidedService.read()).revision);
  });
}
