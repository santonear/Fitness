import { completedPlanningProfile } from './planning-profile-fixture';
import {test,expect} from '@playwright/test';
test('dashboard shows empty data and updates only after recorded completion',async({page})=>{
 await completedPlanningProfile(page);await page.goto('/');
 const analytics=page.locator('.v31-card').filter({has:page.getByRole('heading',{name:'Last 30 days',exact:true})});await expect(analytics.locator('.v31-stat').first()).toHaveText('0');
 await page.goto('/workout');await page.getByRole('button',{name:'Start temporary workout',exact:true}).click();
 await page.getByLabel('Reps',{exact:true}).fill('12');await page.getByLabel('Load (kg)',{exact:true}).fill('2.5');
 await page.getByRole('button',{name:'Record set',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Set saved');
 await page.getByRole('button',{name:'Review completion',exact:true}).click();await page.getByRole('button',{name:'Confirm completion',exact:true}).click();await expect(page.getByRole('status').filter({hasText:/^(Workout completed|训练已完成)$/})).toHaveText('Workout completed');
 await completedPlanningProfile(page);await page.goto('/');
 await expect(analytics.locator('.v31-stat').first()).toHaveText('1');
 await page.reload();
 await expect(analytics.locator('.v31-stat').first()).toHaveText('1');
});
