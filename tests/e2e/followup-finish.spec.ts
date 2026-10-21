import {test,expect,type Page} from '@playwright/test';
import {openHomeCoach} from './helpers/home-coach';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {answerTexts,basicSafety,generate} from './helpers/onboarding-v9';
import {homeStart} from './helpers/home-start';
const o=JSON.parse(readFileSync('src/i18n/features/onboarding/zh.json','utf8'));
async function enable(page:Page,flags:Record<string,boolean>){
 // Drain the initial request before replacing its response: refresh intentionally deduplicates in-flight requests.
 await page.evaluate(async()=>{const path='/src/application/feature-flags.ts';await (await import(/* @vite-ignore */path)).refreshFeatureFlags();});
 await page.route('**/api/v1/features',route=>route.fulfill({json:{version:1,expiresAt:Date.now()+60000,flags}}));
 await page.evaluate(async()=>{const path='/src/application/feature-flags.ts';await (await import(/* @vite-ignore */path)).refreshFeatureFlags();});
}
async function capture(page:Page,name:string){
 await page.evaluate(()=>document.fonts.ready);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`outputs/followup-finish/${name}.png`,fullPage:true});
}
for(const theme of ['pop', 'vivid', 'gentle', 'data', 'fire'])for(const width of [375,430,768,1024])test(`${theme} ${width} responsive signatures and RepDB`,async({page},info)=>{
 await page.addInitScript(theme=>localStorage.setItem('fitness-theme',theme),theme);
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');await enable(page,{fontSubset:true,exercisePanel:true});
 await page.getByRole('button',{name:'开始',exact:true}).click();await answerTexts(page,['保持力量','每周3次，每次30分钟','在家，只有瑜伽垫']);await basicSafety(page);await generate(page);await page.getByRole('button',{name:o.accept,exact:true}).click();
 await expect(page.getByRole('heading',{name:'今天',exact:true})).toBeVisible();
 const prefix=`${info.project.name}-${theme}-${width}`;await capture(page,`${prefix}-next`);
 await page.goto('/exercises');await enable(page,{fontSubset:true,exercisePanel:true});
 const detail = await page.evaluate(async()=>{const path='/src/catalog/registry.ts';const map=(await import(/* @vite-ignore */path)).catalogMetadata;return [...map.values()].find((x:any)=>x.media.start&&x.media.peak)?.id;});
 expect(detail).toBeTruthy();
 const name=await page.evaluate(async(id)=>{const path='/src/catalog/catalog-service.ts';return (await import(/* @vite-ignore */path)).searchExercises('','zh',{}).find((x:any)=>x.id===id).name.zh;},detail);
 await page.getByRole('searchbox').fill(name);await page.getByRole('button',{name,exact:true}).first().click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 const images=dialog.locator('.repdb-media img');await expect(images).toHaveCount(2);
 for(const img of await images.all()){await img.scrollIntoViewIfNeeded();await expect.poll(()=>img.evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0)).toBe(true);}
 await capture(page,`${prefix}-repdb`);
 const metrics=await images.evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
 expect(metrics[0].x===metrics[1].x).toBe(width<768);
 mkdirSync('outputs/followup-finish/metrics',{recursive:true});writeFileSync(`outputs/followup-finish/metrics/${prefix}.json`,JSON.stringify(metrics));
});
for(const theme of ['pop', 'vivid', 'gentle', 'data', 'fire'])test(`${theme} coach 320`,async({page},info)=>{
 await page.addInitScript(theme=>localStorage.setItem('fitness-theme',theme),theme);
 await page.setViewportSize({width:320,height:844});await page.goto('/');
 await page.getByRole('button',{name:'开始',exact:true}).click();await answerTexts(page,['保持力量','每周3次，每次30分钟','在家，只有瑜伽垫']);await basicSafety(page);await generate(page);await page.getByRole('button',{name:o.accept,exact:true}).click();
 await expect(homeStart(page)).toBeVisible();
 await openHomeCoach(page);await page.getByRole('dialog').getByRole('textbox').fill('保留本地草稿');
 await capture(page,`${info.project.name}-${theme}-320-coach`);
});
test('fifth folder discovery and remote kill preserve saved preference',async({page})=>{
 await page.goto('/settings/appearance');
 await expect(page.getByRole('radio',{name:'测试第五主题',exact:true})).toHaveCount(0);
 await enable(page,{themeDiscovery:true});
 await expect(page.getByRole('radio',{name:'测试第五主题',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'更多模板',exact:true}).click();
 await expect(page.getByRole('radio',{name:'测试第五主题',exact:true})).toHaveCount(1);
 await page.getByRole('radio',{name:'测试第五主题',exact:true}).click();
 const values=await page.evaluate(async()=>{const path='/src/themes/registry.ts';return (await import(/* @vite-ignore */path)).getAvailableThemes(true).map((x:any)=>x.id);});
 expect(values).toContain('followup-test');
 await expect(page.locator('html')).toHaveAttribute('data-theme','followup-test');
 await enable(page,{themeDiscovery:false});await expect(page.locator('html')).toHaveAttribute('data-theme','pop');
 expect(await page.evaluate(()=>localStorage.getItem('fitness-theme'))).toBe('followup-test');
 await expect(page.getByRole('radio',{name:'测试第五主题',exact:true})).toHaveCount(0);
});
test('font rollout loads local compact faces and returns to original tokens on remote kill',async({page})=>{
 await page.goto('/');
 const font=()=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--f-body'));
 expect(await font()).not.toContain('Compact');
 await enable(page,{fontSubset:true});await expect.poll(font).toContain('Noto Sans SC Compact');
 await expect.poll(()=>page.evaluate(async()=>{
  const sans=await document.fonts.load('300 16px "Noto Sans SC Compact"','训练');
  const serif=await document.fonts.load('400 20px "Noto Serif SC Compact"','训练');
  // Require real registered faces, not an empty load/fallback result. WebKit
  // can finish a font load before its FontFaceSet check reflects style updates.
  return sans.length>0&&serif.length>0&&[...sans,...serif].every(face=>face.status==='loaded')&&document.fonts.check('300 16px "Noto Sans SC Compact"','训练')&&document.fonts.check('400 20px "Noto Serif SC Compact"','训练');
 })).toBe(true);
 await enable(page,{fontSubset:false});await expect.poll(font).not.toContain('Compact');
});
