import type { Page } from '@playwright/test';

/** Seed retained legacy data through its service; the manual creation UI is retired. */
export async function seedLegacyPlan(page: Page, name: string, status: 'active' | 'draft' = 'active') {
  return page.evaluate(async ({ name, status }) => {
    const { profileService } = await import(String('/src/application/profile.ts'));
    const { planService } = await import(String('/src/application/plans.ts'));
    await profileService.initialize('en');
    return planService.savePlan({ name, status, source: 'manual', startDate: '2026-10-05',
      scheduleTimeZone: 'UTC', goalSnapshot: { goal: '' }, durationWeeks: 1, daysPerWeek: 1,
      days: [{ dayId: crypto.randomUUID(), weekIndex: 1, dayOfWeek: 1, exercises: [{
        exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0,
        targetSets: [{ metricType: 'reps', reps: 10 }],
      }] }],
    });
  }, { name, status });
}
