import { expect, test } from '@playwright/test';

test('drag cancellation, keyboard and per-date drafts do not silently save', async ({ page }) => {
  await page.goto('/plans');await page.getByRole('combobox').first().selectOption('en');
  const region=page.getByRole('region',{name:'Date training plans'});await region.getByLabel('Calendar month').fill('2028-02');
  const cell=(date:string)=>region.locator(`[data-cal-date="${date}"]`);
  await cell('2028-02-28').scrollIntoViewIfNeeded();const a=await cell('2028-02-28').boundingBox(),b=await cell('2028-02-29').boundingBox();
  await page.mouse.move(a!.x+a!.width/2,a!.y+a!.height/2);await page.mouse.down();await page.mouse.move(b!.x+b!.width/2,b!.y+b!.height/2);
  await expect(cell('2028-02-28')).toHaveAttribute('aria-pressed','true');await expect(cell('2028-02-29')).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');await page.mouse.up();await expect(cell('2028-02-28')).toHaveAttribute('aria-pressed','false');
  await cell('2028-02-28').focus();await page.keyboard.press('Space');await page.keyboard.press('ArrowRight');await expect(cell('2028-02-29')).toBeFocused();await page.keyboard.press('Enter');
  await region.locator('form:visible').getByLabel('Day plan name').fill('Leap-day draft');
  await region.locator('.day-selection-tabs').getByRole('button',{name:'2028-02-28'}).click();await region.locator('form:visible').getByLabel('Day plan name').fill('Other draft');
  await region.locator('.day-selection-tabs').getByRole('button',{name:'2028-02-29'}).click();await expect(region.locator('form:visible').getByLabel('Day plan name')).toHaveValue('Leap-day draft');
  expect(await page.evaluate(async()=>{const p='/src/persistence/db.ts';const {database}=await import(/* @vite-ignore */ p);return {plans:await database.plans.count(),sessions:await database.sessions.count()};})).toEqual({plans:0,sessions:0});
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});

test('touch scrolling and cancellation do not select; a short tap selects', async ({ page }) => {
  await page.goto('/plans');await page.getByRole('combobox').first().selectOption('en');
  const region=page.getByRole('region',{name:'Date training plans'});await region.getByLabel('Calendar month').fill('2027-01');const cell=region.locator('[data-cal-date="2027-01-04"]');
  await cell.dispatchEvent('pointerdown',{pointerType:'touch',button:0,clientX:20,clientY:20});
  await cell.dispatchEvent('pointermove',{pointerType:'touch',clientX:20,clientY:40});await cell.dispatchEvent('pointerup',{pointerType:'touch'});await expect(cell).toHaveAttribute('aria-pressed','false');
  await cell.dispatchEvent('pointerdown',{pointerType:'touch',button:0,clientX:20,clientY:20});await cell.dispatchEvent('pointerup',{pointerType:'touch'});await expect(cell).toHaveAttribute('aria-pressed','true');
  await cell.dispatchEvent('pointerdown',{pointerType:'touch',button:0,clientX:20,clientY:20});await cell.dispatchEvent('pointercancel',{pointerType:'touch'});await expect(cell).toHaveAttribute('aria-pressed','true');
});

test('already loaded offline calendar saves and exports a usable backup', async ({page,context})=>{
  await page.goto('/plans');await page.getByRole('combobox').first().selectOption('en');const region=page.getByRole('region',{name:'Date training plans'});await region.getByLabel('Calendar month').fill('2027-01');await region.locator('[data-cal-date="2027-01-04"]').click();
  await page.evaluate(async()=>{for(const path of ['/src/application/backup.ts','/src/application/day-plans.ts'])await import(/* @vite-ignore */ path);});
  // Block HTTP only: WebKit's automation offline switch also denies local Blob I/O.
  await context.route(/^https?:\/\//,route=>route.abort('internetdisconnected'));await region.locator('form:visible').getByLabel('Day plan name').fill('Offline day');await region.locator('form:visible').getByRole('button',{name:'Save this date'}).click();await expect(region.locator('form:visible').getByRole('status')).toContainText('This date is saved');
  const result=await page.evaluate(async()=>{const p='/src/application/backup.ts';const {backupService}=await import(/* @vite-ignore */ p);const blob=await backupService.exportBackup();const text=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsText(blob);});const parsed=await backupService.validateBackup(new File([text],'offline.json'));return parsed.envelope.data.plans[0].name;});expect(result).toBe('Offline day');
  await context.unroute(/^https?:\/\//);
});
