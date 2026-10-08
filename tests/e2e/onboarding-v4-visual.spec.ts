import {test,expect} from '@playwright/test';
for(const theme of ['atlas','serene','orbit'])test(`${theme} seven widths and bilingual immersive questions`,async({page},testInfo)=>{
 await page.addInitScript(theme=>{localStorage.setItem('fitness.language','zh');localStorage.setItem('fitness-appearance-v31',theme);},theme);await page.goto('/');
 for(const width of [320,375,390,420,768,1024,1440]){
  await page.setViewportSize({width,height:900});await expect(page.getByRole('heading',{name:'你的性别是？'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await page.locator('.ob4-options button').first().boundingBox())!.width).toBeGreaterThan(110);
  if(width<768)await expect(page.getByRole('navigation',{name:'底部导航'})).toBeHidden();
  if(width===390||width===768||width===1440)await page.screenshot({path:`outputs/onboarding-v5/${theme}-${testInfo.project.name}-${width}.png`,fullPage:true});
 }
 await page.getByLabel('语言',{exact:true}).selectOption('en');await expect(page.getByRole('heading',{name:'What is your sex?'})).toBeVisible();
});
