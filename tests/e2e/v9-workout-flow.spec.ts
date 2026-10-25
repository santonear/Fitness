import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/** V9 workout flow: start → timed countdown → set done → rest countdown → finish → review (owner decision 2026-10-19). */
async function startManual(page: Page, names: string[]) {
  await page.goto('/manual');
  for (const name of names) {
    await page.getByRole('searchbox').fill(name);
    await page.getByRole('button', { name, exact: true }).first().click();
  }
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await expect(page).toHaveURL(/\/workout\//);
}
const sets = (page: Page) =>
  page.evaluate(async () => {
    const p = '/src/persistence/db.ts';
    return (await (await import(/* @vite-ignore */ p)).database.v8Workouts.toArray())[0]?.sets ?? [];
  });

test('timed countdown, rest countdown with +15 s and skip, finish summary and review charts', async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.install();
  await page.addInitScript(() => {
    (window as unknown as { vibrations: number[] }).vibrations = [];
    Object.defineProperty(navigator, 'vibrate', {
      value: (n: number) => {
        (window as unknown as { vibrations: number[] }).vibrations.push(n);
        return true;
      },
    });
    localStorage.setItem('fitness.rest-vibration', 'on');
  });
  await startManual(page, ['平板支撑', '臀桥']);
  await expect(page.getByRole('heading', { name: '平板支撑', exact: true })).toBeVisible();
  // The first screen is about the exercise: no stop-signal list or red-flag buttons until 身体不适？ is tapped.
  await expect(page.getByText(/出现以下情况/)).toHaveCount(0);
  await expect(page.getByText(/每次用时|RIR|点数字修改|动作模式图标/)).toHaveCount(0);
  const timer = page.getByRole('timer', { name: '剩余时间' });
  const target = await timer.textContent();
  expect(target).toMatch(/^\d+:\d\d$/);
  const seconds = Number(target!.split(':')[0]) * 60 + Number(target!.split(':')[1]);
  // Nothing counts until the user taps.
  await page.clock.runFor(5000);
  await expect(timer).toHaveText(target!);
  await page.getByRole('button', { name: '开始计时', exact: true }).click();
  await page.clock.runFor(2000);
  await expect(timer).not.toHaveText(target!);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const paused = await timer.textContent();
  await page.clock.runFor(5000);
  await expect(timer).toHaveText(paused!);
  await page.getByRole('button', { name: '继续计时', exact: true }).click();
  // 暂停或结束 holds the countdown like 身体不适？; the user resumes it.
  await page.getByRole('button', { name: '暂停或结束', exact: true }).click();
  const held = await timer.textContent();
  await page.clock.runFor(5000);
  await page.getByRole('dialog').getByRole('button', { name: '继续训练', exact: true }).click();
  await expect(timer).toHaveText(held!);
  await page.getByRole('button', { name: '继续计时', exact: true }).click();
  await page.clock.runFor(seconds * 1000);
  await expect(timer).toHaveText('0:00');
  await expect(page.getByText('时间到，点“完成这一组”记下来。', { exact: true })).toBeVisible();
  // The next set never starts by itself.
  await expect(page.getByRole('heading', { name: '休息一下' })).toHaveCount(0);
  await page.getByRole('button', { name: '完成这一组', exact: true }).click();
  await expect.poll(async () => (await sets(page)).length).toBe(1);
  expect((await sets(page))[0].durationSeconds).toBe(seconds);

  // Rest: counts down from the saved set, +15 s, reminder at the end, waits for a tap.
  await expect(page.getByRole('heading', { name: '休息一下', exact: true })).toBeFocused();
  const rest = page.getByRole('timer', { name: '休息剩余时间' });
  await expect(rest).toHaveText('1:00');
  await expect(page.getByText('第 2 组，共 2 组', { exact: true })).toBeVisible();
  await page.clock.runFor(10_000);
  await expect(rest).toHaveText('0:50');
  await page.getByRole('button', { name: '多休息 15 秒', exact: true }).click();
  await expect(rest).toHaveText('1:05');
  await page.clock.runFor(66_000);
  await expect(rest).toHaveText('0:00');
  await expect(page.getByText('休息好了，准备好就开始。', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { vibrations: number[] }).vibrations)).toEqual([30, 30]);
  await page.clock.runFor(30_000);
  await expect(page.getByRole('heading', { name: '休息一下', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '开始下一组', exact: true }).click();
  await expect(page.getByRole('heading', { name: '平板支撑', exact: true })).toBeFocused();
  await expect(page.getByText('第 2 组，共 2 组', { exact: true })).toBeVisible();

  // Second set untouched records the target; skipping rest moves to the next exercise.
  await page.getByRole('button', { name: '完成这一组', exact: true }).click();
  await expect(page.getByRole('heading', { name: '休息一下', exact: true })).toBeVisible();
  await expect(page.getByText('下一个动作', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '跳过休息', exact: true }).click();
  await expect(page.getByRole('heading', { name: '臀桥', exact: true })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);

  // 身体不适？ keeps every safety path reachable in one place.
  await page.getByRole('button', { name: '身体不适？', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: '哪里不舒服？' })).toBeVisible();
  await expect(sheet.getByText(/请立即停止/).first()).toBeVisible();
  await expect(sheet.getByRole('button', { name: /关节或肌肉疼/ })).toBeEnabled();
  await sheet.getByRole('button', { name: '没事，继续', exact: true }).click();
  await expect(sheet).not.toBeVisible();

  await page.getByRole('button', { name: '完成这一组', exact: true }).click();
  await page.getByRole('button', { name: '跳过休息', exact: true }).click();
  await page.getByRole('button', { name: '暂停或结束', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '结束并记下', exact: true }).click();

  // Finish: celebration, this session's numbers and the week.
  await expect(page.getByRole('heading', { name: '练了一部分', exact: true })).toBeVisible();
  await expect(page.getByText('完成组数', { exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: '本周' })).toBeVisible();
  await expect(page.getByText(/如实记下来/)).toHaveCount(0);
  await page.getByRole('button', { name: '刚好', exact: true }).click();
  await page.getByRole('button', { name: '记下来', exact: true }).click();

  // Review: chart for sessions / volume / minutes, no premature patterns and the line appears once.
  await expect(page.getByRole('heading', { name: '本周回顾' })).toBeVisible();
  const chart = page.getByRole('img', { name: /本周每天/ });
  await expect(chart).toBeVisible();
  await page.getByRole('radio', { name: '分钟', exact: true }).click();
  await expect(page.getByRole('img', { name: /本周每天.*分钟/ })).toBeVisible();
  await expect(page.getByText(/没练完/)).toHaveCount(0);
  await expect(page.getByText(/如实记下来/)).toHaveCount(1);
});

test('0 sets: finish offers 放弃这次 and 继续训练; closing 修改数值 with an empty value keeps the last one', async ({
  page,
}) => {
  await startManual(page, ['臀桥']);
  await page.getByRole('button', { name: '修改数值', exact: true }).click();
  const reps = page.getByRole('dialog').getByRole('spinbutton');
  const before = await reps.inputValue();
  await reps.fill('');
  await expect(reps).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: '修改数值', exact: true }).click();
  await expect(reps).toHaveValue(before);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: '暂停或结束', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '结束并记下', exact: true }).click();
  await expect(page.getByRole('heading', { name: '这次先到这里', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '记下这次（0 组）', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '继续训练', exact: true }).click();
  await expect(page.getByRole('heading', { name: '臀桥', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '暂停或结束', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '结束并记下', exact: true }).click();
  await page.getByRole('button', { name: '放弃这次', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const p = '/src/persistence/db.ts';
        return (await (await import(/* @vite-ignore */ p)).database.v8Workouts.toArray())[0]?.status;
      }),
    )
    .toBe('abandoned');
});

test('390px screenshots of player, rest, finish and review in all five themes @screens', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'Screenshots are a chromium self-check');
  test.setTimeout(240_000);
  mkdirSync('test-results-review/v9-workout', { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  for (const theme of ['pop', 'vivid', 'gentle', 'data', 'fire']) {
    await page.goto('/');
    await page.evaluate(theme => localStorage.setItem('fitness-theme', theme), theme);
    await startManual(page, ['平板支撑', '哑铃深蹲']);
    const shot = async (name: string) => {
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results-review/v9-workout/${theme}-${name}.png` });
      if (theme === 'pop' && ['player-timed', 'rest', 'finish', 'review'].includes(name)) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.screenshot({ path: `test-results-review/v9-workout/pop-${name}-1440.png` });
        await page.setViewportSize({ width: 390, height: 844 });
      }
    };
    await shot('player-timed');
    await page.getByRole('button', { name: '开始计时', exact: true }).click();
    await page.clock.runFor(3000);
    await page.getByRole('button', { name: '完成这一组', exact: true }).click();
    await expect(page.getByRole('heading', { name: '休息一下', exact: true })).toBeVisible();
    await page.clock.runFor(12_000);
    await shot('rest');
    await page.getByRole('button', { name: '身体不适？', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForTimeout(700);
    await shot('safety');
    await page.getByRole('dialog').getByRole('button', { name: '没事，继续', exact: true }).click();
    await page.getByRole('button', { name: '跳过休息', exact: true }).click();
    await page.getByRole('button', { name: '完成这一组', exact: true }).click();
    await page.getByRole('button', { name: '跳过休息', exact: true }).click();
    await expect(page.getByRole('heading', { name: '哑铃深蹲', exact: true })).toBeVisible();
    await shot('player-reps');
    await page.getByRole('button', { name: '暂停或结束', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '结束并记下', exact: true }).click();
    await expect(page.getByText('完成组数', { exact: true })).toBeVisible();
    await page.waitForTimeout(300);
    await shot('finish');
    await page.getByRole('button', { name: '记下来', exact: true }).click();
    await expect(page.getByRole('heading', { name: '本周回顾' })).toBeVisible();
    await shot('review');
    await page.evaluate(async () => {
      const p = '/src/persistence/db.ts';
      const db = (await import(/* @vite-ignore */ p)).database;
      await db.v8Workouts.clear();
    });
  }
});
