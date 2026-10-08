import {test,expect,type Page} from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('fitness.language','en'));});
async function next(page:Page){await page.getByRole('button',{name:'Next →',exact:true}).click();}
async function skip(page:Page){await page.getByRole('button',{name:/^Skip(?: remaining)?$/,exact:true}).click();}
test('ten stages, resume, exclusivity, wheel boundaries, summary edits and no measurement side effects',async({page})=>{
 const posts:string[]=[];await page.route('**/api/**',route=>{posts.push(route.request().url());return route.fulfill({status:503,json:{error:'CONTROL_UNAVAILABLE'}});});
 await page.goto('/');await expect(page).toHaveURL(/onboarding/);await page.getByRole('button',{name:'Female',exact:true}).click();await next(page);
 const age=page.getByRole('spinbutton',{name:'How old are you?'});await age.focus();await age.press('Home');await expect(age).toHaveAttribute('aria-valuenow','12');await age.press('End');await expect(age).toHaveAttribute('aria-valuenow','70');await next(page);
 await page.getByRole('button',{name:'Confirm value'}).nth(0).click();await page.getByRole('button',{name:'Confirm value'}).nth(0).click();await page.getByRole('button',{name:'Skip waist',exact:true}).click();await next(page);
 await page.getByRole('button',{name:'Build strength',exact:true}).click();await page.getByLabel('Custom goal').fill('Climb better');await next(page);
 await page.getByRole('button',{name:'Complete beginner',exact:true}).click();await page.getByLabel('Experience details').fill('Starting again');await next(page);
 await page.getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('button',{name:'Outdoors',exact:true}).click();await page.getByLabel('Other training venues').fill('Studio');await next(page);
 await page.getByLabel('Other equipment').fill('Rings');await next(page);
 await page.getByRole('button',{name:'No known limitations',exact:true}).click();await page.getByLabel('Other movement limitations').fill('Avoid jumping');await expect(page.getByRole('button',{name:'No known limitations',exact:true})).toHaveAttribute('aria-pressed','false');await next(page);
 const frequency=page.getByRole('spinbutton',{name:'Sessions per week'});await frequency.focus();await frequency.press('End');
 const hour=page.getByRole('spinbutton',{name:'Training start time'});await hour.focus();await hour.press('Home');await expect(hour).toHaveAttribute('aria-valuenow','0');
 await expect(page.getByRole('button',{name:'Next →'})).toBeDisabled();await expect(page.getByRole('button',{name:'Back',exact:true})).toBeEnabled();await expect.poll(()=>page.evaluate(async()=>{const g='/src/application/guided.ts';const{guidedService}=await import(/* @vite-ignore */g);return (await guidedService.read()).onboarding?.answers.schedule?.value;})).toEqual(['0','','7']);await page.reload();await expect(hour).toHaveAttribute('aria-valuenow','0');
 const duration=page.getByRole('spinbutton',{name:'Session duration'});await duration.focus();await duration.press('End');await expect(duration).toHaveAttribute('aria-valuenow','120');await next(page);
 await page.getByLabel('Other preferences (optional)').fill('Quiet music');await next(page);await expect(page.getByRole('heading',{name:'Your starting point.',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Edit 6',exact:true}).click();await expect(page.getByLabel('Other training venues')).toHaveValue('Studio');await expect(page.getByRole('button',{name:'Home',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(posts).toEqual([]);
 const result=await page.evaluate(async()=>{const p='/src/persistence/db.ts';const {database}=await import(/* @vite-ignore */p);return {weights:await database.bodyWeights.count(),state:await database.guidedStates.get('guided')};});expect(result.weights).toBe(0);expect(result.state.onboarding.answers.preferences.value).toBe('Quiet music');
});
test('leave for manual work, return, theme switching and minor AI isolation',async({page})=>{
 await page.goto('/');await skip(page);const age=page.getByRole('spinbutton');await age.press('Home');await next(page);
 await page.getByRole('button',{name:'Save progress and train manually'}).click();await expect(page).toHaveURL(/\/$/);await page.reload();await expect(page).toHaveURL(/\/$/);
 await page.getByRole('link',{name:'Continue or review onboarding'}).click();await expect(page.getByRole('heading',{name:'Basic body information'})).toBeVisible();
 for(const theme of ['serene','orbit','atlas']){await page.getByLabel('Switch layout',{exact:true}).selectOption(theme);await expect(page.getByRole('heading',{name:'Basic body information'})).toBeVisible();}
 for(let i=0;i<8;i++)await skip(page);await page.getByRole('button',{name:'Confirm profile',exact:true}).click();await expect(page).toHaveURL(/plans/);
 let calls=0;await page.route('**/api/**',route=>{if(route.request().method()==='POST')calls++;return route.fulfill({json:{expiresAt:Date.now()+86400000,used:{understand:0,generate:0},limits:{understand:8,generate:4},aiEnabled:true}});});
 await page.goto('/ai');await expect(page.getByText(/Adult AI is unavailable/)).toBeVisible();await expect(page.getByRole('button',{name:'Agree to send and understand goal',exact:true})).toBeDisabled();expect(calls).toBe(0);
});
