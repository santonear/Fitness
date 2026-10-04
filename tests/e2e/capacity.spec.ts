import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
// Large JSON is recorded as file + measurements, not duplicated into browser traces.
test.use({ trace: 'off' });

test.beforeEach(async ({ page }) => { await page.goto('/tests/e2e/helpers/capacity-entry.html'); });
test.afterEach(async ({ page }) => {
  await page.evaluate(async () => { const path = '/tests/e2e/helpers/capacity-browser.ts'; const helper = await import(/* @vite-ignore */ path) as typeof import('./helpers/capacity-browser'); await helper.cleanupCapacity(); });
});
for (const kind of ['small', '5MiB', '6MiB', '8MiB', '10000'] as const) {
  test(`capacity ${kind}: actual export outcome and retained facts`, async ({ page }, testInfo) => {
    // Prior WebKit fixture population took ~2.6 min; this test adds another
    // full IndexedDB restore. This is a correctness budget, not a latency SLA.
    if (kind === '10000') test.setTimeout(600_000);
    const result = await page.evaluate(async kind => {
      const path = '/tests/e2e/helpers/capacity-browser.ts'; const helper = await import(/* @vite-ignore */ path) as typeof import('./helpers/capacity-browser'); return helper.prepareCapacity(kind);
    }, kind);
    await testInfo.attach('measurement', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    console.log(`${testInfo.project.name}/${kind}: export ${result.formattedBytes} bytes`);
    expect(result.formattedBytes).toBeGreaterThan(result.compactBytes);
    expect(result.libraryUnchanged).toBe(true);
    expect(result.exportResult).toBe(result.formattedBytes > result.limit ? 'BACKUP_TOO_LARGE' : 'accepted');
    expect(result.exportResult).toBe(kind === '8MiB' ? 'BACKUP_TOO_LARGE' : 'accepted');
    if (result.exportResult === 'accepted') {
      const downloadPromise = page.waitForEvent('download'); await page.locator('#g1-download').click();
      const download = await downloadPromise; const path = testInfo.outputPath('actual-backup.json'); await download.saveAs(path);
      const text = await readFile(path, 'utf8'); expect(Buffer.byteLength(text)).toBeLessThanOrEqual(result.limit);
      console.log(`${testInfo.project.name}/${kind}: actual download read`);
      const restored = await page.evaluate(async text => {
        const path = '/tests/e2e/helpers/capacity-browser.ts'; const helper = await import(/* @vite-ignore */ path) as typeof import('./helpers/capacity-browser'); return helper.restoreDownloaded(text);
      }, text);
      expect(restored.factsEqual).toBe(true); expect(restored.sets).toBe(result.sets);
      console.log(`${testInfo.project.name}/${kind}: restored and fields matched`);
      await testInfo.attach('restore-measurement', { body: JSON.stringify(restored), contentType: 'application/json' });
    }
    if (kind === '6MiB') {
      const blocked = await page.evaluate(async () => { const path = '/tests/e2e/helpers/capacity-browser.ts'; const helper = await import(/* @vite-ignore */ path) as typeof import('./helpers/capacity-browser'); return helper.largeCurrentBlocksSmallRestore(); });
      expect(blocked).toEqual({ exportResult: 'accepted', replaceResult: 'BACKUP_CONFIRMATION_REQUIRED', sets: 1, noteBytes: 6 * 1024 * 1024, libraryUnchanged: true });
      const replacement = await page.evaluate(async () => { const path = '/tests/e2e/helpers/capacity-browser.ts'; return (await import(/* @vite-ignore */ path)).replaceLargeWithSmall(); });
      expect(replacement).toEqual({ sets: 0, sessions: 0 });
    }
  });
}
test('current raw UTF-8 file boundary is exact', async ({ page }) => {
  const result = await page.evaluate(async () => { const path = '/tests/e2e/helpers/capacity-browser.ts'; const helper = await import(/* @vite-ignore */ path) as typeof import('./helpers/capacity-browser'); return helper.boundaryChecks(); });
  expect(result.map(row => row.result)).toEqual(['accepted', 'accepted', 'BACKUP_TOO_LARGE']);
});
test('post-backup writes invalidate replacement without changing any current table', async ({ page }) => {
  const result = await page.evaluate(async () => { const path = '/tests/e2e/helpers/capacity-browser.ts'; return (await import(/* @vite-ignore */ path)).staleExportConfirmation(); });
  expect(result).toEqual({ result: 'CONFLICT', unchanged: true, receiptStale: true });
});
test('loaded local backup downloads and restores with HTTP blocked', async ({ page }) => {
  await page.evaluate(async () => { const path = '/tests/e2e/helpers/capacity-browser.ts'; await (await import(/* @vite-ignore */ path)).prepareCapacity('small'); });
  await page.route('http://**/*', route => route.abort());
  const promise = page.waitForEvent('download'); await page.locator('#g1-download').click();
  const downloaded = await promise; const file = await downloaded.path();
  if (!file) throw new Error('Missing downloaded file');
  const text = await readFile(file, 'utf8');
  const result = await page.evaluate(async text => { const path = '/tests/e2e/helpers/capacity-browser.ts'; return (await import(/* @vite-ignore */ path)).restoreDownloaded(text); }, text);
  expect(result.factsEqual).toBe(true);
  await page.unroute('http://**/*');
});
