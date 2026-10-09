import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { enterMixedData } from './mixed-ui.mjs';

// Run against unmodified, isolated legacy Vite servers. No DB/service writes.
const output = fileURLToPath(new URL('./', import.meta.url));
const versions = [
  ['v5', 'dc76b50', 5291], ['v62', 'e94c59f', 5292], ['v71', '9d2a212', 5293],
];
const browser = await chromium.launch({ headless: true });
const manifest = { kind: 'synthetic-data-entered-through-legacy-ui', modelCalls: 0, generatedAt: new Date().toISOString(), cases: [] };
const servers = [];
try {
  for (const [version, commit, port] of versions) {
    const cwd = resolve(process.cwd(), `../fitness-v8-legacy-${version}`);
    const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd, windowsHide: true, stdio: 'pipe' });
    servers.push(server);
    await new Promise((resolveReady, reject) => {
      server.stdout.on('data', data => { if (data.toString().includes('Local:')) resolveReady(); });
      server.on('exit', code => reject(Error(`Server exited ${code}`)));
      server.on('error', reject);
    });
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('fitness.language', 'en'));
    await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'OFFLINE_FIXTURE' } }));
    const base = `http://127.0.0.1:${port}`;
    await page.goto(base);
    await page.getByRole('button', { name: 'Female', exact: true }).click();
    await page.getByRole('button', { name: 'Next →', exact: true }).click();
    await page.getByRole('spinbutton').press('Home');
    await page.getByRole('spinbutton').press('ArrowUp');
    await page.getByRole('button', { name: 'Next →', exact: true }).click();
    await page.getByRole('button', { name: 'Skip remaining', exact: true }).click();
    await page.getByRole('button', { name: 'Build strength', exact: true }).click();
    await page.getByLabel('Custom goal').fill('Synthetic migration fixture: climb better');
    await page.getByRole('button', { name: 'Next →', exact: true }).click();
    for (let step = 0; step < 6; step++) await page.getByRole('button', { name: /^Skip(?: remaining)?$/, exact: true }).click();
    await page.getByRole('button', { name: 'Confirm profile', exact: true }).click();
    await expect(page).toHaveURL(/plans/);
    await page.goto(`${base}/settings?tab=backup`);
    await page.getByRole('tab', { name: 'Backup & restore', exact: true }).click();
    const filename = `${version}-onboarding.json`;
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON backup', exact: true }).click();
    await (await download).saveAs(resolve(output, filename));
    const bytes = await readFile(resolve(output, filename));
    const exported = JSON.parse(bytes.toString());
    if (exported.data.guidedStates.length !== 1 || exported.data.sessions.length !== 0) throw Error('Unexpected onboarding fixture');
    await page.screenshot({ path: resolve(output, `${version}-onboarding-export.png`) });
    manifest.cases.push({ version, sourceCommit: execFileSync('git', ['rev-parse', commit], { encoding: 'utf8' }).trim(), file: filename, sha256: createHash('sha256').update(bytes).digest('hex'), schemaVersion: exported.schemaVersion, coverage: ['onboarding-only'], mock: 'API unavailable; no generated plans', browser: browser.version() });
    const sourceCommit = manifest.cases.at(-1).sourceCommit;
    await enterMixedData(page, base, version);
    const mixedDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON backup', exact: true }).click();
    const mixedName = `${version}-plans-weight.json`;
    await (await mixedDownload).saveAs(resolve(output, mixedName));
    const mixedBytes = await readFile(resolve(output, mixedName));
    manifest.cases.push({ version, sourceCommit, file: mixedName, sha256: createHash('sha256').update(mixedBytes).digest('hex'), coverage: ['past-and-future-date-plans', 'body-weight', ...(version === 'v5' ? [] : ['device-reminder-preferences-not-exported'])], modelCalls: 0 });
    await context.close();
    const restoreContext = await browser.newContext({ locale: 'en-US' });
    const restorePage = await restoreContext.newPage();
    await restorePage.addInitScript(() => localStorage.setItem('fitness.language', 'en'));
    await restorePage.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'OFFLINE_FIXTURE' } }));
    await restorePage.goto(`${base}/settings?tab=backup`);
    await restorePage.getByRole('tab', { name: 'Backup & restore', exact: true }).click();
    await restorePage.getByLabel('Restore JSON file', { exact: true }).setInputFiles(resolve(output, filename));
    await expect(restorePage.getByText('Backup validated, including its data references.', { exact: true })).toBeVisible();
    await restorePage.getByRole('button', { name: 'Next: keep current data', exact: true }).click();
    const safetyDownload = restorePage.waitForEvent('download');
    await restorePage.getByRole('button', { name: 'Download current data before replacement', exact: true }).click();
    await (await safetyDownload).saveAs(resolve(output, `${version}-pre-restore.json`));
    await restorePage.getByLabel('I have downloaded and kept the current backup', { exact: true }).check();
    await restorePage.getByRole('button', { name: 'Next: confirm replacement', exact: true }).click();
    await restorePage.getByLabel('I confirm replacing all local data', { exact: true }).check();
    await restorePage.getByRole('button', { name: 'Replace local data', exact: true, includeHidden: true }).click();
    await expect(restorePage.getByTestId('restore-result')).toHaveText('Restore succeeded.');
    const reexport = restorePage.waitForEvent('download');
    await restorePage.getByRole('button', { name: 'Export JSON backup', exact: true }).click();
    const reexportName = `${version}-onboarding-restored.json`;
    await (await reexport).saveAs(resolve(output, reexportName));
    const restoredBytes = await readFile(resolve(output, reexportName));
    const restored = JSON.parse(restoredBytes.toString());
    expect(restored.data.guidedStates).toEqual(exported.data.guidedStates);
    expect(restored.data.profiles).toEqual(exported.data.profiles);
    manifest.cases.push({ version, sourceCommit, file: reexportName, sha256: createHash('sha256').update(restoredBytes).digest('hex'), coverage: ['restore-old-export-then-reexport'], original: filename });
    await restoreContext.close();
    console.log(`${version}: UI export verified`);
  }
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
} finally { await browser.close(); for (const server of servers) server.kill(); }

