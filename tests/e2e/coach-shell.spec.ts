import {test,expect} from '@playwright/test';
import {completedPlanningProfile} from './planning-profile-fixture';
for(const theme of ['atlas','serene','orbit'])test(`${theme}: persistent global coach, docking, focus and responsive layouts`,async({page})=>{
 let posts=0;
 await page.addInitScript(theme=>{localStorage.setItem('fitness.language','en');localStorage.setItem('fitness-appearance-v31',theme)},theme);
 await page.route('**/api/v1/**',r=>{if(r.request().method()!=='GET')posts++;return r.fulfill({json:{expiresAt:Date.now()+86400000,period:'2026-10',used:{understand:0,generate:0},limits:{understand:8,generate:4},pending:0,aiEnabled:true}})});
 await completedPlanningProfile(page);await page.goto('/plans');
 const launch=page.getByRole('button',{name:'Open AI coach',exact:true});await expect(launch).toHaveCount(1);await launch.click();
 const dialog=page.getByRole('dialog',{name:'AI coach conversation'});await expect(dialog).toBeVisible();
 const goal=page.getByRole('textbox',{name:'Training goal and constraints'});await goal.fill('Preserve this unsent goal');
 await page.getByRole('button',{name:'Close coach conversation'}).click();await expect(launch).toBeFocused();
 await page.locator('.v31-mobile-nav a[href="/progress"]').click();await expect(page).toHaveURL(/\/progress$/);await expect(page.locator('.v31-metric-grid')).toHaveAttribute('aria-busy','false');await launch.click();await expect(dialog).toBeVisible();await expect(goal).toHaveValue('Preserve this unsent goal');
 await expect(dialog).toBeFocused();await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await page.getByRole('button',{name:'Dock to edge'}).click();await launch.click();await expect(dialog).toBeVisible();await expect(goal).toHaveValue('Preserve this unsent goal');
 for(const width of [320,375,390,420,768,1024,1440]){await page.setViewportSize({width,height:900});await expect(dialog).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);await page.screenshot({path:`outputs/v62-coach/${theme}-${width}-${test.info().project.name}.png`});}
 await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.press('Escape');await launch.click();await page.getByRole('button',{name:'Switch dock side'}).click();await page.getByRole('button',{name:'Expand coach avatar'}).click();await page.keyboard.press('Escape');await expect(page.locator('.coach-root')).toHaveAttribute('data-side','left');expect(posts).toBe(0);await page.screenshot({path:"outputs/v62-coach/"+theme+"-launcher-"+test.info().project.name+".png"});
});
test('global entry preserves unfinished onboarding gate',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('fitness.language','en'));
 await page.goto('/settings');await page.getByRole('button',{name:'Open AI coach',exact:true}).click();await expect(page).toHaveURL(/onboarding/);await expect(page.locator('.coach-root')).toBeHidden();
});
