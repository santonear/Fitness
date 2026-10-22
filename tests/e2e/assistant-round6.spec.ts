import {test,expect} from '@playwright/test';
test('extended onboarding duration and equipment produce a genuinely hour-long plan',async({page})=>{
 await page.goto('/tests/fixtures/v8-coach/index.html');
 const result=await page.evaluate(async()=>{
  const profileModule='/src/application/rules/local-profile.ts',workflowModule='/src/application/v8-workflow.ts';
  const {localProfile}=await import(/* @vite-ignore */ profileModule),{basicProposal}=await import(/* @vite-ignore */ workflowModule);
  const profile=localProfile({goalText:'减脂',scheduleOriginalText:'每周4次，每次15分钟，可以延长到1小时',placeEquipmentText:'在家，有哑铃',adultConfirmed:true,cautions:[]});
  return {profile,plan:basicProposal(profile)};
 });
 expect(result.profile.sessionMinutes).toBe(60);expect(result.profile.equipment).toContain('dumbbell');expect(result.plan.templates).toHaveLength(2);
 for(const template of result.plan.templates){expect(template.estimatedMinutes).toBeGreaterThanOrEqual(54);expect(template.estimatedMinutes).toBeLessThanOrEqual(66);}
});
test('AI switch off keeps the modern panel local and makes zero model requests',async({page})=>{
 let calls=0;await page.route('**/api/v1/features',r=>r.fulfill({json:{version:1,flags:{aiAssistantV2:false},expiresAt:Date.now()+60000}}));
 await page.route('**/api/v1/assistant/chat',r=>{calls++;return r.fulfill({status:503,json:{error:'AI_DISABLED'}});});
 await page.goto('/tests/fixtures/v8-coach/index.html');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();
 await page.getByRole('textbox').fill('时间不够');await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.getByRole('log')).not.toBeEmpty();await expect(page.locator('.assistant-panel')).toContainText('现在用的是本地建议');expect(calls).toBe(0);
});
for(const theme of ['pop', 'vivid', 'gentle', 'data', 'fire'])for(const width of [375,1280])test(`round6 panel ${theme} ${width} @screens`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await page.goto('/tests/fixtures/v8-coach/index.html');
 await page.addStyleTag({url:`/src/themes/${theme}/tokens.css`});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
 await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();await expect(page.locator('.assistant-panel')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(info.project.name==='chromium')await page.screenshot({path:`test-results-review/assistant-round6/${theme}-${width}.png`,fullPage:true});
});
test('admin presents one assistant settings card and preserves confirmation and service gates',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('fitness.language','zh'));
 const config={dailyMessageLimit:30,quotaUnderstand:8,quotaGenerate:4,monthlyBudgetFen:3000,reservationFen:300,maxConcurrent:1,retentionDays:30};const calls:string[]=[];let enabled=true;
 await page.route('**/api/v1/features',r=>r.fulfill({json:{version:1,flags:{adminConsole:true,aiAssistantV2:true},expiresAt:Date.now()+60000}}));
 await page.route('**/api/v1/management/console/**',r=>{
  const path=new URL(r.request().url()).pathname.split('/console/')[1];if(r.request().method()==='POST'){calls.push(path);if(path==='users/action')enabled=r.request().postDataJSON().enabled;return r.fulfill({json:{ok:true}});}
  const json=path==='finance/config'?{current:{version:1,config},history:[],defaults:config}:path==='users/status'?{aiEnabled:enabled}:path==='session'?{fresh:true,environment:'preview'}:path==='releases'?{environment:'preview',features:[{name:'aiAssistantV2',states:[{environment:'preview',enabled,pending:false}]}],prompts:[],registeredPromptVersions:['assistant-v3.1.0','assistant-v3.0.0','assistant-v2.1.0'],promptTasks:['ONBOARD_PLAN','ADJUST_TODAY','MODIFY_PLAN','PERIOD_REVIEW','ASSISTANT_CHAT'],registered:[],releases:[],smoke:[],history:[]}:path==='finance/announcement'?{announcement:null}:{items:[],subscriptions:[],available:false};
  return r.fulfill({json});
 });
 await page.goto('/admin/settings');const card=page.getByRole('heading',{name:'芽芽AI助手',exact:true}).locator('..');await expect(card).toBeVisible();await expect(card.getByRole('combobox')).toHaveCount(1);await expect(card.getByLabel('每人每天消息上限')).toHaveValue('30');await expect(page.getByRole('heading',{name:'AI 服务开关'})).toHaveCount(0);
 await expect(card).toContainText('当前：开启');await card.getByRole('button',{name:'关闭 AI',exact:true}).click();expect(calls).toEqual([]);await page.getByRole('dialog').getByRole('button',{name:'确认',exact:true}).click();await expect.poll(()=>calls).toEqual(['releases/flags','users/action']);
 await expect(card.getByRole('button',{name:'开启 AI',exact:true})).toBeVisible();await expect(card).toContainText('当前：关闭（AI 服务已关闭）');
 for(const width of [375,1280]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results-review/assistant-round6/admin-${width}.png`,fullPage:true});}
});
