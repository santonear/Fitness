import { expect, type Page } from '@playwright/test';

/** Opt in only for scenarios that explicitly exercise an AI request. */
export async function mockActiveCoachAccess(page: Page) {
  await page.route('**/api/v1/trial/access-status', async route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({});
    await route.fulfill({
      json: {
        qualification: 'active',
        sessionValid: true,
        expiresAt: Date.now() + 60_000,
        aiEnabled: true,
        summaryAvailable: true,
      },
    });
  });
}
