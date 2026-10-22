import {test,expect} from '@playwright/test';
import {answerTexts,engineSafety} from './helpers/onboarding-v9';
import {homeStart,startToday} from './helpers/home-start';
test('actual onboarding applies an environment plan and starts and the settings support switch restores balance in a new version',async({page})=>{
 await page.route('**/api/v1/features',route=>route.fulfill({json:{version:1,flags:{trainingEngine:true,aiAssistantV2:false,bodyProfile:false},expiresAt:Date.now()+3600000}}));
 await page.route('**/api/v1/trial/access-status',route=>route.fulfill({json:{qualification:'none',sessionValid:false,aiEnabled:false}}));
 await page.clock.setFixedTime(new Date('2026-10-16T10:00:00.000Z'));await page.goto('/');await expect(page).toHaveURL(/onboarding/);
 // Enter a real outdoor older-adult profile through production onboarding controls.
 await page.getByRole('button',{name:'开始',exact:true}).click();
 await answerTexts(page,['保持活动','每周3次，每次30分钟','户外，徒手']);
 // Older adult: falls questions appear only because of the birth date; the pregnancy choice has no age option.
 await engineSafety(page,{birth:'1956-01',falls:[false,true,false,false],prefs:async page=>{await page.getByRole('button',{name:'不能跳',exact:true}).click();await page.getByRole('button',{name:'需要安静',exact:true}).click();}});
 await page.getByRole('button',{name:'生成计划',exact:true}).click();
 await expect(page.getByRole('heading',{name:'你的第一版计划',exact:true})).toBeVisible();
 await expect(page.getByText(/平衡练习需要一个能扶的地方/).first()).toBeVisible();
 const apply=page.getByRole('button',{name:'就用这份计划',exact:true});await expect(apply).toBeEnabled();await apply.click();await page.getByRole('button',{name:'先不写',exact:true}).click();await expect(page).toHaveURL(/\/$/);
 const first=await page.evaluate(async()=>{const path='/src/ui/mainline/context.tsx',context=await import(/* @vite-ignore */path),snapshot=await context.workflow.snapshot();if(snapshot.version?.enginePlan?.quality?.status!=='environmentLimited')throw Error('Actual UI-applied draft must retain its environment claim');return snapshot.version.id;});
 await page.goto('/plans');const disclosure=page.getByRole('button',{name:/平衡练习需要一个能扶的地方/});await expect(disclosure).toBeVisible();await disclosure.click();await expect(page).toHaveURL(/settings\/engine#environment/);
 const support=page.getByRole('checkbox',{name:'家里有可扶的墙或椅子',exact:true});await expect(support).not.toBeChecked();
 await page.goto('/');const start=homeStart(page);await expect(start).toBeEnabled();await startToday(page);await expect(page).toHaveURL(/workout\//);
 await page.goto('/settings/engine#environment');await page.getByRole('checkbox',{name:'家里有可扶的墙或椅子',exact:true}).check();await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page).toHaveURL(/\/settings$/);
 await page.goto('/plans');await expect(page.getByRole('button',{name:/平衡练习需要一个能扶的地方/})).toHaveCount(0);
 const snapshot=await page.evaluate(async()=>{const path='/src/ui/mainline/context.tsx',c=await import(/* @vite-ignore */path),s=await c.workflow.snapshot();return{version:s.version,versions:s.versions,workouts:s.workouts};});
 expect(snapshot.version.basedOnVersionId).toBe(first);expect(snapshot.versions).toHaveLength(2);expect(snapshot.workouts[0].planVersionId).toBe(first);expect(snapshot.version.templates.every((t:{items:{prescription?:{pattern:string}}[]})=>t.items.some(i=>i.prescription?.pattern==='balance'))).toBe(true);
});
