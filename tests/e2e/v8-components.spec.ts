import { expect, test } from '@playwright/test';
test('modal animation, keyboard containment, composer and focus restoration', async ({page}) => {
 await page.goto('/tests/fixtures/v8-components/index.html');
 const trigger=page.getByRole('button',{name:'深蹲 · 20 kg × 8'});
 await trigger.click(); const dialog=page.getByRole('dialog'); await expect(dialog).toBeVisible();
 await expect(dialog).toHaveAccessibleName('深蹲');
 await page.waitForTimeout(550);
 await expect(dialog).toHaveCSS('opacity','1');
 await page.getByRole('textbox',{name:'跟芽芽说'}).fill('测试记录');
 await page.getByRole('button',{name:'发送'}).click();
 await expect(page.getByRole('status')).toHaveText('测试记录');
 await expect(page.getByRole('textbox',{name:'跟芽芽说'})).toHaveValue('');
 await page.keyboard.press('Tab');
 expect(await page.evaluate(()=>document.querySelector('dialog')?.contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
 await expect(page.getByRole('status')).not.toBeVisible({timeout:3500});
});
test('reduced motion and narrow screen', async ({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'}); await page.setViewportSize({width:320,height:700});
 await page.goto('/tests/fixtures/v8-components/index.html'); await page.getByRole('button',{name:'深蹲 · 20 kg × 8'}).click();
 const box=await page.getByRole('dialog').boundingBox(); expect(box!.width).toBeLessThanOrEqual(320); expect(box!.x).toBeGreaterThanOrEqual(0);
 await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
});
for(const width of [390,1440]) test(`qingci screenshot ${width}`, async({page})=>{
 await page.setViewportSize({width,height:844}); await page.goto('/tests/fixtures/v8-components/index.html'); await page.getByRole('button',{name:'深蹲 · 20 kg × 8'}).click(); await page.waitForTimeout(600); await page.screenshot({path:`outputs/v8-components/qingci-${width}.png`});
});
test('close measures the current trigger and IME Enter does not send', async({page})=>{
 await page.goto('/tests/fixtures/v8-components/index.html');
 const trigger=page.getByRole('button',{name:'深蹲 · 20 kg × 8'}); await trigger.click(); await page.waitForTimeout(550);
 const input=page.getByRole('textbox',{name:'跟芽芽说'}); await input.fill('输入中');
 await input.dispatchEvent('compositionstart'); await input.press('Enter'); await expect(input).toHaveValue('输入中'); await expect(page.getByRole('status')).not.toBeVisible(); await input.dispatchEvent('compositionend');
 await trigger.evaluate(el=>{el.style.transform='translateY(80px)';}); const rect=await trigger.boundingBox();
 await page.keyboard.press('Escape');
 const last=await page.getByRole('dialog').evaluate(el=>(el.getAnimations()[0].effect as KeyframeEffect)?.getKeyframes().at(-1));
 expect(last?.top).toBe(`${rect!.y}px`); await expect(trigger).toBeFocused();
});

