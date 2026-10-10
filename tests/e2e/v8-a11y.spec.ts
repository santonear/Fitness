import {test,expect} from '@playwright/test';
function luminance(color:string){const rgb=color.trim().match(/[a-f\d]{2}/gi)!.map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
for(const theme of ['qingci','liubai','jingshe','zhuangse'])test(`${theme}: body contrast, 44px controls and reduced motion`,async({page})=>{
 await page.addInitScript(theme=>localStorage.setItem('fitness-theme',theme),theme);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/settings');await expect(page.getByRole('heading',{name:'设置',exact:true})).toBeVisible();
 const colors=await page.evaluate(()=>{const s=getComputedStyle(document.documentElement);return Object.fromEntries(['--c-ink','--c-ink-muted','--c-bg','--c-surface','--c-primary','--c-on-primary'].map(k=>[k,s.getPropertyValue(k).trim()]));});
 for(const [fg,bg]of [['--c-ink','--c-bg'],['--c-ink-muted','--c-bg'],['--c-ink','--c-surface'],['--c-on-primary','--c-primary']]){const a=luminance(colors[fg]),b=luminance(colors[bg]);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05),`${theme} ${fg}/${bg}`).toBeGreaterThanOrEqual(4.5);}
 const dimensions=await page.locator('button,select,input').evaluateAll(elements=>elements.filter(e=>(e as HTMLElement).offsetWidth>0).map(e=>{const target=(e instanceof HTMLInputElement&&e.type==='checkbox'?e.closest('label'):e)!;const r=target.getBoundingClientRect();return {text:target.textContent,width:r.width,height:r.height};}));
 for(const d of dimensions){expect(d.width,d.text??'control').toBeGreaterThanOrEqual(44);expect(d.height,d.text??'control').toBeGreaterThanOrEqual(44);}
 await page.goto('/onboarding');await expect(page.locator('.v8-onboarding')).toBeVisible();expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
});
