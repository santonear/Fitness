import { test, expect } from '@playwright/test';
for(const locale of ['en','zh'] as const) test(`${locale} calendar has month/day views and no manual plan editor`,async({page})=>{
 const t=(en:string,zh:string)=>locale==='zh'?zh:en;
 await page.clock.setFixedTime(new Date('2028-02-15T12:00:00Z'));
 await page.addInitScript(locale=>localStorage.setItem('fitness.language',locale),locale);
 await page.goto('/plans');
 const calendar=page.getByRole('region',{name:t('training calendar','训练月历'),exact:true});
 await expect(calendar.locator('[data-calendar-date="2028-02-29"]')).toBeVisible();
 await calendar.locator('[data-calendar-date="2028-02-29"]').click();
 await calendar.getByRole('button',{name:t('day','日视图'),exact:true}).click();
 await expect(calendar.locator('.calendar-hour')).toHaveCount(24);
 await calendar.getByRole('button',{name:t('next day','后一天'),exact:true}).click();
 await expect(calendar.getByRole('heading',{level:2})).toContainText('2028');
 await calendar.getByRole('button',{name:t('month','月视图'),exact:true}).click();
 await expect(calendar.locator('[data-calendar-date="2028-03-01"]')).toBeVisible();
 await expect(page.getByLabel(t('Day plan name','日计划名称'),{exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:t('AI plan assistant','AI 计划助手'),exact:true})).toBeVisible();
 expect(await page.evaluate(async()=>{const {database}=await import(String('/src/persistence/db.ts'));return [await database.plans.count(),await database.sessions.count(),await database.sets.count()];})).toEqual([0,0,0]);
});
