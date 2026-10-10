import { chromium, expect } from '@playwright/test';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = process.env.V807_SOURCE_URL ?? 'http://127.0.0.1:5297';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'AI_DISABLED' } }));
  await page.goto(base);
  for (const answer of ['想有些力量，不再容易累', '每周2次，每次20分钟', '在家，只有瑜伽垫']) {
    await page.getByLabel('你的回答').fill(answer); await page.getByRole('button', { name: '继续', exact: true }).click();
  }
  await page.getByLabel('我已年满 18 岁').check(); await page.getByRole('button', { name: '生成我的第一版计划' }).click();
  await page.getByRole('button', { name: '就用这份计划' }).click();
  await page.getByRole('button', { name: '开始训练', exact: true }).first().click();
  await page.getByRole('button', { name: '完成这一组', exact: true }).click();
  await expect(page.getByText('第 2 组，共 2 组', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '暂停或结束' }).click(); await page.getByRole('button', { name: '结束并记下', exact: true }).click();
  await page.getByLabel('想补充一句（可不填）').fill('V8迁移验证：真实界面输入的一组训练。');
  await page.getByRole('button', { name: '记下来', exact: true }).click(); await expect(page).toHaveURL(/review/);
  await page.goto(`${base}/settings`); await page.getByRole('button', { name: '备份恢复', exact: true }).click();
  const event = page.waitForEvent('download'); await page.getByRole('button', { name: '导出 JSON 备份', exact: true }).click();
  const path = new URL('./v807-mainline.json', import.meta.url); await (await event).saveAs(path.pathname.replace(/^\/(\w:)/, '$1'));
  const bytes = await readFile(path), data = JSON.parse(bytes);
  if (data.schemaVersion !== 6 || !data.data.v8.workouts.length) throw Error('Wrong V8.0.7 fixture source');
  await writeFile(new URL('./v807-manifest.json', import.meta.url), JSON.stringify({ sourceCommit: '492b9f7d762b319edd1e3e59350c9fb10b8ee6c3', sourceVersion: 'V8.0.7', file: 'v807-mainline.json', sha256: createHash('sha256').update(bytes).digest('hex'), browser: browser.version(), generatedBy: 'generate-v807.mjs', coverage: ['onboarding', 'confirmed basic plan', 'partial workout', 'feedback note', 'UI JSON download'], synthetic: true, modelCalls: 0 }, null, 2));
  console.log('V8.0.7 fixture exported through UI and verified');
} finally { await browser.close(); }
