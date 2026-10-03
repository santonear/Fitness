import { test, expect } from '@playwright/test';
test.use({locale:'en-US'});
test('timer writes guard revisions and association without creating training facts',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{const path='/tests/e2e/helpers/timers-browser.ts';return (await import(/* @vite-ignore */ path)).verifyTimerWrites(`fitness-test-timer-${crypto.randomUUID()}`);});
 expect(result).toEqual({count:1,conflicts:1,invalid:true,moved:true,readonly:true,sets:0,memoSets:0});
});
test('exercise timer resumes after refresh and stopping only fills editable duration',async({page})=>{
 await page.goto('/');await page.getByLabel('Choose exercise').selectOption('d16325d9-fc00-4c41-88a1-000000000002');
 await page.getByRole('button',{name:'Start temporary workout',exact:true}).click();
 await page.getByRole('button',{name:'Start exercise timer',exact:true}).click();
 await expect(page.getByText('Timer saved',{exact:true})).toBeVisible();await page.reload();
 await expect(page.getByRole('button',{name:'Pause timer',exact:true})).toBeVisible();
 await page.waitForTimeout(1100);
 await page.getByRole('button',{name:'Stop timer',exact:true}).click();
 await expect(page.getByLabel('Duration (seconds)')).not.toHaveValue('');
 await expect(page.getByLabel('Distance (km, optional)')).toBeVisible();
 await expect(page.getByRole('button',{name:'Update set',exact:true})).toHaveCount(0);
 await page.reload();await expect(page.getByRole('button',{name:'Update set',exact:true})).toHaveCount(0);
});
test('rest completion stays visible when explicitly enabled sound fails',async({page})=>{
 await page.addInitScript(()=>{HTMLMediaElement.prototype.play=()=>Promise.reject(new Error('blocked'));});
 await page.goto('/');await page.getByRole('button',{name:'Start temporary workout',exact:true}).click();
 await page.getByLabel('Enable reminder sound').check();
 await page.getByLabel('Rest seconds').fill('1');await page.getByRole('button',{name:'Start rest timer',exact:true}).click();
 await expect(page.getByText('Rest finished',{exact:true})).toBeVisible();
 await expect(page.getByText('Sound unavailable; visual reminder remains',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Update set',exact:true})).toHaveCount(0);
});
