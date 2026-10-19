import {test,expect,type Page} from '@playwright/test';
import {answerText,answerTexts,cautions,ensurePressed,generate,nextButton,startOnboarding} from './helpers/onboarding-v9';
async function enable(page:Page,theme='pop'){
 await page.addInitScript(theme=>localStorage.setItem('fitness-theme',theme),theme);
 await page.route('**/api/v1/features',route=>route.fulfill({json:{version:1,flags:{bodyProfile:true,themeDiscovery:true,planLifecycle:true},expiresAt:Date.now()+60000}}));
 await page.route('**/api/v1/trial/access-status',route=>route.fulfill({json:{qualification:'none',sessionValid:false,aiEnabled:false}}));
}
async function bodyStep(page:Page){await startOnboarding(page);await answerText(page,'想有些力量');await expect(page.getByRole('heading',{name:'身体情况',exact:true})).toBeVisible()}
async function draft(page:Page){await nextButton(page).click();await answerTexts(page,['每周2次，每次30分钟','在家，只有瑜伽垫']);await ensurePressed(page,'我已年满 18 岁');await nextButton(page).click();await page.getByRole('radio',{name:'有，选一下部位'}).click();for(const part of ['膝盖','肩','手腕'])await page.getByRole('button',{name:part,exact:true}).click();await nextButton(page).click();await generate(page);await expect(page.getByRole('button',{name:'就用这份计划'})).toBeVisible();}
for(const theme of ['pop', 'vivid', 'gentle', 'data', 'fire'])for(const width of [375,1280])test(`body and draft ${theme} ${width}`,async({page},info)=>{
 await enable(page,theme);await page.setViewportSize({width,height:900});await bodyStep(page);
 await expect(page.getByRole('button',{name:'下一步',exact:true})).toBeDisabled();await expect(page.getByRole('status')).toContainText('再告诉我');
 await page.getByLabel('说说你的身体情况').fill('男，34岁，167，70公斤');await expect(page.getByRole('button',{name:'身高（厘米） · 167 厘米',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'下一步',exact:true})).toBeEnabled();
 await page.screenshot({path:`outputs/production-review/body-${theme}-${width}-${info.project.name}.png`,fullPage:true});
 await page.reload();await expect(page.getByLabel('说说你的身体情况')).toHaveValue('男，34岁，167，70公斤');
 await draft(page);await expect(page.locator('.v9-session').first()).toBeVisible();await expect(page.getByText('已按你选的注意部位换掉了部分动作。',{exact:false})).toBeVisible();await page.locator('.v9-session summary').first().click();
 const card=page.locator('button.v9-item').first();expect(await card.evaluate(e=>parseFloat(getComputedStyle(e).paddingLeft))).toBeGreaterThan(0);await expect(card.locator('button')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.screenshot({path:`outputs/production-review/draft-${theme}-${width}-${info.project.name}.png`,fullPage:true});await card.click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();await expect(card).toBeFocused();
 await page.getByRole('button',{name:'修改注意部位'}).click();await expect(page.getByRole('button',{name:'膝盖',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('body rollers, weight append, backup roundtrip and explicit deletion',async({page})=>{
 await enable(page);await bodyStep(page);await page.getByLabel('说说你的身体情况').fill('不愿透露，34岁，167，70公斤');
 await page.getByRole('button',{name:'体重（公斤） · 70 公斤'}).click();const wheel=page.getByRole('listbox');await wheel.focus();await page.keyboard.press('ArrowDown');await page.getByRole('button',{name:'就用这个'}).click();await expect(page.getByRole('button',{name:'体重（公斤） · 71 公斤'})).toBeVisible();
 await draft(page);await page.getByRole('button',{name:'就用这份计划'}).click();await page.goto('/settings/body');await expect(page.getByRole('heading',{name:'体重记录'})).toBeVisible();await page.getByRole('button',{name:'体重（公斤） · 71 公斤'}).click();await page.getByRole('listbox').focus();await page.keyboard.press('ArrowDown');await page.getByRole('button',{name:'就用这个'}).click();await page.getByRole('button',{name:'保存身体资料'}).click();await expect(page.getByRole('status')).toHaveText('身体资料已保存');
 const result=await page.evaluate(async()=>{const rp='/src/persistence/repository.ts',bp='/src/application/backup.ts',repo=(await import(/* @vite-ignore */ rp)).repository,service=(await import(/* @vite-ignore */ bp)).createBackupService(repo);const backup=JSON.parse(await(await service.exportBackup()).text());const input=await service.validateBackup(new File([JSON.stringify(backup)],'body.json'));await service.importBackup(input,{backupExported:true,replacementConfirmed:true,expectedRevision:input.expectedRevision});return {before:backup.data.bodyWeights,after:await repo.db.bodyWeights.toArray(),body:(await repo.db.profiles.toCollection().first()).bodyDetails,plans:backup.data.v8.plans}});expect(result.before.map((r:any)=>r.weightGrams).sort()).toEqual([71000,72000]);expect(result.after).toEqual(result.before);expect(result.body.values.biologicalSex).toBe('不愿透露');
 await page.goto('/settings/body');await page.getByRole('button',{name:'全部删除',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('训练记录和计划会保留');await page.getByRole('dialog').getByRole('button',{name:'全部删除',exact:true}).click();await expect(page.getByRole('status')).toHaveText('身体资料和体重记录已删除');
 const after=await page.evaluate(async()=>{const rp='/src/persistence/repository.ts',repo=(await import(/* @vite-ignore */ rp)).repository;return {weights:await repo.db.bodyWeights.count(),body:(await repo.db.profiles.toCollection().first()).bodyDetails.values,plans:await repo.db.v8Plans.toArray()}});expect(after.weights).toBe(0);expect(after.body).toEqual({});expect(after.plans).toEqual(result.plans);
});

test('legacy body migration requires confirmation and sending remains per field',async({page})=>{
 await enable(page);await page.goto('/');await expect(page.getByRole('button',{name:'开始',exact:true})).toBeVisible();
 const {readFileSync}=await import('node:fs');const backup=JSON.parse(readFileSync('tests/fixtures/legacy-backups/v5-onboarding.json','utf8'));
 await page.evaluate(async backup=>{const p='/src/application/backup.ts',service=(await import(/* @vite-ignore */ p)).backupService;const input=await service.validateBackup(new File([JSON.stringify(backup)],'legacy.json'));await service.importBackup(input,{backupExported:true,replacementConfirmed:true,expectedRevision:input.expectedRevision})},backup);
 await page.goto('/settings');await page.getByRole('combobox').selectOption('zh');await expect(page.getByText('找到了你以前填写的身体资料，请核对后确认。',{exact:true})).toBeVisible();await page.getByRole('button',{name:'身体资料',exact:true}).last().click();await expect(page.getByRole('heading',{name:'身体资料',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'保存身体资料'}).click();await expect(page.getByRole('status')).toHaveText('身体资料已保存');await page.goto('/settings');await expect(page.getByText('找到了你以前填写的身体资料，请核对后确认。',{exact:true})).toHaveCount(0);
 // Fresh complete plan, with the confirmed canonical details retained.
 await page.getByRole('button',{name:'生成新计划',exact:true}).click();await answerText(page,'保持力量');await page.getByLabel('说说你的身体情况').fill('男，34岁，167，70公斤，腰围80厘米');await draft(page);await page.getByRole('button',{name:'就用这份计划'}).click();
 await page.route('**/api/v1/trial/access-status',route=>route.fulfill({json:{qualification:'active',sessionValid:true,expiresAt:Date.now()+86400000,aiEnabled:true,planningBudgetDisabled:true}}));
 await page.evaluate(async()=>{const p='/src/application/feature-flags.ts';await(await import(/* @vite-ignore */ p)).refreshFeatureFlags(async()=>Response.json({version:1,flags:{bodyProfile:true,aiAssistantV2:true},expiresAt:Date.now()+60000}));});
 let sent:any;await page.route('**/api/v1/assistant/chat',route=>{sent=route.request().postDataJSON().context;return route.fulfill({status:503,json:{error:'AI_DISABLED'}})});
 await page.getByRole('button',{name:'和芽芽聊聊',exact:true}).click();const dialog=page.getByRole('dialog');const fieldset=dialog.getByRole('group',{name:'发送身体资料'});await expect(fieldset.getByRole('checkbox')).toHaveCount(5);for(const box of await fieldset.getByRole('checkbox').all())await expect(box).not.toBeChecked();await expect(fieldset).toContainText('来自你的身体资料');await expect(fieldset).not.toContainText('biologicalSex');await expect(fieldset).not.toContainText('waistCm');await fieldset.getByLabel(/腰围（厘米）/).check();await dialog.getByRole('textbox').fill('今天少练一点');await dialog.getByRole('button',{name:'发送',exact:true}).click();await expect.poll(()=>sent?.body).toEqual({waistCm:80});expect(sent.history).toBeUndefined();
});


test('known minor cannot confirm adult access and may continue manually',async({page})=>{
 await enable(page);await bodyStep(page);await page.getByLabel('说说你的身体情况').fill('女，12岁，150，40公斤');await page.getByRole('button',{name:'下一步',exact:true}).click();
 await answerTexts(page,['每周2次，每次30分钟','在家，瑜伽垫']);
 await expect(page.getByRole('button',{name:'我已年满 18 岁'})).toBeDisabled();await expect(nextButton(page)).toBeDisabled();await expect(page.getByRole('button',{name:'先自己练练'})).toBeEnabled();
});
test('four-week weight entry is optional and dismissed across reloads; stale body cannot be sent',async({page})=>{
 await enable(page);await bodyStep(page);await page.getByLabel('说说你的身体情况').fill('男，34岁，167，70公斤');await draft(page);await page.getByRole('button',{name:'就用这份计划'}).click();
 const staleRejected=await page.evaluate(async()=>{const p='/src/persistence/repository.ts',b='/src/application/body-profile.ts',repo=(await import(/* @vite-ignore */ p)).repository,service=(await import(/* @vite-ignore */ b)).bodyProfileService;const profile=await repo.db.profiles.toCollection().first();await repo.db.profiles.put({...profile,bodyDetails:{...profile.bodyDetails,weightPromptAt:new Date(Date.now()-29*86400000).toISOString()}});try{await service.validateSending({weightKg:69});return false}catch{return true}});expect(staleRejected).toBe(true);
 await page.goto('/review');await expect(page.getByRole('button',{name:'体重有变化吗？',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('button',{name:'先不更新',exact:true}).click();await expect(page.getByRole('button',{name:'体重有变化吗？',exact:true})).toHaveCount(0);await page.reload();await expect(page.getByRole('button',{name:'体重有变化吗？',exact:true})).toHaveCount(0);
});
