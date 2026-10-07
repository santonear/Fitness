import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US' });
test.setTimeout(20000);

test('completed history has read-only details and survives reload', async ({ page }) => {
  await page.goto('/workout');
  await page.getByRole('button', { name: 'Start temporary workout', exact: true }).click();
  await page.getByLabel('Reps').fill('12');
  await page.getByLabel('Load (kg)').fill('2.5');
  await page.getByLabel('Set notes').fill('History evidence');
  await page.getByRole('button', { name: 'Record set', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Set saved');
  await page.getByRole('button', { name: 'Review completion', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm completion', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Workout completed');
  await page.goto('/progress');
  await expect(page.getByText('No tasks due', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View history details', exact: true }).click();
  const detail = page.getByRole('region', { name: 'History details' });
  await expect(detail).toContainText('12 reps · 2.5 kg');
  await expect(detail).toContainText('History evidence');
  await expect(detail.getByRole('button', { name: /Record|Remove|Delete|Edit/ })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'View history details', exact: true }).click();
  await expect(page.getByRole('region', { name: 'History details' })).toContainText('History evidence');
  await page.getByLabel('Category').selectOption('cardio');
  await expect(page.getByText('No completed training in this selection.', { exact: true })).toBeVisible();
  await page.getByLabel('Language').selectOption('zh');
  await expect(page.getByRole('heading', { name: '训练进度', exact: true })).toBeVisible();
});

test('Today exposes a continue link for the persisted ongoing session', async ({ page }) => {
  await page.goto('/workout');
  await page.getByRole('button', { name: 'Start temporary workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review completion', exact: true })).toBeVisible();
  await page.goto('/progress');
  await expect(page.getByText('No completed training in this selection.', { exact: true })).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: 'continue workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review completion', exact: true })).toBeVisible();
});
