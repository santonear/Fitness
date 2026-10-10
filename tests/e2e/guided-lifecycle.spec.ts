import { expect, test } from '@playwright/test';

async function scenario(page: import('@playwright/test').Page, kind: string) {
  await page.goto('/');
  return page.evaluate(async kind => {
    const path = '/tests/e2e/guided-lifecycle-browser.ts';
    await import(/* @vite-ignore */ path);
    return window.guidedScenario(kind);
  }, kind);
}

test('changed onboarding invalidates unadopted candidate and preserves unknown health', async ({ page }) => {
  expect(await scenario(page, 'answers')).toEqual({ rejected: true, programs: 0, answered: { age: { status: 'skipped' }, goal: { status: 'answered', value: 'changed' } } });
});
test('paused phase prevents starting its training and can resume offline', async ({ page }) => {
  expect(await scenario(page, 'pause')).toEqual({ rejected: true, available: 0, resumed: 'in_progress', tasks: ['2099-01-01', '2099-01-03'] });
});
test('invalid multi-day adoption rolls back termination and inserted days', async ({ page }) => {
  expect(await scenario(page, 'rollback')).toEqual({ failed: true, preserved: true, count: 2, current: 'active' });
});
test('paused training blocks set writes and resumes without generating completion facts', async ({ page }) => {
  expect(await scenario(page, 'workout')).toEqual({ rejected: true, sets: 1, session: 'completed', events: ['created', 'workout_paused', 'workout_resumed', 'workout_ended'] });
});
test('phase replacement retains ongoing training and complete backup', async ({ page }) => {
  expect(await scenario(page, 'replace')).toEqual({ old: 'terminated', sessionUnchanged: true, denied: true, sets: 1, backup: 7 });
});
test('guided history reuses bounded read-only snapshot and ignores unrelated local changes', async ({ page }) => {
  expect(await scenario(page, 'history')).toEqual({ readOnly: true, same: true, bounded: true, limitReadOnly: true, sessions: 1, sets: 1, status: 'in_progress', localAnswersExcluded: true });
});
test('managed child plan deletion is refused and restored candidates cannot be adopted', async ({ page }) => {
  expect(await scenario(page, 'protected')).toEqual({ deleteDenied: true, planPreserved: true, editCode: 'CONFLICT', dayPreserved: true, backup: 7, staleCandidateDenied: true, generation: 1, programs: 1 });
});
test('foreign occupancy prevents phase resume and leaves paused state unchanged', async ({ page }) => {
  expect(await scenario(page, 'collision')).toEqual({ conflictCode: 'CONFLICT', preserved: true, status: 'paused', foreign: 'active' });
});
