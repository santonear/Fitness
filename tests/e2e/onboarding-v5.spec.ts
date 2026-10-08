import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('fitness.language','en'));});
test('three metrics stay independent across touch, wheel, reload, skip and old progress',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Skip',exact:true}).click();await page.getByRole('button',{name:'Skip',exact:true}).click();
 const wheels=page.getByRole('spinbutton');await expect(wheels).toHaveCount(3);
 await expect(wheels.nth(0)).toHaveAttribute('aria-valuetext',/unconfirmed/);
 await wheels.nth(0).press('ArrowUp');await expect(wheels.nth(0)).toHaveAttribute('aria-valuenow','171');
 await wheels.nth(1).dispatchEvent('pointerdown',{pointerId:9,pointerType:'touch',clientY:200});await wheels.nth(1).dispatchEvent('pointermove',{pointerId:9,pointerType:'touch',clientY:170});await wheels.nth(1).dispatchEvent('pointerup',{pointerId:9,pointerType:'touch'});await expect(wheels.nth(1)).toHaveAttribute('aria-valuenow','71');
 await wheels.nth(2).hover();await page.mouse.wheel(0,100);await expect(wheels.nth(2)).toHaveAttribute('aria-valuenow','81');
 await page.getByRole('button',{name:'Skip waist',exact:true}).click();await expect(wheels.nth(2)).toHaveAttribute('aria-valuetext',/unconfirmed/);await page.getByRole('button',{name:'Next →'}).click();await expect(page.getByRole('heading',{name:'What are your training goals?'})).toBeVisible();await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.getByRole('heading',{name:'Basic body information'})).toBeVisible();await page.reload();
 await expect(wheels.nth(0)).toHaveAttribute('aria-valuenow','171');await expect(wheels.nth(1)).toHaveAttribute('aria-valuenow','71');await expect(wheels.nth(2)).toHaveAttribute('aria-valuetext',/unconfirmed/);
 const data=await page.evaluate(async()=>{const g='/src/application/guided.ts';const {guidedService}=await import(/* @vite-ignore */g);const s=await guidedService.read();await guidedService.saveV4(s.onboarding.answers,4,s.revision);return s.onboarding;});expect(data.answers.waistCm.status).toBe('skipped');
 await page.reload();await expect(page.getByRole('heading',{name:'Basic body information'})).toBeVisible();await expect(page.locator('.ob4-progress')).toContainText('3 / 10');
});
for(const theme of ['atlas','serene','orbit'])test(`${theme} ceramic navigation and triple metrics in four viewports`,async({page},testInfo)=>{
 await page.goto('/settings');await page.getByLabel('Switch layout',{exact:true}).selectOption(theme);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:950});const nav=width<761?page.locator('.v31-mobile-nav'):page.locator('.app-sidebar nav');
  await expect(nav.locator('.ceramic-svg')).toHaveCount(5);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const first=nav.getByRole('link').last();await first.hover();await first.focus();await expect(first).toBeFocused();
  const size=await nav.locator('.ceramic-svg').first().boundingBox();expect(size!.width).toBeGreaterThanOrEqual(48);
  await page.screenshot({path:`outputs/onboarding-v5/nav-${theme}-${testInfo.project.name}-${width}.png`,fullPage:true});
  if(width===390){const box=(await first.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await expect(first.locator('svg')).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 2)');await page.screenshot({path:`outputs/onboarding-v5/pressed-${theme}-${testInfo.project.name}.png`});await page.mouse.up();}
 }
 await page.goto('/onboarding');await page.getByRole('button',{name:'Skip',exact:true}).click();await page.getByRole('button',{name:'Skip',exact:true}).click();
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:950});await expect(page.getByRole('spinbutton')).toHaveCount(3);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const boxes=await page.getByRole('spinbutton').all();const rects=await Promise.all(boxes.map(b=>b.boundingBox()));expect(rects[0]!.y).toBe(rects[1]!.y);expect(rects[1]!.y).toBe(rects[2]!.y);
  await page.screenshot({path:`outputs/onboarding-v5/body-${theme}-${testInfo.project.name}-${width}.png`,fullPage:true});
 }
 const ids=await page.locator('svg defs [id]').evaluateAll(nodes=>nodes.map(n=>n.id));expect(new Set(ids).size).toBe(ids.length);
});
test('failed local save retains selected input and prevents advancement',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Skip',exact:true}).click();await page.getByRole('button',{name:'Skip',exact:true}).click();
 await page.evaluate(async()=>{const p='/src/application/guided.ts';const {guidedService}=await import(/* @vite-ignore */p);guidedService.saveV4=async()=>{throw new Error('TEST_STORAGE_FAILURE');};});
 await page.getByRole('spinbutton',{name:'Height',exact:true}).press('ArrowUp');await expect(page.getByRole('alert')).toContainText('TEST_STORAGE_FAILURE');await expect(page.getByRole('spinbutton',{name:'Height',exact:true})).toHaveAttribute('aria-valuenow','171');await expect(page.getByRole('button',{name:'Next →'})).toBeDisabled();
});
test('local vectors render at high DPI without remote icon dependencies',async({browser,baseURL})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});const page=await context.newPage();const remote:string[]=[];page.on('request',r=>{if(!r.url().startsWith(baseURL!))remote.push(r.url());});await page.goto('/settings');await expect(page.locator('.v31-mobile-nav svg')).toHaveCount(5);expect(await page.evaluate(()=>devicePixelRatio)).toBe(2);await page.screenshot({path:`outputs/onboarding-v5/retina-${browser.browserType().name()}.png`});expect(remote.filter(x=>/\.(svg|png|woff)/.test(x))).toEqual([]);await context.close();
});

