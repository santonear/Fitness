import {test,expect} from '@playwright/test';
for(const locale of ['en','zh'] as const)test(`${locale} explicit guided demo understanding and candidate save create no training facts`,async({page,baseURL})=>{
 const t=(en:string,zh:string)=>locale==='zh'?zh:en;let outbound=0;page.on('request',r=>{if(!r.url().startsWith(baseURL!))outbound++;});
 await page.addInitScript(locale=>localStorage.setItem('fitness.language',locale),locale);await page.goto('/ai');
 await page.getByRole('textbox',{name:t('goal, clarification or changes','目标、补充或调整想法'),exact:true}).fill('Regular walking');
 await page.getByRole('button',{name:t('preview scope for understanding','预览理解目标的发送范围'),exact:true}).click();
 await page.getByRole('button',{name:t('confirm sending','确认发送'),exact:true}).click();
 await page.getByText(t('review the goal and exact dates','核对目标和具体日期'),{exact:true}).click();
 await expect(page.getByRole('textbox',{name:t('goal interpretation','目标理解'),exact:true})).not.toHaveValue('');
 await page.getByLabel(t('start date','开始日期'),{exact:true}).fill('2027-02-11');await page.getByLabel(t('end date','结束日期'),{exact:true}).fill('2027-02-11');
 await page.getByLabel(t('Calendar month','日历月份'),{exact:true}).fill('2027-02');
 await page.getByRole('button',{name:'2027-02-11',exact:true}).click();
 await page.getByRole('button',{name:t('confirm interpretation','确认理解'),exact:true}).click();
 await page.getByRole('button',{name:t('preview sending scope','预览本次发送范围'),exact:true}).click();
 await page.getByRole('button',{name:t('confirm sending','确认发送'),exact:true}).click();
 await expect(page.getByRole('heading',{name:t('complete candidate, not active yet','完整候选，尚未生效')})).toBeVisible();
 await page.getByRole('button',{name:t('confirm complete plan','确认完整计划'),exact:true}).click();
 await expect.poll(()=>page.evaluate(async()=>{const {database}=await import(String('/src/persistence/db.ts'));return [(await database.guidedStates.get('guided')).programs.length,await database.sessions.count(),await database.sets.count()];})).toEqual([1,0,0]);
 expect(outbound).toBe(0);
});
test('changing goal removes the old sending confirmation',async({page})=>{
 await page.goto('/ai');const goal=page.getByRole('textbox',{name:'goal, clarification or changes',exact:true});await goal.fill('First goal');
 await page.getByRole('button',{name:'preview scope for understanding',exact:true}).click();await expect(page.getByRole('button',{name:'confirm sending',exact:true})).toBeVisible();
 await goal.fill('Changed goal');await expect(page.getByRole('button',{name:'confirm sending',exact:true})).toHaveCount(0);
});
