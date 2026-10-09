import { expect } from '@playwright/test';

export async function enterMixedData(page, base, version) {
  await page.goto(`${base}/plans`);
  await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
  const calendar = page.getByRole('tabpanel', { name: 'Calendar', exact: true });
  await calendar.getByRole('button', { name: '+ Arrange training', exact: true }).click();
  const dates = await calendar.locator('[data-plan-date]:not(.outside-month)').evaluateAll(nodes => [nodes[0], nodes[1], nodes.at(-1)].map(node => node.getAttribute('data-plan-date')));
  for (const date of dates) await calendar.locator(`[data-plan-date="${date}"]`).click();
  await calendar.getByRole('button', { name: 'Create for these dates', exact: true }).click();
  for (const [index, date] of dates.entries()) {
    const day = page.getByRole('group', { name: date, exact: true });
    await day.getByLabel('Plan name', { exact: true }).fill(`Synthetic ${index ? 'future' : 'past'} plan`);
    await day.getByLabel('Start time', { exact: true }).fill('14:00');
    await day.getByLabel('Duration (minutes)', { exact: true }).fill('30');
    await day.getByLabel('Exercise notes (optional)').fill('Synthetic preserved instruction');
    await day.getByRole('button', { name: '+ Add set', exact: true }).click();
  }
  await page.getByRole('checkbox', { name: /I reviewed the times/ }).check();
  await page.getByRole('button', { name: 'Confirm and save all dates', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved 3 independent day plans.');
  await page.goto(`${base}/settings?tab=profile`);
  await page.getByLabel('Observation date').fill(dates[0]);
  await page.getByLabel('Observed weight (kg)').fill('70.2');
  await page.getByRole('button', { name: 'Save weight', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Weight saved');
  for (const recordedSets of [2, 1]) {
    await page.goto(`${base}/workout`);
    await page.getByRole('button', { name: 'Start planned workout', exact: true }).first().click();
    for (let index = 0; index < recordedSets; index++) {
      await page.getByLabel('Reps', { exact: true }).last().fill('10');
      await page.getByLabel('Set notes', { exact: true }).last().fill(`Synthetic actual set ${index + 1}`);
      await page.getByRole('button', { name: 'Record set', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('Set saved');
    }
    await page.getByRole('button', { name: 'Review completion', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm completion', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: /^Workout completed$/ })).toBeVisible();
  }
  if (version !== 'v5') {
    await page.goto(`${base}/settings?tab=appearance`);
    await page.getByRole('combobox', { name: 'Daily maximum' }).selectOption('0');
    await page.getByLabel('Quiet hours start').fill('21:30');
    await page.getByLabel('Quiet hours end').fill('09:00');
    await page.getByRole('button', { name: 'Save reminder preferences' }).click();
    await expect(page.getByText('Reminder preferences saved', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Daily maximum' })).toHaveValue('0');
  }
  await page.goto(`${base}/settings?tab=backup`);
  await page.getByRole('tab', { name: 'Backup & restore', exact: true }).click();
}
