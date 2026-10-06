import {test,expect} from '@playwright/test';
test('dashboard shows empty data and updates only after recorded completion',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'view your dashboard first'}).click();
 const analytics=page.getByRole('region',{name:'training analytics',exact:true});await expect(analytics.getByText('no completed records to analyse yet.').first()).toBeVisible();
 await page.goto('/workout');await page.getByRole('button',{name:'Start temporary workout',exact:true}).click();
 await page.getByLabel('Reps',{exact:true}).fill('12');await page.getByLabel('Load (kg)',{exact:true}).fill('2.5');
 await page.getByRole('button',{name:'Record set',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Set saved');
 await page.getByRole('button',{name:'Review completion',exact:true}).click();await page.getByRole('button',{name:'Confirm completion',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Workout completed');
 await page.goto('/');await page.getByRole('button',{name:'view your dashboard first'}).click();
 await expect(analytics.locator('.analytics-kpis article').filter({has:page.getByRole('heading',{name:'completed workouts',exact:true})}).locator('strong')).toHaveText('1');
 await page.reload();await page.getByRole('button',{name:'view your dashboard first'}).click();
 await expect(analytics.locator('.analytics-kpis article').filter({has:page.getByRole('heading',{name:'completed workouts',exact:true})}).locator('strong')).toHaveText('1');
});
