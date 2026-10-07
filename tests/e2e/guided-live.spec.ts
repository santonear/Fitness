import { completedPlanningProfile } from './planning-profile-fixture';
import { expect, test, type Page } from '@playwright/test';
test.beforeEach(async ({ page }) => completedPlanningProfile(page));
import { validateGuidedProviderOutput } from '../../src/backend/guided-provider';
import { fourMetricCandidate } from '../fixtures/prompt-cases';
test.setTimeout(90_000);
async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'en'));
  await page.goto('/ai');
  await page.getByRole('heading', { name: 'AI trial access' }).waitFor();
}
async function scope(page: Page) {
  await page.getByRole('textbox', { name: 'goal, clarification or changes', exact: true }).fill('Build a regular fitness routine');
}
function timedExercises() { return fourMetricCandidate().days[0].exercises.map(exercise => ({ ...exercise, setTimings: exercise.targetSets.map(target => ({ durationSeconds: 'durationSeconds' in target ? target.durationSeconds : 40, restSeconds: 30 })), notes: 'Rest 30 seconds; controlled tempo.' })); }
async function selectDates(page: Page, count = 1) {
  const section = page.getByRole('region', { name: /Confirm daily training times|确认逐日训练时间/ });
  await expect(section).toBeVisible();
  for(let i=0;i<count;i++) await section.getByRole('checkbox').nth(i).check();
  return section;
}
for (const bounded of [false,true]) test(`confirmed schedule waits for approval and saves once; bounded=${bounded}`,async({page},info)=>{
  let pending=false; const sent:any[]=[];
  await page.route('**/api/v1/**',async route=>{
    if(route.request().method()==='GET') return route.fulfill({json:{expiresAt:Date.now()+86400000,period:'2026-10',used:{understand:1,generate:0},limits:{understand:8,generate:4},pending:pending?1:0,reconciliationRequired:pending&&!bounded,aiEnabled:true}});
    const body=route.request().postDataJSON();sent.push(body);pending=true;
    const raw=body.operation==='understand'?{kind:'understand',summary:'Four training days, 30 minutes each',uncertainties:[]}:{kind:'program',name:'Confirmed four days',explanation:'Synthetic schedule',days:body.dialogue.dates.map((date:string)=>({date,exercises:timedExercises()}))};
    await route.fulfill({json:{requestId:body.requestId,result:validateGuidedProviderOutput(body.dialogue,raw),accounting:'pending',context:{restoreGeneration:body.restoreGeneration,inputDigest:body.sendConfirmation}}});
  });
  await open(page);await scope(page);
  await page.getByRole('combobox',{name:'Planning range (1–14 days)'}).selectOption('4');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByRole('region',{name:'Confirm daily training times'})).toBeVisible(); expect(sent).toHaveLength(1);
  if(!bounded){await expect(page.getByRole('button',{name:'Confirm times, generate and save plan'})).toBeDisabled();pending=false;await page.getByRole('button',{name:'Check access and allowance'}).click();}
  const section=await selectDates(page,4);const times=['12:00','14:00','09:00','20:00'];
  for(let i=0;i<4;i++)await section.locator('input[type=time]').nth(i).fill(times[i]);
  expect(sent).toHaveLength(1);
  if(!bounded && info.project.name==='chromium') await section.screenshot({path:'outputs/training-schedule-confirmation.png'});
  await section.getByRole('button',{name:'Confirm times, generate and save plan'}).click();
  await expect(page.getByRole('button',{name:'Plan saved',exact:true})).toBeDisabled();
  expect(sent).toHaveLength(2);expect(sent[1].dialogue.schedule.map((slot:any)=>slot.startTime)).toEqual(times);
  await expect(page.locator('.candidate-day')).toHaveCount(4);
  await expect(page.locator('.candidate-day').first()).toContainText('estimated work');
  await page.goto('/');
  const dates=sent[1].dialogue.dates;
  const dayButton=page.locator('[data-calendar-date="'+dates[0]+'"]');await dayButton.click();
  await expect(dayButton).toContainText('12:00');
  await page.getByRole('button',{name:'day',exact:true}).click();
  const block=page.locator('.calendar-training-block');await expect(block).toContainText('12:00–12:30');
  await expect(block).toHaveCSS('top','576px');await expect(block).toHaveCSS('height','24px');
  const handle=page.getByRole('button',{name:'Drag to change training time'});await handle.scrollIntoViewIfNeeded();
  const box=(await handle.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+96,{steps:8});await page.mouse.up();
  await expect(page.getByRole('dialog')).toContainText('12:00 → 14:00');
  if(!bounded && info.project.name==='chromium') await page.screenshot({path:'outputs/training-time-change.png'});
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(block).toContainText('12:00–12:30');
  await handle.focus();await page.keyboard.press('Enter');await page.getByLabel('New start time').fill('14:00');await page.getByRole('button',{name:'Confirm change',exact:true}).click();
  await expect(block).toContainText('14:00–14:30');expect(sent).toHaveLength(2);
  await page.reload();await page.locator('[data-calendar-date="'+dates[0]+'"]').click();await expect(page.locator('[data-calendar-date="'+dates[0]+'"]')).toContainText('14:00');
  const persisted=await page.evaluate(async()=>{const path='/src/persistence/db.ts';const {database}=await import(/* @vite-ignore */ path);return {tasks:(await database.scheduledWorkouts.toArray()).sort((a:any,b:any)=>a.scheduledDate.localeCompare(b.scheduledDate)),state:await database.guidedStates.get('guided')};});
  expect(persisted.tasks.map((task:any)=>task.startTime)).toEqual(['14:00','14:00','09:00','20:00']);expect(persisted.state.events.at(-1).action).toBe('rescheduled');expect(persisted.state.programs[0].revision).toBe(1);
});

test('failed status stays unknown and no request is sent without qualification', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/v1/**', async route => { requests++; return route.fulfill({ status: 503, json: { error: 'CONTROL_UNAVAILABLE' } }); });
  await open(page); await scope(page);
  await expect(page.getByText('Access and allowance are unknown')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  expect(requests).toBe(1);
});

test('uncertain one-click send preserves the request identity on explicit retry', async ({ page }) => {
  const ids: string[] = [];
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { expiresAt: Date.now() + 86400000, period: '2026-10', used: { understand: 0, generate: 0 }, limits: { understand: 8, generate: 4 }, pending: 0, aiEnabled: true } });
    const body = route.request().postDataJSON(); ids.push(body.requestId);
    expect(body.dialogue.scope).not.toHaveProperty('body'); expect(body.dialogue.scope).not.toHaveProperty('history');
    return route.fulfill({ status: 503, json: { error: 'CONTROL_UNAVAILABLE' } });
  });
  await open(page); await scope(page);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible(); expect(ids).toHaveLength(1);
  await page.getByRole('button', { name: 'Check access and allowance', exact: true }).click();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible(); expect(ids).toHaveLength(2); expect(ids[1]).toBe(ids[0]);
  await expect(page.getByRole('textbox', { name: 'goal, clarification or changes', exact: true })).toHaveValue('Build a regular fitness routine');
});

for (const locale of ['en', 'zh'] as const) test(`${locale} clarification stays in chat, then confirms timing and saves a detailed plan`, async ({ page }) => {
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en;
  const sent: any[] = [];
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { expiresAt: Date.now() + 86400000, period: '2026-10', used: { understand: 0, generate: 0 }, limits: { understand: 8, generate: 4 }, pending: 0, aiEnabled: true } });
    const body = route.request().postDataJSON(); sent.push(body);
    expect(body.dialogue.scope).not.toHaveProperty('body'); expect(body.dialogue.scope).not.toHaveProperty('history');
    const raw = body.operation === 'understand'
      ? { kind: 'understand', summary: sent.length === 1 ? 'Build strength' : 'Build strength once weekly, 30 minutes, at home without equipment; beginner, no stated restrictions.', uncertainties: sent.length === 1 ? ['How often and where can you train?'] : [] }
      : { kind: 'program', name: t('A manageable start', '循序开始'), explanation: t('One training day, with recovery on the other days.', '安排一天训练，其余日期休息恢复。'), days: [{ ...fourMetricCandidate().days[0], date: body.dialogue.dates[0], exercises: timedExercises().map(exercise => ({ ...exercise, notes: t('Rest 60 seconds. Keep a controlled tempo.', '组间休息60秒，保持稳定节奏。') })) }] };
    await route.fulfill({ json: { requestId: body.requestId, accounting: 'settled', result: validateGuidedProviderOutput(body.dialogue, raw), context: { restoreGeneration: body.restoreGeneration, inputDigest: body.sendConfirmation } } });
  });
  await page.addInitScript(locale => localStorage.setItem('fitness.language', locale), locale);
  await page.goto('/ai');
  const input = page.getByRole('textbox', { name: t('goal, clarification or changes', '目标、补充或调整想法'), exact: true });
  await input.fill('Local note not authorized for sending');
  await page.getByRole('button', { name: t('save your thoughts locally', '保存想法（不外发）'), exact: true }).click();
  await expect(input).toHaveValue('');
  await input.fill('I want to build strength');
  await page.getByRole('button', { name: t('Send', '发送'), exact: true }).click();
  await expect(input).toHaveValue('');
  expect(sent).toHaveLength(1);
  expect(JSON.stringify(sent[0])).not.toContain('Local note not authorized');
  await expect(page.getByRole('log')).toContainText('How often and where');
  await input.fill('Once weekly, 30 minutes, home, no equipment. Beginner, no restrictions.');
  await page.getByRole('button', { name: t('Send', '发送'), exact: true }).click();
  const section = await selectDates(page); expect(sent).toHaveLength(2);
  await section.getByRole('button').click();
  await expect(page.getByRole('button', { name: t('Plan saved', '计划已保存'), exact: true })).toBeDisabled();
  expect(sent.map(value => value.operation)).toEqual(['understand', 'understand', 'generate']);
  expect(JSON.stringify(sent[1].dialogue.scope.conditions.priorDialogue)).toContain('I want to build strength');
  expect(sent[2].dialogue).toMatchObject({ scope: { goal: 'Build strength once weekly, 30 minutes, at home without equipment; beginner, no stated restrictions.' } });
  expect(sent[2].dialogue.dates).toHaveLength(1);
  await expect(page.locator('.candidate-day')).toHaveCount(1);
  await expect(page.locator('.candidate-day .candidate-notes').first()).toContainText(t('Rest 60 seconds', '组间休息60秒'));
  await expect(page.locator('[id$="quota-notice"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `outputs/automatic-planning-${locale}.png`, fullPage: true });
  await expect(page.getByRole('status').filter({ hasText: t('Plan adopted', '计划已采用') })).toBeVisible();
  expect(sent).toHaveLength(3);
});

test('failed confirmed generation retries only generation with the same identity', async ({ page }) => {
  const sent: any[] = [];
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { expiresAt: Date.now() + 86400000, period: '2026-10', used: { understand: 1, generate: 0 }, limits: { understand: 8, generate: 4 }, pending: 0, aiEnabled: true } });
    const body = route.request().postDataJSON(); sent.push(body);
    if (body.operation === 'generate') return route.fulfill({ status: 503, json: { error: 'CONTROL_UNAVAILABLE' } });
    return route.fulfill({ json: { requestId: body.requestId, accounting: 'settled', result: validateGuidedProviderOutput(body.dialogue, { kind: 'understand', summary: 'A ready goal', uncertainties: [] }), context: { restoreGeneration: body.restoreGeneration, inputDigest: body.sendConfirmation } } });
  });
  await open(page); await scope(page);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const section=await selectDates(page);await section.getByRole('button').click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(sent.map(value => value.operation)).toEqual(['understand', 'generate']);
  await page.getByRole('button', { name: 'Check access and allowance', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm times, generate and save plan', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(sent.map(value => value.operation)).toEqual(['understand', 'generate', 'generate']);
  expect(sent[2]).toEqual(sent[1]);
});

test('changing the message while understanding is in flight prevents automatic generation', async ({ page }) => {
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  let posts = 0;
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { expiresAt: Date.now() + 86400000, period: '2026-10', used: { understand: 0, generate: 0 }, limits: { understand: 8, generate: 4 }, pending: 0, aiEnabled: true } });
    posts++; const body = route.request().postDataJSON();
    await ready;
    return route.fulfill({ json: { requestId: body.requestId, accounting: 'settled', result: validateGuidedProviderOutput(body.dialogue, { kind: 'understand', summary: 'Old goal', uncertainties: [] }), context: { restoreGeneration: body.restoreGeneration, inputDigest: body.sendConfirmation } } });
  });
  await open(page); await scope(page);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(() => posts).toBe(1);
  await page.getByRole('textbox', { name: 'goal, clarification or changes', exact: true }).fill('A different goal');
  release();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  expect(posts).toBe(1);
  await expect(page.getByRole('heading', { name: 'Your training plan' })).toHaveCount(0);
});
