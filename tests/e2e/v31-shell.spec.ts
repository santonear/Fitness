import {expect,test} from '@playwright/test';
test.use({locale:'en-US'});
test('themes preserve active workout inputs and identity, persist, and do not call AI',async({page})=>{
  const posts:string[]=[];page.on('request',request=>{if(request.method()==='POST')posts.push(request.url())});
  await page.goto('/workout');await page.getByRole('button',{name:'Start temporary workout',exact:true}).click();
  await page.getByLabel('Reps',{exact:true}).fill('12');await page.getByLabel('Load (kg)',{exact:true}).fill('2.5');
  const identity=await page.evaluate(async()=>{const path='/src/persistence/db.ts';return (await(await import(/* @vite-ignore */path)).database.sessions.toArray())[0].id});
  for(const theme of ['serene','orbit','atlas']){await page.getByLabel('Switch layout',{exact:true}).selectOption(theme);await expect(page.getByLabel('Reps',{exact:true})).toHaveValue('12');await expect(page.getByLabel('Load (kg)',{exact:true})).toHaveValue('2.5')}
  await page.getByRole('button',{name:'Record set',exact:true}).click();await expect(page.getByRole('status')).toContainText('Set saved');
  await page.getByLabel('Switch layout',{exact:true}).selectOption('orbit');await page.reload();await expect(page.getByLabel('Switch layout',{exact:true})).toHaveValue('orbit');await expect(page.getByText('12 reps · 2.5 kg')).toBeVisible();
  expect(await page.evaluate(async()=>{const path='/src/persistence/db.ts';return (await(await import(/* @vite-ignore */path)).database.sessions.toArray())[0].id})).toBe(identity);
  expect(posts).toEqual([]);
});
test('four-step backup keeps consent guards and synchronizes restored profile across tabs',async({page,context})=>{
  await page.goto('/settings?tab=profile');await page.getByLabel('Goal',{exact:true}).fill('Portable V3 profile');await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Profile saved');
  await page.getByRole('tab',{name:'Backup & restore',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON backup',exact:true}).click();const filePath=await(await downloadPromise).path();expect(filePath).toBeTruthy();
  const other=await context.newPage();await other.goto(new URL('/settings?tab=profile',page.url().replace('127.0.0.1','localhost')).href);
  await expect(other.getByLabel('Goal',{exact:true})).toHaveValue('');
  const sibling=await context.newPage();await sibling.goto(new URL('/settings?tab=profile',other.url()).href);await sibling.getByLabel('Goal',{exact:true}).fill('stale unsaved draft');
  await other.getByRole('tab',{name:'Backup & restore',exact:true}).click();await other.getByLabel('Restore JSON file',{exact:true}).setInputFiles(filePath!);
  await other.getByRole('button',{name:'Next: keep current data',exact:true}).click();await expect(other.getByRole('button',{name:'Next: confirm replacement',exact:true})).toBeDisabled();
  const currentDownload=other.waitForEvent('download');await other.getByRole('button',{name:'Download current data before replacement',exact:true}).click();await currentDownload;
  await other.getByLabel('I have downloaded and kept the current backup',{exact:true}).check();await other.getByRole('button',{name:'Next: confirm replacement',exact:true}).click();await expect(other.getByRole('button',{name:'Replace local data',exact:true})).toBeDisabled();
  await other.getByLabel('I confirm replacing all local data',{exact:true}).check();await other.getByRole('button',{name:'Replace local data',exact:true}).click();
  await expect(other.getByTestId('restore-result')).toHaveText('Restore succeeded.');await expect(other.getByRole('heading',{name:'Restore complete',exact:true})).toBeVisible();
  await other.getByRole('tab',{name:'Profile & preferences',exact:true}).click();await expect(other.getByLabel('Goal',{exact:true})).toHaveValue('Portable V3 profile');await expect(sibling.getByLabel('Goal',{exact:true})).toHaveValue('Portable V3 profile');
});
test('loaded local workout can save a set offline',async({page,context})=>{
  await page.goto('/workout');await page.getByRole('button',{name:'Start temporary workout',exact:true}).click();await context.setOffline(true);
  await page.getByLabel('Reps',{exact:true}).fill('6');await page.getByLabel('Load (kg)',{exact:true}).fill('1');await page.getByRole('button',{name:'Record set',exact:true}).click();await expect(page.getByRole('status')).toContainText('Set saved');await context.setOffline(false);
});
