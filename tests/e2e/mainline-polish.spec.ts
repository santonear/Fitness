import {test,expect,type Page} from '@playwright/test';
async function shot(page:Page,name:string){
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`outputs/mainline-polish/${process.env.POLISH_BASE_URL?'preview':'local'}-${page.viewportSize()!.width}-${name}.png`,fullPage:!name.startsWith('manual'),animations:'disabled'});
}
async function onboard(page:Page){
 await page.goto('/');
 for(const answer of ['保持力量','每周3次，每次30–45分钟','在家，只有瑜伽垫']){
  await page.getByLabel('你的回答').fill(answer);await page.getByRole('button',{name:'继续',exact:true}).click();
 }
 await page.getByLabel('我已年满 18 岁',{exact:false}).check();await page.getByRole('button',{name:'生成新计划'}).click();
}

test('legacy exercise cards use provider or original person images, never stick SVGs',async({page})=>{
 await page.goto('/manual');
 for(const [name,src] of [['高脚杯深蹲','/media/dumbbell-goblet-squat.png'],['自阻力划船','/media/self-resisted-row.png'],['徒手深蹲','bodyweight-squat'],['平板支撑','plank']]) {
  await page.getByRole('searchbox').fill(name);
  const card=page.locator('.manual-card').filter({has:page.getByRole('button',{name,exact:true})}).first();
  const image=card.locator('img').first();await expect(image).toHaveAttribute('src',new RegExp(src));
  await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  if(src.startsWith('/media/')) { await card.scrollIntoViewIfNeeded(); await shot(page,`manual-illustration-${name}`); }
 }
});
test('RepDB guide retains both poses and visible source link',async({page})=>{
 await page.goto('/manual');await page.getByRole('searchbox').fill('reverse lunge');await page.getByRole('button',{name:'反向弓步',exact:true}).click();await page.getByRole('button',{name:'开始',exact:true}).click();await page.getByRole('button',{name:'查看动作指导',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toHaveAttribute('role','dialog');await expect(dialog).toHaveAttribute('aria-modal','true');await expect(dialog.locator('.repdb-media img')).toHaveCount(2);await expect(dialog.getByRole('link',{name:'RepDB',exact:true})).toHaveAttribute('href','https://repdb.co/');
 for(const image of await dialog.locator('.repdb-media img').all())await expect.poll(()=>image.evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true);
 await shot(page,'repdb-guide');
});
test('manual near matches and library share complete exercise guidance',async({page})=>{
 await page.goto('/manual');await page.getByRole('searchbox').fill('俯误错');
 await expect(page.getByRole('heading',{name:'相近动作（保留当前筛选）'})).toBeVisible();
 const card=page.locator('.manual-card').filter({has:page.getByRole('button',{name:'俯卧撑',exact:true})}).first();
 await card.scrollIntoViewIfNeeded();await shot(page,'manual-near-matches');
 await card.getByRole('button',{name:'动作提示',exact:true}).click();
 for(const name of ['动作要点','完整步骤','常见错误','注意事项'])await expect(page.getByRole('dialog').getByRole('heading',{name,exact:true})).toBeVisible();
 await shot(page,'manual-full-guide');await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
 await page.goto('/exercises');await page.getByRole('searchbox').fill('俯误错');
 await expect(page.getByRole('heading',{name:'相近动作（保留当前筛选）'})).toBeVisible();await page.getByRole('button',{name:'俯卧撑',exact:true}).first().click();
 await expect(page.getByRole('dialog').getByRole('heading',{name:'常见错误',exact:true})).toBeVisible();await shot(page,'library-full-guide');
});
test('fresh mainline: duration, local coach, exercise guide, bottom pause, finish and review',async({page})=>{
 let modelCalls=0;await page.route('**/api/v1/plans/generate',async r=>{modelCalls++;await r.abort();});
 await onboard(page);await expect(page.getByText('基础计划',{exact:true})).toBeVisible();
 const minutes=await page.locator('.v8-draft-template').first().locator('p').first().innerText();
 expect(Number(minutes.match(/\d+/)![0])).toBeGreaterThanOrEqual(30);expect(Number(minutes.match(/\d+/)![0])).toBeLessThanOrEqual(45);
 await shot(page,'draft');
 await page.locator('button.v8-draft-exercise').first().click();await expect(page.getByRole('dialog')).toContainText('常见错误');await shot(page,'draft-guide');await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'就用这份计划'}).click();await expect(page.getByRole('heading',{name:'下一次',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'和芽芽聊聊',exact:true}).first().click();
 await page.getByRole('dialog').getByRole('textbox').fill('膝盖不适');await page.getByRole('dialog').getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.getByRole('log')).toContainText('如果疼痛明显或持续，先休息，并请专业人士看看');await expect(page.getByRole('dialog')).toContainText('蚌式');await expect(page.getByRole('dialog')).toContainText('现在用的是本地建议');await expect(page.getByRole('dialog')).not.toContainText('芽芽暂时连不上');await shot(page,'coach-local-pain');
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
test('review coach remains separate from statistics at narrow widths and after scrolling',async({page})=>{
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();await expect(page.getByRole('heading',{name:'下一次',exact:true})).toBeVisible();await page.goto('/review');
 const original=page.viewportSize()!;
 for(const width of original.width===375?[320,375]:[original.width]){
  await page.setViewportSize({width,height:original.height});
  for(const scroll of [0,200,600]){
   await page.evaluate(y=>window.scrollTo(0,y),scroll);
   const coach=await page.getByRole('button',{name:'和芽芽聊聊',exact:true}).boundingBox(),facts=await page.locator('.v8-facts').boundingBox();
   expect(coach).not.toBeNull();expect(facts).not.toBeNull();
   expect(coach!.y+coach!.height<=facts!.y||facts!.y+facts!.height<=coach!.y||coach!.x+coach!.width<=facts!.x||facts!.x+facts!.width<=coach!.x).toBe(true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
 }
 await page.evaluate(()=>window.scrollTo(0,0));await shot(page,'review-coach-clearance');
 await page.getByRole('button',{name:'和芽芽聊聊',exact:true}).click();await expect(page.getByRole('dialog')).toHaveAttribute('aria-modal','true');
});
test('unknown load stays unknown until a chosen fractional weight, all theme numerals',async({page})=>{
 await page.goto('/manual');await page.getByRole('searchbox').fill('高脚杯深蹲');await page.getByRole('button',{name:'高脚杯深蹲',exact:true}).first().click();await page.getByRole('button',{name:'开始',exact:true}).click();
 await expect(page.getByText('选择你的重量',{exact:true})).toBeVisible();await page.getByRole('button',{name:'完成这一组',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'确定',exact:true})).toBeDisabled();await dialog.getByRole('spinbutton',{name:'公斤',exact:true}).pressSequentially('0.5');await expect(dialog.getByRole('spinbutton',{name:'公斤',exact:true})).toHaveValue('0.5');await dialog.getByRole('button',{name:'确定',exact:true}).click();await page.getByRole('button',{name:'完成这一组',exact:true}).click();await expect(page.getByText('第 2 组，共 2 组',{exact:true})).toBeVisible();
 // V9 rest countdown follows the saved set; once skipped it stays closed on reload in this tab.
 await page.getByRole('button',{name:'跳过休息',exact:true}).click();
 const workoutUrl=page.url();
 const numerals:Record<string,string>={'柔光拟物':'Jost','山野暖阳':'Cormorant Garamond','温和陪伴':'Jost','专业数据':'Jost','燃动挑战':'Archivo'};
 for(const theme of Object.keys(numerals)){
  await page.goto('/settings/appearance');await page.getByRole('radio',{name:theme,exact:true}).click();await page.goto(workoutUrl);await expect(page.getByText('第 2 组，共 2 组',{exact:true})).toBeVisible();
  await expect.poll(()=>page.locator('.v8-set-value').evaluate(e=>getComputedStyle(e).fontFamily)).toContain(numerals[theme]);await shot(page,`digits-${theme}`);
 }
});
test('manual selection to completed record, appearance previews and reminders',async({page})=>{
 await page.goto('/manual');const search=page.getByRole('searchbox',{name:'搜索动作'});await search.fill('squat');await page.getByRole('button',{name:'徒手深蹲',exact:true}).first().click();await shot(page,'manual-search');
 await search.fill('plank');await page.getByRole('button',{name:'平板支撑',exact:true}).first().click();await page.getByRole('button',{name:'清空筛选',exact:true}).click();await page.getByRole('button',{name:'在家',exact:true}).click();await shot(page,'manual-filter');await page.locator('.manual-card').first().scrollIntoViewIfNeeded();await shot(page,'manual-cards');
 await expect(page.locator('.manual-start')).toContainText('已选 2 个动作');await page.getByRole('button',{name:'开始',exact:true}).click();await page.getByRole('button',{name:'完成这一组',exact:true}).click();await page.locator('.v8-capsules').getByRole('button',{name:'平板支撑',exact:true}).click();await expect(page.getByRole('button',{name:'修改数值',exact:true})).toContainText('20 秒');await expect(page.getByRole('timer',{name:'剩余时间'})).toHaveText('0:20');await page.getByRole('button',{name:'暂停或结束',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'结束并记下',exact:true}).click();await page.getByRole('button',{name:'记下来',exact:true}).click();
 await expect(page.getByText('这周你动了 1 次。',{exact:true})).toBeVisible();
 await page.goto('/settings/appearance');await expect(page.locator('.v9-theme-option')).toHaveCount(5);await shot(page,'appearance');
 const previewNumerals:Record<string,string>={'柔光拟物':'Jost','山野暖阳':'Cormorant Garamond','温和陪伴':'Jost','专业数据':'Jost','燃动挑战':'Archivo'};
 for(const theme of Object.keys(previewNumerals)){
  await page.getByRole('radio',{name:theme,exact:true}).click();await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--f-num'))).toContain(previewNumerals[theme]);
  await shot(page,`appearance-${theme}`);
 }
});

 test('home defaults and empty filter recovery work on deployed assets',async({page})=>{
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();await page.goto('/manual');
 for(const name of ['无器械','瑜伽垫'])await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('searchbox').fill('zzzzzzzz');
 const empty=page.locator('.manual-empty');await expect(empty).toContainText(/清空筛选后有 \d+ 个动作/);
 const count=(await empty.innerText()).match(/清空筛选后有 (\d+) 个动作/)![1];await shot(page,'manual-empty-recovery');
 await empty.getByRole('button',{name:'清空筛选',exact:true}).click();await expect(page.getByRole('searchbox')).toHaveValue('');await expect(page.locator('.manual-results-heading')).toContainText(count);
 });

 test('plan removal, undo and settings recovery preserve review totals',async({page})=>{
 if(!process.env.POLISH_BASE_URL)await page.route('**/api/v1/features',r=>r.fulfill({json:{version:1,flags:{planLifecycle:true},expiresAt:Date.now()+60000}}));
 await onboard(page);await page.getByRole('button',{name:'就用这份计划',exact:true}).click();await expect(page.getByRole('heading',{name:'下一次',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'开始训练',exact:true}).click();await page.getByRole('button',{name:'完成这一组',exact:true}).click();await page.getByRole('button',{name:'暂停或结束',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'结束并记下',exact:true}).click();await page.getByRole('button',{name:'记下来',exact:true}).click();
 await expect(page.locator('.v8-facts dd').nth(1)).toHaveText('1');const before=await page.locator('.v8-facts dd').allTextContents();
 const remove=async()=>{await page.goto('/plans');await page.getByRole('button',{name:'不再使用这份计划',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('训练记录、回顾统计和进步记录全部保留');await shot(page,'plan-delete-confirm');await dialog.getByRole('button',{name:'确认删除',exact:true}).click();await expect(page.getByText('已删除计划',{exact:true})).toBeVisible();};
 await remove();await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(page.getByRole('button',{name:'不再使用这份计划',exact:true})).toBeVisible();
 await remove();await page.goto('/');await expect(page.getByRole('button',{name:'重新制定计划',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'手动训练',exact:true})).toBeVisible();await shot(page,'no-plan');
 await page.goto('/review');await expect(page.locator('.v8-facts dd')).toHaveText(before);await expect(page.getByText(/还差.*次|按现在的计划继续/)).toHaveCount(0);await shot(page,'no-plan-review');
 await page.goto('/settings');await page.getByRole('button',{name:'已删除的计划',exact:true}).click();await expect(page.getByRole('button',{name:'恢复',exact:true})).toBeVisible();await shot(page,'plan-restore');await page.getByRole('button',{name:'恢复',exact:true}).click();await expect(page.getByText('已恢复到以前的计划',{exact:true})).toBeVisible();
 await page.goto('/plans');await expect(page.getByRole('heading',{name:'以前的计划',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'查看',exact:true})).toBeVisible();await shot(page,'previous-plans');await page.getByRole('button',{name:'重新使用',exact:true}).click();await expect(page.getByRole('button',{name:'不再使用这份计划',exact:true})).toBeVisible();await shot(page,'reused-plan');
 });

test('preview retains cached lifecycle offline and confirms reuse of a previous plan',async({page,context})=>{
 if(!process.env.POLISH_BASE_URL)await page.route('**/api/v1/features',r=>r.fulfill({json:{version:1,flags:{planLifecycle:true},expiresAt:Date.now()+60000}}));
 await onboard(page);await page.getByRole('button',{name:'就用这份计划',exact:true}).click();await expect(page.getByRole('heading',{name:'下一次',exact:true})).toBeVisible();
 await page.goto('/plans');await expect(page.getByRole('button',{name:'不再使用这份计划',exact:true})).toBeVisible();await page.clock.install();await context.setOffline(true);
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.fastForward(90000);
 await expect(page.getByRole('button',{name:'不再使用这份计划',exact:true})).toBeVisible();
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.getByRole('button',{name:'不再使用这份计划',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认删除',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.evaluate(()=>{history.pushState(null,'','/settings');window.dispatchEvent(new PopStateEvent('popstate'));});await page.getByRole('button',{name:'已删除的计划',exact:true}).click();await expect(page.getByRole('button',{name:'恢复',exact:true})).toBeVisible();await shot(page,'offline-restore');
 await page.getByRole('button',{name:'恢复',exact:true}).click();await expect(page.getByText('已恢复到以前的计划',{exact:true})).toBeVisible();await context.setOffline(false);
 await page.route('**/api/v1/features',r=>r.abort());await page.reload();await expect(page.getByRole('button',{name:'已删除的计划',exact:true})).toBeVisible();
 await page.goto('/onboarding');await expect(page.getByRole('button',{name:'生成新计划',exact:true})).toBeVisible();
 for(let i=0;i<3&&await page.getByRole('button',{name:'上一步',exact:true}).count();i++)await page.getByRole('button',{name:'上一步',exact:true}).click();
 for(const answer of ['第二份力量计划','每周2次，每次30分钟','在家，只有瑜伽垫']){await page.getByLabel('你的回答').fill(answer);await page.getByRole('button',{name:'继续',exact:true}).click();}
 await page.getByLabel('我已年满 18 岁',{exact:false}).check();await page.getByRole('button',{name:'生成新计划'}).click();await page.getByRole('button',{name:'就用这份计划',exact:true}).click();await expect(page.getByRole('heading',{name:'下一次',exact:true})).toBeVisible();
 await page.goto('/plans');await page.getByRole('button',{name:'重新使用',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('当前计划会移到以前的计划');await shot(page,'reuse-confirm');await page.getByRole('dialog').getByRole('button',{name:'确认使用',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await expect(page.getByRole('heading',{name:'第二份力量计划',exact:true})).toBeVisible();await shot(page,'reuse-previous-list');
});
