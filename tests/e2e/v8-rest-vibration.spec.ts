import {expect,test} from '@playwright/test';
test('rest vibration is opt-in, once per set, and never catches up after pause',async({page})=>{
 await page.addInitScript(()=>{(window as any).vibrations=[];Object.defineProperty(navigator,'vibrate',{value:(n:number)=>{(window as any).vibrations.push(n);return true;}});});
 await page.clock.install();await page.goto('/tests/fixtures/v8-rest/index.html');
 await page.getByText('set',{exact:true}).click();await page.clock.runFor(90001);expect(await page.evaluate(()=>(window as any).vibrations)).toEqual([]);
 await page.getByText('enable',{exact:true}).click();await page.getByText('set',{exact:true}).click();await page.clock.runFor(89000);expect(await page.evaluate(()=>(window as any).vibrations)).toEqual([]);
 await page.clock.runFor(1001);expect(await page.evaluate(()=>(window as any).vibrations)).toEqual([30]);await page.getByText('render 0').click();await page.clock.runFor(90000);expect(await page.evaluate(()=>(window as any).vibrations)).toEqual([30]);
 await page.getByText('set',{exact:true}).click();await page.clock.runFor(45000);await page.getByText('pause',{exact:true}).click();await page.clock.runFor(90000);await page.getByText('pause',{exact:true}).click();await page.clock.runFor(90000);expect(await page.evaluate(()=>(window as any).vibrations)).toEqual([30]);
 await page.getByText('set',{exact:true}).click();await page.clock.runFor(90001);expect(await page.evaluate(()=>(window as any).vibrations)).toEqual([30,30]);
});
