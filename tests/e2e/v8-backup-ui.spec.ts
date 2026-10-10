import { expect, test } from '@playwright/test';
test('V8 JSON download and File restore cross origins and reset a sibling without BroadcastChannel', async ({page,context})=>{
 await context.addInitScript(()=>localStorage.setItem('fitness.language','en'));
 await page.goto('/settings');await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
 await page.evaluate(async()=>{const p='/src/application/profile.ts';const service=(await import(/* @vite-ignore */ p)).profileService;const profile=await service.getProfile();await service.saveProfile({locale:profile.locale,timeZone:profile.timeZone,units:profile.units,trainingPreferences:{goal:'Portable facts',updatedAt:new Date().toISOString()}},profile.revision);});
 await page.getByRole('button',{name:'Backup and restore',exact:true}).click();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON backup',exact:true}).click();const file=await(await pending).path();if(!file)throw Error('Missing downloaded JSON');
 const url=new URL('/settings',page.url().replace('127.0.0.1','localhost')).href;
 const other=await context.newPage();await other.goto(url);
 const sibling=await context.newPage();await sibling.addInitScript(()=>Object.defineProperty(window,'BroadcastChannel',{value:undefined}));await sibling.goto(new URL('/onboarding',url).href);
 await sibling.getByRole('textbox').fill('Unsaved stale form');
 await other.getByRole('button',{name:'Backup and restore',exact:true}).click();await other.getByLabel('Restore JSON file',{exact:true}).setInputFiles(file);
 await expect(other.getByText('Backup validated, including its data references.',{exact:true})).toBeVisible();await expect(other.getByRole('button',{name:'Replace local data',exact:true,includeHidden:true})).toBeDisabled();
 await other.getByRole('button',{name:'Next: keep current data',exact:true}).click();const old=other.waitForEvent('download');await other.getByRole('button',{name:'Download current data before replacement',exact:true}).click();await old;
 await other.getByLabel('I have downloaded and kept the current backup',{exact:true}).check();await other.getByRole('button',{name:'Next: confirm replacement',exact:true}).click();await other.getByLabel('I confirm replacing all local data',{exact:true}).check();await other.getByRole('button',{name:'Replace local data',exact:true}).click();
 await expect(sibling.getByRole('textbox')).not.toHaveValue('Unsaved stale form');
 await expect.poll(()=>other.evaluate(async()=>{const p='/src/application/profile.ts';return(await(await import(/* @vite-ignore */ p)).profileService.getProfile())?.trainingPreferences?.goal;})).toBe('Portable facts');
 await other.reload();await expect(other.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
});
