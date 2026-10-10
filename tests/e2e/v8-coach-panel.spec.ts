import {test,expect} from '@playwright/test';
test('explicit send omits optional data, validates response, and keeps draft when closed',async({page})=>{
 let sent:any;
 await page.route('**/api/v1/plans/generate',async route=>{sent=route.request().postDataJSON();await route.fulfill({json:{requestId:sent.requestId,context:{restoreGeneration:0,inputDigest:sent.sendConfirmation},accounting:'settled',result:{requestId:sent.requestId,restoreGeneration:0,mutationAllowed:false,type:'clarify',question:'想在哪里练？'}}});});
 await page.goto('/tests/fixtures/v8-coach/index.html');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();
 await page.getByRole('textbox',{name:'跟芽芽说'}).fill('想在家练');await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.getByText('想在哪里练？')).toBeVisible();expect(sent.coach.body).toBeUndefined();expect(sent.coach.history).toBeUndefined();
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();await expect(page.getByRole('textbox',{name:'跟芽芽说'})).toHaveValue('想在家练');await expect(page.getByText('想在哪里练？')).toBeVisible();
});
for(const width of [390,1440])test(`coach qingci ${width}`,async({page})=>{await page.setViewportSize({width,height:844});await page.goto('/tests/fixtures/v8-coach/index.html');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();await page.waitForTimeout(600);await page.screenshot({path:`outputs/v8-coach/qingci-${width}.png`});});
