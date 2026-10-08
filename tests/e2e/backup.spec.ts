import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US' });
test.setTimeout(30_000);

test('whole-store restore preserves facts, rebuilds memo, rejects invalid data, and rolls back failures', async ({ page }) => {
  await page.goto('/settings?tab=profile');
  const result = await page.evaluate(async () => {
    const path = '/tests/e2e/helpers/backup-browser.ts';
    return (await import(/* @vite-ignore */ path)).verifyBackup(`backup-${crypto.randomUUID()}`);
  });
  expect(result).toEqual({ restored: true, memoRebuilt: true, notesPreserved: true, invalidRejected: true, confirmations: true, stalePreview: true, rollback: true, staleWriter: true, monotonic: true });
});

test('manual JSON download and File restore work across distinct origins', async ({ page, context }) => {
  await page.goto('/settings?tab=profile');
  await page.getByLabel('Goal', { exact: true }).fill('Portable facts');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved');
  await page.getByRole('tab',{name:'Backup & restore',exact:true}).click();
  await expect(page.getByRole('button', { name: 'Export JSON backup', exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON backup', exact: true }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  if (!filePath) throw new Error('Downloaded backup is missing');
  const other = await context.newPage();
  await other.goto(new URL('/settings?tab=profile',page.url().replace('127.0.0.1','localhost')).href);
  await expect(other.getByLabel('Goal', { exact: true })).toHaveValue('');
  const sibling = await context.newPage();
  await sibling.addInitScript(() => { Object.defineProperty(window, 'BroadcastChannel', { value: undefined }); });
  await sibling.goto(new URL('/settings?tab=profile',page.url().replace('127.0.0.1','localhost')).href);
  await sibling.getByLabel('Goal', { exact: true }).fill('Unsaved stale form');
  await other.getByRole('tab',{name:'Backup & restore',exact:true}).click();
  await other.getByLabel('Restore JSON file', { exact: true }).setInputFiles(filePath);
  await expect(other.getByText('Backup validated, including its data references.', { exact: true })).toBeVisible();
  await expect(other.getByRole('button', { name: 'Replace local data', exact: true, includeHidden: true })).toBeDisabled();
  await other.getByRole('button',{name:'Next: keep current data',exact:true}).click();
  const previousDownload = other.waitForEvent('download');
  await other.getByRole('button', { name: 'Download current data before replacement', exact: true }).click();
  await previousDownload;
  await other.getByLabel('I have downloaded and kept the current backup', { exact: true }).check();
  await other.getByRole('button',{name:'Next: confirm replacement',exact:true}).click();
  await other.getByLabel('I confirm replacing all local data', { exact: true }).check();
  await other.getByRole('button', { name: 'Replace local data', exact: true, includeHidden: true }).click();
  await expect(other.getByTestId('restore-result')).toHaveText('Restore succeeded.');
  await other.getByRole('tab',{name:'Profile & preferences',exact:true}).click();
  await expect(other.getByLabel('Goal', { exact: true })).toHaveValue('Portable facts');
  await expect(sibling.getByLabel('Goal', { exact: true })).toHaveValue('Portable facts');
});
