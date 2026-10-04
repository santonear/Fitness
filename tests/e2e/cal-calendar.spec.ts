import { test, expect } from '@playwright/test';
for (const language of ['en', 'zh'] as const) {
  test(`${language} exact dates save independent day plans without week fields`, async ({page})=>{
    await page.goto('/plans'); await page.getByRole('combobox').first().selectOption(language);
    const section=page.getByRole('region',{name:language==='zh'?'日期训练计划':'Date training plans'});
    await expect(section).toBeVisible();
    await section.getByLabel(language==='zh'?'日历月份':'Calendar month').fill('2027-01');
    await section.getByRole('button',{name:'2027-01-04',exact:true}).click();
    const editor=section.locator('form:visible');
    await editor.getByLabel(language==='zh'?'日计划名称':'Day plan name').fill('A');
    await editor.getByRole('button',{name:language==='zh'?'保存此日':'Save this date',exact:true}).click();
    await expect(editor.getByRole('status')).toContainText(language==='zh'?'此日已保存':'This date is saved');
    await section.getByRole('button',{name:'2027-01-11',exact:true}).click();
    await section.locator('form:visible').getByLabel(language==='zh'?'日计划名称':'Day plan name').fill('B');
    await section.locator('form:visible').getByRole('button',{name:language==='zh'?'保存此日':'Save this date',exact:true}).click();
    await expect(section.locator('form:visible').getByRole('status')).toContainText(language==='zh'?'此日已保存':'This date is saved');
    expect(await page.evaluate(async()=>{const p='/src/persistence/db.ts';const {database}=await import(/* @vite-ignore */ p);return (await database.plans.toArray()).filter((p:{model?:string})=>p.model==='date-day').length;})).toBe(2);
    expect(await section.getByText(language==='zh'?'周期周数':'Cycle weeks',{exact:true}).count()).toBe(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  });
}
