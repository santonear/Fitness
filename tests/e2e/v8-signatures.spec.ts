import {expect,test} from '@playwright/test';
for(const theme of ['liubai','jingshe','zhuangse']) test(`${theme} signatures preserve actions and stop training motion`,async({page})=>{
 await page.goto('/tests/fixtures/v8-signatures/index.html');await page.getByLabel('主题').selectOption(theme);
 await page.getByRole('button',{name:'开始训练'}).click();await expect(page.locator('output')).toHaveText('开始');await page.getByRole('button',{name:'修改本组'}).click();await expect(page.locator('output')).toHaveText('修改');
 await expect(page.locator('.v8-feature')).toHaveAttribute('data-motion','on');await page.getByRole('button',{name:'训练状态'}).click();await expect(page.locator('.v8-feature')).toHaveAttribute('data-motion','off');
 expect(await page.locator('.v8-feature').evaluate(el=>getComputedStyle(el,'::before').animationName)).toBe('none');
 expect(await page.locator('.v8-feature').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await expect(page.locator('.v8-rest time')).toHaveText('2:05');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
for(const width of [390,1440]) test(`qingci signatures ${width}`,async({page})=>{await page.setViewportSize({width,height:1000});await page.goto('/tests/fixtures/v8-signatures/index.html');await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`outputs/v8-signatures/qingci-${width}.png`});});
