import {test,expect,type Page} from '@playwright/test';
async function shot(page:Page,name:string){
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`outputs/mainline-polish/${process.env.POLISH_BASE_URL?'preview':'local'}-${page.viewportSize()!.width}-${name}.png`,fullPage:true,animations:'disabled'});
}
async function onboard(page:Page){
 await page.goto('/');
 for(const answer of ['保持力量','每周3次，每次30–45分钟','在家，只有瑜伽垫']){
  await page.getByLabel('你的回答').fill(answer);await page.getByRole('button',{name:'继续',exact:true}).click();
 }
 await page.getByLabel('我已年满 18 岁',{exact:false}).check();await page.getByRole('button',{name:'生成我的第一版计划'}).click();
}
test('fresh mainline: duration, local coach, exercise guide, bottom pause, finish and review',async({page})=>{
 let modelCalls=0;await page.route('**/api/v1/plans/generate',async r=>{modelCalls++;await r.abort();});
 await onboard(page);await expect(page.getByText('基础计划',{exact:true})).toBeVisible();
 const minutes=await page.locator('.v8-draft-template').first().locator('p').first().innerText();
 expect(Number(minutes.match(/\d+/)![0])).toBeGreaterThanOrEqual(30);expect(Number(minutes.match(/\d+/)![0])).toBeLessThanOrEqual(45);
 await shot(page,'draft');
 await page.locator('.v8-draft-exercise button').first().click();await expect(page.getByRole('dialog')).toContainText('常见错误');await shot(page,'draft-guide');await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'就用这份计划'}).click();await expect(page.getByRole('heading',{name:'下一次',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'和芽芽聊聊',exact:true}).first().click();
 await page.getByRole('dialog').getByRole('textbox',{name:'跟芽芽说'}).fill('膝盖不适');await page.getByRole('dialog').getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.getByText('如果疼痛明显或持续，先休息，并请专业人士看看',{exact:true})).toBeVisible();await shot(page,'coach-local-pain');
 await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'开始训练',exact:true}).click();
 await expect(page.locator('.exercise-guide-points li')).toHaveCount(2);await expect(page.locator('.exercise-guide-open img')).toBeVisible();
 await expect.poll(()=>page.locator('.exercise-guide-open img').evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true);
 await shot(page,'workout');await page.getByRole('button',{name:'查看动作指导',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('注意事项');await shot(page,'workout-guide');await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'完成这一组',exact:true}).click();await page.getByRole('button',{name:'暂停或结束',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.evaluate(async e=>{await Promise.all(e.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});for(const name of ['继续训练','结束并记下','放弃这次（不计入回顾）']){
  const box=await dialog.getByRole('button',{name,exact:true}).boundingBox();expect(box).not.toBeNull();expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
 }
 await shot(page,'pause');await dialog.getByRole('button',{name:'结束并记下',exact:true}).click();await expect(page.getByText(/本次用时/)).toBeVisible();await shot(page,'finish');
 await page.getByRole('button',{name:'记下来',exact:true}).click();await expect(page.locator('[data-context="review"]')).toHaveCount(1);await shot(page,'week-review');expect(modelCalls).toBe(0);
});
test('unknown load stays unknown until a chosen fractional weight, all theme numerals',async({page})=>{
 await page.goto('/manual');await page.getByRole('searchbox').fill('高脚杯深蹲');await page.getByRole('button',{name:'高脚杯深蹲',exact:true}).first().click();await page.getByRole('button',{name:'开始',exact:true}).click();
 await expect(page.getByText('选择你的重量',{exact:true})).toBeVisible();await page.getByRole('button',{name:'完成这一组',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'确定',exact:true})).toBeDisabled();await dialog.getByRole('spinbutton',{name:'公斤',exact:true}).pressSequentially('0.5');await expect(dialog.getByRole('spinbutton',{name:'公斤',exact:true})).toHaveValue('0.5');await dialog.getByRole('button',{name:'确定',exact:true}).click();await page.getByRole('button',{name:'完成这一组',exact:true}).click();await expect(page.getByText('第 2 组，共 2 组',{exact:true})).toBeVisible();
 const workoutUrl=page.url();
 for(const theme of ['青瓷','留白','静奢','撞色']){
  await page.goto('/settings/appearance');await page.getByRole('button',{name:theme,exact:true}).click();await page.goto(workoutUrl);await expect(page.getByText('第 2 组，共 2 组',{exact:true})).toBeVisible();
  await expect.poll(()=>page.locator('.v8-set-value').evaluate(e=>getComputedStyle(e).fontFamily)).toContain('Archivo');await shot(page,`digits-${theme}`);
 }
});
test('manual selection to completed record, appearance previews and reminders',async({page})=>{
 await page.goto('/manual');const search=page.getByRole('searchbox',{name:'搜索动作'});await search.fill('squat');await page.getByRole('button',{name:'徒手深蹲',exact:true}).first().click();await shot(page,'manual-search');
 await search.fill('plank');await page.getByRole('button',{name:'平板支撑',exact:true}).first().click();await page.getByRole('button',{name:'清空筛选',exact:true}).click();await page.getByRole('button',{name:'在家',exact:true}).click();await shot(page,'manual-filter');
 await expect(page.locator('.manual-start')).toContainText('已选 2 个动作');await page.getByRole('button',{name:'开始',exact:true}).click();await page.getByRole('button',{name:'完成这一组',exact:true}).click();await page.getByRole('button',{name:'暂停或结束',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'结束并记下',exact:true}).click();await page.getByRole('button',{name:'记下来',exact:true}).click();
 await expect(page.getByText('这周你动了 1 次。',{exact:true})).toBeVisible();
 await page.goto('/settings/appearance');await expect(page.locator('.v8-theme-choice')).toHaveCount(4);await shot(page,'appearance');
 for(const theme of ['青瓷','留白','静奢','撞色']){
  await page.getByRole('button',{name:theme,exact:true}).click();await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--f-num'))).toContain('Archivo');
  await shot(page,`appearance-${theme}`);
 }
});
