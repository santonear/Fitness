import { test, expect } from '@playwright/test';
test('calendar mouse cancellation and keyboard selection never save plans',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.clock.setFixedTime(new Date('2028-02-15T12:00:00Z'));await page.goto('/plans');await page.getByRole('button',{name:'View month / day timeline and adjust training time',exact:true}).click();
 const calendar=page.getByRole('region',{name:'training calendar',exact:true});
 await calendar.getByRole('button',{name:'select multiple days',exact:true}).click();
 const cell=(date:string)=>calendar.locator(`[data-calendar-date="${date}"]`);
 await cell('2028-02-28').scrollIntoViewIfNeeded();const a=await cell('2028-02-28').boundingBox(),b=await cell('2028-02-29').boundingBox();
 await page.mouse.move(a!.x+a!.width/2,a!.y+a!.height/2);await page.mouse.down();await page.mouse.move(b!.x+b!.width/2,b!.y+b!.height/2);
 await expect(cell('2028-02-29')).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('Escape');await page.mouse.up();await expect(cell('2028-02-28')).toHaveAttribute('aria-pressed','false');
 await cell('2028-02-28').focus();await page.keyboard.press('Space');await page.keyboard.press('ArrowRight');await expect(cell('2028-02-29')).toBeFocused();await page.keyboard.press('Enter');
 await expect(cell('2028-02-28')).toHaveAttribute('aria-pressed','true');await expect(cell('2028-02-29')).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(async()=>{const {database}=await import(String('/src/persistence/db.ts'));return [await database.plans.count(),await database.sessions.count()];})).toEqual([0,0]);
});
test('loaded offline calendar remains navigable and does not create facts',async({page,context})=>{
 await page.goto('/plans');await page.getByRole('button',{name:'View month / day timeline and adjust training time',exact:true}).click();const calendar=page.getByRole('region',{name:'training calendar',exact:true});await expect(calendar).toBeVisible();
 const before=await calendar.getByRole('heading',{level:2}).textContent();
 await context.route(/^https?:\/\//,route=>route.abort('internetdisconnected'));
 await calendar.getByRole('button',{name:'next month',exact:true}).click();await expect(calendar.getByRole('heading',{level:2})).not.toHaveText(before!);
 await calendar.getByRole('button',{name:'day',exact:true}).click();await expect(calendar.locator('.calendar-hour')).toHaveCount(24);
 expect(await page.evaluate(async()=>{const {database}=await import(String('/src/persistence/db.ts'));return [await database.plans.count(),await database.sessions.count()];})).toEqual([0,0]);
});
